import {
  AGENT_GIG_PLATFORMS,
  CORE_RSS_PLATFORMS,
} from "./adapterModule.js";
import { callFetchJobs, ensurePlatforms } from "./adapterLoader.js";
import { fetchProductRadarJobs } from "./adapters/product_radar.js";
import { fetchRssJobs } from "./adapters/rss.js";
import { fetchTelegramJobs } from "./adapters/telegram.js";
import { upsertJobs } from "./store.js";
import type { Job } from "./types.js";

function softError(err?: string): boolean {
  if (!err) return true;
  return err.includes("optional") || err.includes("missing");
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
}): Promise<{
  jobs: Job[];
  errors: string[];
}> {
  const platforms = opts?.platforms;
  const errors: string[] = [];
  const collected: Job[] = [];

  const wantRss =
    !platforms?.length ||
    platforms.some((p) => (CORE_RSS_PLATFORMS as readonly string[]).includes(p));
  const rssIds = platforms?.filter((p) =>
    (CORE_RSS_PLATFORMS as readonly string[]).includes(p),
  );

  if (wantRss) {
    const rss = await fetchRssJobs(rssIds?.length ? rssIds : undefined);
    collected.push(...rss.jobs);
    for (const e of rss.errors) errors.push(`${e.platform}: ${e.error}`);
  }

  const wantRadar =
    !platforms?.length || platforms.includes("product_radar");
  if (wantRadar) {
    const radar = await fetchProductRadarJobs({ maxPages: 3 });
    collected.push(...radar.jobs);
    if (radar.error && !radar.jobs.length) {
      errors.push(`product_radar: ${radar.error}`);
    }
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
    if (!platforms?.length || platforms.includes("remoteok")) {
      modulesWanted.push("remoteok");
    }
    if (!platforms?.length || platforms.includes("remotive")) {
      modulesWanted.push("remotive");
    }
    if (!platforms?.length || platforms.includes("arbeitnow")) {
      modulesWanted.push("arbeitnow");
    }
    if (!platforms?.length || platforms.includes("adzuna")) {
      modulesWanted.push("adzuna");
    }
    if (!platforms?.length || platforms.includes("himalayas")) {
      modulesWanted.push("himalayas");
    }
    if (!platforms?.length || platforms.includes("weworkremotely")) {
      modulesWanted.push("weworkremotely");
    }
    if (!platforms?.length || platforms.includes("jobicy")) {
      modulesWanted.push("jobicy");
    }
    if (!platforms?.length || platforms.includes("dreamoffer")) {
      modulesWanted.push("dreamoffer");
    }
    if (!platforms?.length || platforms.includes("working_nomads")) {
      modulesWanted.push("working_nomads");
    }
    if (!platforms?.length || platforms.includes("themuse")) {
      modulesWanted.push("themuse");
    }
    if (!platforms?.length || platforms.includes("four_day_week")) {
      modulesWanted.push("four_day_week");
    }
    if (!platforms?.length || platforms.includes("aidevboard")) {
      modulesWanted.push("aidevboard");
    }
    if (!platforms?.length || platforms.includes("aquent")) {
      modulesWanted.push("aquent");
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
    if (!platforms?.length || platforms.includes("remoteok")) {
      const rok = await callFetchJobs("remoteok");
      collected.push(...rok.jobs);
      if (rok.error) errors.push(`remoteok: ${rok.error}`);
    }
    if (!platforms?.length || platforms.includes("remotive")) {
      const rem = await callFetchJobs("remotive");
      collected.push(...rem.jobs);
      if (rem.error) errors.push(`remotive: ${rem.error}`);
    }
    if (!platforms?.length || platforms.includes("arbeitnow")) {
      const an = await callFetchJobs("arbeitnow");
      collected.push(...an.jobs);
      if (an.error) errors.push(`arbeitnow: ${an.error}`);
    }
    if (!platforms?.length || platforms.includes("adzuna")) {
      const adz = await callFetchJobs("adzuna");
      collected.push(...adz.jobs);
      if (adz.error && !softError(adz.error)) {
        errors.push(`adzuna: ${adz.error}`);
      }
    }
    if (!platforms?.length || platforms.includes("himalayas")) {
      const him = await callFetchJobs("himalayas");
      collected.push(...him.jobs);
      if (him.error) errors.push(`himalayas: ${him.error}`);
    }
    if (!platforms?.length || platforms.includes("weworkremotely")) {
      const wwr = await callFetchJobs("weworkremotely");
      collected.push(...wwr.jobs);
      if (wwr.error) errors.push(`weworkremotely: ${wwr.error}`);
    }
    if (!platforms?.length || platforms.includes("jobicy")) {
      const jic = await callFetchJobs("jobicy");
      collected.push(...jic.jobs);
      if (jic.error) errors.push(`jobicy: ${jic.error}`);
    }
    if (!platforms?.length || platforms.includes("dreamoffer")) {
      const dream = await callFetchJobs("dreamoffer", {
        keywords: opts.keywords,
        limit: 30,
      });
      collected.push(...dream.jobs);
      if (dream.error) errors.push(`dreamoffer: ${dream.error}`);
    }
    if (!platforms?.length || platforms.includes("working_nomads")) {
      const wn = await callFetchJobs("working_nomads");
      collected.push(...wn.jobs);
      if (wn.error) errors.push(`working_nomads: ${wn.error}`);
    }
    if (!platforms?.length || platforms.includes("themuse")) {
      const muse = await callFetchJobs("themuse");
      collected.push(...muse.jobs);
      if (muse.error) errors.push(`themuse: ${muse.error}`);
    }
    if (!platforms?.length || platforms.includes("four_day_week")) {
      const fdw = await callFetchJobs("four_day_week");
      collected.push(...fdw.jobs);
      if (fdw.error) errors.push(`four_day_week: ${fdw.error}`);
    }
    if (!platforms?.length || platforms.includes("aidevboard")) {
      const ai = await callFetchJobs("aidevboard");
      collected.push(...ai.jobs);
      if (ai.error) errors.push(`aidevboard: ${ai.error}`);
    }
    if (!platforms?.length || platforms.includes("aquent")) {
      const aq = await callFetchJobs("aquent");
      collected.push(...aq.jobs);
      if (aq.error) errors.push(`aquent: ${aq.error}`);
    }
    if (!platforms?.length || platforms.includes("habr_career")) {
      const habr = await fetchRssJobs(["habr_career"]);
      collected.push(...habr.jobs);
      for (const e of habr.errors) errors.push(`${e.platform}: ${e.error}`);
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
  return { jobs: stored, errors };
}
