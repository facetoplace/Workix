import {
  AGENT_GIG_PLATFORMS,
  CORE_RSS_PLATFORMS,
  JOB_BOARD_MODULES,
  RSS_JOB_PLATFORMS,
} from "./adapterModule.js";
import { callFetchJobs, ensurePlatforms } from "./adapterLoader.js";
import { fetchAtsJobs } from "./adapters/ats.js";
import { fetchHabrCareerJobs } from "./adapters/habr_career.js";
import { JOBSPY_PLATFORMS } from "./adapters/jobspy.js";
import { fetchProductRadarJobs } from "./adapters/product_radar.js";
import { fetchRssJobs } from "./adapters/rss.js";
import { fetchTelegramJobs } from "./adapters/telegram.js";
import { pruneCache, readCache, writeCache } from "./fetchCache.js";
import { getProxyPool } from "./proxyPool.js";
import { upsertJobs } from "./store.js";
import type { Job } from "./types.js";

function softError(err?: string): boolean {
  if (!err) return true;
  return err.includes("optional") || err.includes("missing");
}

interface SourceResult {
  jobs: Job[];
  error?: string;
}

/**
 * Run a source through the shared cache. Only successful, non-empty results are
 * stored, so a blocked board retries next run instead of staying dark for the
 * whole TTL. Errors are never cached.
 */
async function cached(
  source: string,
  params: unknown,
  force: boolean,
  run: () => Promise<SourceResult>,
): Promise<SourceResult & { cacheAgeMinutes?: number }> {
  const hit = readCache(source, params, { force });
  if (hit) return { jobs: hit.jobs, cacheAgeMinutes: hit.ageMinutes };
  const r = await run();
  if (r.jobs.length) writeCache(source, params, r.jobs);
  return r;
}

/**
 * RSS feeds are cached per platform, not per requested group: a session asking
 * for three feeds and one asking for a single feed should share what overlaps.
 * Misses still go out in one batched call so the feeds are fetched in parallel.
 */
async function cachedRss(
  ids: string[] | undefined,
  force: boolean,
  onCacheHit: (id: string, age: number) => void,
): Promise<SourceResult> {
  const known = ids?.length ? ids : undefined;
  if (!known) {
    // Default set (core v1 boards) — no id list to split on, cache as one group.
    const hit = readCache("core_rss", {}, { force });
    if (hit) {
      onCacheHit("core_rss", hit.ageMinutes);
      return { jobs: hit.jobs };
    }
    const rss = await fetchRssJobs(undefined);
    if (rss.jobs.length) writeCache("core_rss", {}, rss.jobs);
    return {
      jobs: rss.jobs,
      error: rss.errors.map((e) => `${e.platform}: ${e.error}`).join("; "),
    };
  }

  const jobs: Job[] = [];
  const misses: string[] = [];
  for (const id of known) {
    const hit = readCache(`rss:${id}`, {}, { force });
    if (hit) {
      jobs.push(...hit.jobs);
      onCacheHit(id, hit.ageMinutes);
    } else {
      misses.push(id);
    }
  }
  if (!misses.length) return { jobs };

  const rss = await fetchRssJobs(misses);
  const byPlatform = new Map<string, Job[]>();
  for (const j of rss.jobs) {
    const list = byPlatform.get(j.platform) || [];
    list.push(j);
    byPlatform.set(j.platform, list);
  }
  for (const id of misses) {
    const rows = byPlatform.get(id) || [];
    if (rows.length) writeCache(`rss:${id}`, {}, rows);
  }
  jobs.push(...rss.jobs);
  return {
    jobs,
    error: rss.errors.map((e) => `${e.platform}: ${e.error}`).join("; "),
  };
}

export async function refreshJobs(opts?: {
  platforms?: string[];
  includeKwork?: boolean;
  include_jobs?: boolean;
  include_agent_gigs?: boolean;
  include_freelancehunt?: boolean;
  include_upwork?: boolean;
  include_freelancer?: boolean;
  hh_text?: string;
  upwork_query?: string;
  freelancer_query?: string;
  /** Passed to adapters that support text filter (e.g. Dream Offer). */
  keywords?: string[];
  /** Skip the shared cache and re-read every source from the network. */
  force_refresh?: boolean;
}): Promise<{
  jobs: Job[];
  errors: string[];
  cached: string[];
}> {
  const platforms = opts?.platforms;
  const force = Boolean(opts?.force_refresh);
  const errors: string[] = [];
  const collected: Job[] = [];
  const fromCache: string[] = [];

  const note = (
    id: string,
    r: SourceResult & { cacheAgeMinutes?: number },
  ): void => {
    if (r.cacheAgeMinutes !== undefined) {
      fromCache.push(`${id} (${r.cacheAgeMinutes}m)`);
    }
  };

  const wantRss =
    !platforms?.length ||
    platforms.some((p) => (CORE_RSS_PLATFORMS as readonly string[]).includes(p));
  const rssIds = platforms?.filter((p) =>
    (CORE_RSS_PLATFORMS as readonly string[]).includes(p),
  );

  const cacheHit = (id: string, age: number): void => {
    fromCache.push(`${id} (${age}m)`);
  };

  if (wantRss) {
    const r = await cachedRss(rssIds, force, cacheHit);
    collected.push(...r.jobs);
    if (r.error) errors.push(r.error);
  }

  const wantRadar =
    !platforms?.length || platforms.includes("product_radar");
  if (wantRadar) {
    const r = await cached("product_radar", {}, force, async () => {
      const radar = await fetchProductRadarJobs({ maxPages: 3 });
      return { jobs: radar.jobs, error: radar.jobs.length ? undefined : radar.error };
    });
    collected.push(...r.jobs);
    note("product_radar", r);
    if (r.error) errors.push(`product_radar: ${r.error}`);
  }

  const modulesWanted: string[] = [];
  const wantKwork =
    opts?.includeKwork !== false &&
    (!platforms?.length || platforms.includes("kwork"));
  if (wantKwork) modulesWanted.push("kwork");

  const wantFh =
    opts?.include_freelancehunt !== false &&
    (!platforms?.length || platforms.includes("freelancehunt"));
  if (wantFh) modulesWanted.push("freelancehunt");

  if (opts?.include_jobs) {
    if (!platforms?.length || platforms.includes("hh")) modulesWanted.push("hh");
    if (!platforms?.length || platforms.includes("dreamoffer")) {
      modulesWanted.push("dreamoffer");
    }
    for (const board of JOB_BOARD_MODULES) {
      if (platforms?.length && !platforms.includes(board.platform)) continue;
      if (
        board.metered &&
        !platforms?.includes(board.platform) &&
        process.env[board.metered] !== "1"
      ) {
        continue;
      }
      modulesWanted.push(board.module || board.platform);
    }
  }

  if (opts?.include_agent_gigs) {
    for (const id of AGENT_GIG_PLATFORMS) {
      if (!platforms?.length || platforms.includes(id)) {
        modulesWanted.push(id);
      }
    }
  }

  const wantUpwork =
    opts?.include_upwork !== false &&
    (!platforms?.length || platforms.includes("upwork"));
  if (wantUpwork) modulesWanted.push("upwork");

  const wantFln =
    opts?.include_freelancer !== false &&
    (!platforms?.length || platforms.includes("freelancer_com"));
  if (wantFln) modulesWanted.push("freelancer_com");

  if (modulesWanted.length) {
    const ensured = await ensurePlatforms(modulesWanted);
    for (const e of ensured.errors) errors.push(`adapter: ${e}`);
  }

  if (wantKwork) {
    const kw = await callFetchJobs("kwork");
    collected.push(...kw.jobs);
    if (kw.error && !softError(kw.error)) errors.push(`kwork: ${kw.error}`);
  }

  if (wantFh) {
    const fh = await callFetchJobs("freelancehunt");
    collected.push(...fh.jobs);
    if (fh.error && !softError(fh.error)) {
      errors.push(`freelancehunt: ${fh.error}`);
    }
  }

  if (opts?.include_jobs) {
    if (!platforms?.length || platforms.includes("hh")) {
      const hh = await callFetchJobs("hh", { text: opts.hh_text });
      collected.push(...hh.jobs);
      if (hh.error) errors.push(`hh: ${hh.error}`);
    }
    for (const board of JOB_BOARD_MODULES) {
      if (platforms?.length && !platforms.includes(board.platform)) continue;
      if (
        board.metered &&
        !platforms?.includes(board.platform) &&
        process.env[board.metered] !== "1"
      ) {
        continue;
      }
      const params = board.keywords ? { keywords: opts.keywords } : {};
      const r = await cached(board.platform, params, force, () =>
        callFetchJobs(
          board.module || board.platform,
          board.keywords ? { keywords: opts.keywords } : undefined,
        ),
      );
      collected.push(...r.jobs);
      note(board.platform, r);
      if (r.error && !(board.soft && softError(r.error))) {
        errors.push(`${board.platform}: ${r.error}`);
      }
    }
    // JobSpy-backed boards are opt-in only — never on a bare include_jobs.
    // They need Python plus the optional `jobspy` package and a single board
    // can take minutes, so pulling them by default would make every digest
    // slow and noisy for the majority who have not installed it.
    const jobspyWanted = JOBSPY_PLATFORMS.filter((p) => platforms?.includes(p));
    // Every board behind this bridge blocks datacenter IPs to some degree —
    // verified 2026-08-10: Bayt answers 403 direct, LinkedIn throttles around
    // page 10 from one address. jobspy rotates whatever list it is handed, so
    // give it the same pool the rest of our adapters use.
    const jobspyProxies = jobspyWanted.length ? await getProxyPool() : [];
    for (const p of jobspyWanted) {
      const js = await callFetchJobs("jobspy", {
        platform: p,
        what: opts.hh_text || (opts.keywords || []).join(" ") || undefined,
        limit: 50,
        proxies: jobspyProxies.length ? jobspyProxies.slice(0, 10) : undefined,
      });
      collected.push(...js.jobs);
      // Always surface, never softError(): these run only when the caller named
      // the platform outright, so "not installed" is the answer they asked for.
      // Swallowing it returns an empty digest with no reason given — and the
      // install hint contains the word "optional", which softError() matches.
      if (js.error) errors.push(`${p}: ${js.error}`);
    }
    if (!platforms?.length || platforms.includes("dreamoffer")) {
      const dream = await callFetchJobs("dreamoffer", {
        keywords: opts.keywords,
        limit: 30,
      });
      collected.push(...dream.jobs);
      if (dream.error) errors.push(`dreamoffer: ${dream.error}`);
    }
    // Employer ATS boards live in core: the company list is a repo file, so a
    // downloadable module would resolve it to its own install dir and find none.
    if (!platforms?.length || platforms.includes("ats")) {
      const r = await cached("ats", { keywords: opts.keywords }, force, () =>
        fetchAtsJobs({ keywords: opts.keywords }),
      );
      collected.push(...r.jobs);
      note("ats", r);
      if (r.error && !softError(r.error)) errors.push(`ats: ${r.error}`);
    }
    if (!platforms?.length || platforms.includes("habr_career")) {
      const r = await cached(
        "habr_career",
        { keywords: opts.keywords },
        force,
        async () => {
          const habr = await fetchHabrCareerJobs({ keywords: opts.keywords });
          if (habr.jobs.length) return habr;
          // The frontend JSON is unversioned — fall back to the RSS we used before.
          const rss = await fetchRssJobs(["habr_career"]);
          return {
            jobs: rss.jobs,
            error: rss.jobs.length ? undefined : habr.error,
          };
        },
      );
      collected.push(...r.jobs);
      note("habr_career", r);
      if (r.error) errors.push(`habr_career: ${r.error}`);
    }
    const rssBoards = RSS_JOB_PLATFORMS.filter(
      (id) => !platforms?.length || platforms.includes(id),
    );
    if (rssBoards.length) {
      const r = await cachedRss(rssBoards, force, cacheHit);
      collected.push(...r.jobs);
      if (r.error) errors.push(r.error);
    }
  }

  if (opts?.include_agent_gigs) {
    for (const id of AGENT_GIG_PLATFORMS) {
      if (platforms?.length && !platforms.includes(id)) continue;
      const r = await callFetchJobs(id);
      collected.push(...r.jobs);
      if (r.error && !softError(r.error)) errors.push(`${id}: ${r.error}`);
    }
  }

  if (wantUpwork) {
    const uw = await callFetchJobs("upwork", { query: opts?.upwork_query });
    collected.push(...uw.jobs);
    if (uw.error && !softError(uw.error)) errors.push(`upwork: ${uw.error}`);
  }

  if (wantFln) {
    const fln = await callFetchJobs("freelancer", {
      query: opts?.freelancer_query,
    });
    collected.push(...fln.jobs);
    if (fln.error && !softError(fln.error)) {
      errors.push(`freelancer_com: ${fln.error}`);
    }
  }

  // Optional TDLib — only when explicitly requested (platforms includes telegram)
  if (platforms?.includes("telegram")) {
    const tg = await fetchTelegramJobs({
      keywords: opts?.upwork_query
        ? String(opts.upwork_query).split(/\s+/).filter(Boolean)
        : undefined,
    });
    collected.push(...tg.jobs);
    if (tg.error) errors.push(`telegram: ${tg.error}`);
  }

  const stored = upsertJobs(collected);
  // Cheap and self-limiting: drops only rows already past their TTL.
  pruneCache();
  return { jobs: stored, errors, cached: fromCache };
}
