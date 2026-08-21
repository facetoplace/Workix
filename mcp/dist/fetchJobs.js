import { AGENT_GIG_PLATFORMS, CORE_RSS_PLATFORMS, JOB_BOARD_MODULES, RSS_JOB_PLATFORMS, } from "./adapterModule.js";
import { callFetchJobs, ensurePlatforms } from "./adapterLoader.js";
import { fetchAtsJobs } from "./adapters/ats.js";
import { fetchHabrCareerJobs } from "./adapters/habr_career.js";
import { fetchInstahyreJobs } from "./adapters/instahyre.js";
import { JOBSPY_PLATFORMS } from "./adapters/jobspy.js";
import { fetchKalibrrJobs } from "./adapters/kalibrr.js";
import { fetchLaunchLeads } from "./adapters/launches.js";
import { fetchFundingLeads } from "./adapters/funding.js";
import { fetchProductHuntLeads } from "./adapters/producthunt.js";
import { fetchProductRadarJobs } from "./adapters/product_radar.js";
import { fetchStartupRankingLeads } from "./adapters/startupranking.js";
import { fetchStartupiumLeads } from "./adapters/startupium.js";
import { fetchTheHubJobs } from "./adapters/thehub.js";
import { fetchStartupJobsMcp } from "./adapters/startup_jobs_mcp.js";
import { fetchRemocateJobs } from "./adapters/remocate.js";
import { fetchRegionalBoardJobs } from "./adapters/regional_boards.js";
import { fetchJobSearchDbBoards } from "./adapters/jobsearchdb.js";
import { fetchRssJobs } from "./adapters/rss.js";
import { fetchTelegramJobs, telegramActivated } from "./adapters/telegram.js";
import { fetchWantedlyJobs } from "./adapters/wantedly.js";
import { dedupeJobs } from "./dedupe.js";
import { pruneCache, readCache, writeCache } from "./fetchCache.js";
import { getProxyPool } from "./proxyPool.js";
import { upsertJobs } from "./store.js";
function softError(err) {
    if (!err)
        return true;
    return err.includes("optional") || err.includes("missing");
}
/**
 * Asian boards with public, keyless APIs — probed 2026-08-11. They fill the one
 * gap the rest of the catalogue never covered: JP / IN / SEA hiring that is not
 * remote-first and therefore invisible to the global remote boards.
 */
const ASIA_BOARDS = [
    { platform: "wantedly", fetch: (o) => fetchWantedlyJobs(o) },
    { platform: "kalibrr", fetch: (o) => fetchKalibrrJobs(o) },
    { platform: "instahyre", fetch: (o) => fetchInstahyreJobs(o) },
];
/**
 * Run a source through the shared cache. Only successful, non-empty results are
 * stored, so a blocked board retries next run instead of staying dark for the
 * whole TTL. Errors are never cached.
 */
async function cached(source, params, force, run) {
    const hit = readCache(source, params, { force });
    if (hit)
        return { jobs: hit.jobs, cacheAgeMinutes: hit.ageMinutes };
    const r = await run();
    if (r.jobs.length)
        writeCache(source, params, r.jobs);
    return r;
}
/**
 * RSS feeds are cached per platform, not per requested group: a session asking
 * for three feeds and one asking for a single feed should share what overlaps.
 * Misses still go out in one batched call so the feeds are fetched in parallel.
 */
async function cachedRss(ids, force, onCacheHit) {
    const known = ids?.length ? ids : undefined;
    if (!known) {
        // Default set (core v1 boards) — no id list to split on, cache as one group.
        const hit = readCache("core_rss", {}, { force });
        if (hit) {
            onCacheHit("core_rss", hit.ageMinutes);
            return { jobs: hit.jobs };
        }
        const rss = await fetchRssJobs(undefined);
        if (rss.jobs.length)
            writeCache("core_rss", {}, rss.jobs);
        return {
            jobs: rss.jobs,
            error: rss.errors.map((e) => `${e.platform}: ${e.error}`).join("; "),
        };
    }
    const jobs = [];
    const misses = [];
    for (const id of known) {
        const hit = readCache(`rss:${id}`, {}, { force });
        if (hit) {
            jobs.push(...hit.jobs);
            onCacheHit(id, hit.ageMinutes);
        }
        else {
            misses.push(id);
        }
    }
    if (!misses.length)
        return { jobs };
    const rss = await fetchRssJobs(misses);
    const byPlatform = new Map();
    for (const j of rss.jobs) {
        const list = byPlatform.get(j.platform) || [];
        list.push(j);
        byPlatform.set(j.platform, list);
    }
    for (const id of misses) {
        const rows = byPlatform.get(id) || [];
        if (rows.length)
            writeCache(`rss:${id}`, {}, rows);
    }
    jobs.push(...rss.jobs);
    return {
        jobs,
        error: rss.errors.map((e) => `${e.platform}: ${e.error}`).join("; "),
    };
}
export async function refreshJobs(opts) {
    const platforms = opts?.platforms;
    const force = Boolean(opts?.force_refresh);
    const errors = [];
    const collected = [];
    const fromCache = [];
    const note = (id, r) => {
        if (r.cacheAgeMinutes !== undefined) {
            fromCache.push(`${id} (${r.cacheAgeMinutes}m)`);
        }
    };
    const wantRss = !platforms?.length ||
        platforms.some((p) => CORE_RSS_PLATFORMS.includes(p));
    const rssIds = platforms?.filter((p) => CORE_RSS_PLATFORMS.includes(p));
    const cacheHit = (id, age) => {
        fromCache.push(`${id} (${age}m)`);
    };
    if (wantRss) {
        const r = await cachedRss(rssIds, force, cacheHit);
        collected.push(...r.jobs);
        if (r.error)
            errors.push(r.error);
    }
    const wantRadar = !platforms?.length || platforms.includes("product_radar");
    if (wantRadar) {
        const r = await cached("product_radar", {}, force, async () => {
            const radar = await fetchProductRadarJobs({ maxPages: 3 });
            return { jobs: radar.jobs, error: radar.jobs.length ? undefined : radar.error };
        });
        collected.push(...r.jobs);
        note("product_radar", r);
        if (r.error)
            errors.push(`product_radar: ${r.error}`);
    }
    const wantStartupium = platforms?.includes("startupium");
    if (wantStartupium) {
        const r = await cached("startupium", { keywords: opts?.keywords }, force, () => fetchStartupiumLeads({ kind: "all", keywords: opts?.keywords }));
        collected.push(...r.jobs);
        note("startupium", r);
        if (r.error)
            errors.push(`startupium: ${r.error}`);
    }
    const wantTheHub = platforms?.includes("thehub") ||
        (Boolean(opts?.include_jobs) && !platforms?.length);
    if (wantTheHub) {
        const r = await cached("thehub", { keywords: opts?.keywords }, force, () => fetchTheHubJobs({ keywords: opts?.keywords }));
        collected.push(...r.jobs);
        note("thehub", r);
        if (r.error)
            errors.push(`thehub: ${r.error}`);
    }
    const wantStartupJobs = platforms?.includes("startup_jobs") ||
        (Boolean(opts?.include_jobs) && !platforms?.length);
    if (wantStartupJobs) {
        const r = await cached("startup_jobs", { keywords: opts?.keywords }, force, async () => {
            const mcp = await fetchStartupJobsMcp({ keywords: opts?.keywords });
            if (mcp.jobs.length)
                return mcp;
            const rss = await cachedRss(["startup_jobs"], force, cacheHit);
            return { jobs: rss.jobs, error: mcp.error || rss.error };
        });
        collected.push(...r.jobs);
        note("startup_jobs", r);
        if (r.error && !r.jobs.length)
            errors.push(`startup_jobs: ${r.error}`);
    }
    const wantRemocate = platforms?.includes("remocate") ||
        (Boolean(opts?.include_jobs) && !platforms?.length);
    if (wantRemocate) {
        const r = await cached("remocate", { keywords: opts?.keywords }, force, () => fetchRemocateJobs({ keywords: opts?.keywords }));
        collected.push(...r.jobs);
        note("remocate", r);
        if (r.error && !r.jobs.length)
            errors.push(`remocate: ${r.error}`);
    }
    if (platforms?.includes("jobsearchdb")) {
        const r = await cached("jobsearchdb", { keywords: opts?.keywords }, force, () => fetchJobSearchDbBoards({ keywords: opts?.keywords }));
        collected.push(...r.jobs);
        note("jobsearchdb", r);
        if (r.error && !r.jobs.length)
            errors.push(`jobsearchdb: ${r.error}`);
    }
    const regionalBoards = [
        { id: "justjoin_it", activeByDefault: true },
        { id: "budu_jobs", activeByDefault: true },
        { id: "jobio", activeByDefault: true },
        { id: "hiringcafe", activeByDefault: true },
        { id: "grepjob", activeByDefault: true },
        { id: "yc_work_at_startup", activeByDefault: false },
        { id: "wellfound", activeByDefault: false },
        { id: "lennys_jobs", activeByDefault: false },
        { id: "accel_jobs", activeByDefault: false },
        { id: "sequoia_jobs", activeByDefault: false },
        { id: "capitalg_jobs", activeByDefault: false },
        { id: "index_startup_jobs", activeByDefault: false },
        { id: "generalcatalyst_jobs", activeByDefault: false },
    ];
    for (const board of regionalBoards) {
        const platform = board.id;
        if (platforms?.length && !platforms.includes(platform))
            continue;
        if (!platforms?.length && !opts?.include_jobs)
            continue;
        if (!platforms?.length && !board.activeByDefault)
            continue;
        const r = await cached(platform, { keywords: opts?.keywords }, force, () => fetchRegionalBoardJobs(platform, { keywords: opts?.keywords }));
        collected.push(...r.jobs);
        note(platform, r);
        if (r.error && !r.jobs.length)
            errors.push(`${platform}: ${r.error}`);
    }
    // Product Hunt emits leads (`kind: "lead"`), not vacancies — opt-in only, the
    // same way the JobSpy boards are. A launch ranked next to a job posting is
    // noise, so it must never ride along on a bare include_jobs. Once
    // `include_leads` exists this moves behind that flag.
    if (platforms?.includes("producthunt")) {
        const r = await cached("producthunt", { keywords: opts?.keywords }, force, () => fetchProductHuntLeads({ keywords: opts?.keywords }));
        collected.push(...r.jobs);
        note("producthunt", r);
        // Named outright by the caller, so even the soft "no token" answer is what
        // they asked about — surface it rather than swallowing it.
        if (r.error)
            errors.push(r.error);
    }
    // Funding news, same lead contract as Product Hunt: opt-in by name only.
    if (platforms?.includes("funding")) {
        const r = await cached("funding", { keywords: opts?.keywords }, force, () => fetchFundingLeads({ keywords: opts?.keywords }));
        collected.push(...r.jobs);
        note("funding", r);
        if (r.error)
            errors.push(r.error);
    }
    // Product Hunt alternatives (Show HN + r/SideProject) — leads, opt-in by name.
    if (platforms?.includes("launches")) {
        const r = await cached("launches", { keywords: opts?.keywords }, force, () => fetchLaunchLeads({ keywords: opts?.keywords }));
        collected.push(...r.jobs);
        note("launches", r);
        if (r.error)
            errors.push(r.error);
    }
    // StartupRanking: same lead contract, plus a Cloudflare rotation inside the
    // adapter — cached hard, because a cleared challenge is worth reusing.
    if (platforms?.includes("startupranking")) {
        const r = await cached("startupranking", { keywords: opts?.keywords }, force, () => fetchStartupRankingLeads({ keywords: opts?.keywords }));
        collected.push(...r.jobs);
        note("startupranking", r);
        if (r.error)
            errors.push(r.error);
    }
    const modulesWanted = [];
    const wantKwork = opts?.includeKwork !== false &&
        (!platforms?.length || platforms.includes("kwork"));
    if (wantKwork)
        modulesWanted.push("kwork");
    const wantFh = opts?.include_freelancehunt !== false &&
        (!platforms?.length || platforms.includes("freelancehunt"));
    if (wantFh)
        modulesWanted.push("freelancehunt");
    if (opts?.include_jobs) {
        if (!platforms?.length || platforms.includes("hh"))
            modulesWanted.push("hh");
        if (!platforms?.length || platforms.includes("dreamoffer")) {
            modulesWanted.push("dreamoffer");
        }
        for (const board of JOB_BOARD_MODULES) {
            if (platforms?.length && !platforms.includes(board.platform))
                continue;
            if (board.metered &&
                !platforms?.includes(board.platform) &&
                process.env[board.metered] !== "1") {
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
    const wantUpwork = opts?.include_upwork !== false &&
        (!platforms?.length || platforms.includes("upwork"));
    if (wantUpwork)
        modulesWanted.push("upwork");
    const wantFln = opts?.include_freelancer !== false &&
        (!platforms?.length || platforms.includes("freelancer_com"));
    if (wantFln)
        modulesWanted.push("freelancer_com");
    if (modulesWanted.length) {
        const ensured = await ensurePlatforms(modulesWanted);
        for (const e of ensured.errors)
            errors.push(`adapter: ${e}`);
    }
    if (wantKwork) {
        const kw = await callFetchJobs("kwork");
        collected.push(...kw.jobs);
        if (kw.error && !softError(kw.error))
            errors.push(`kwork: ${kw.error}`);
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
            if (hh.error)
                errors.push(`hh: ${hh.error}`);
        }
        for (const board of JOB_BOARD_MODULES) {
            if (platforms?.length && !platforms.includes(board.platform))
                continue;
            if (board.metered &&
                !platforms?.includes(board.platform) &&
                process.env[board.metered] !== "1") {
                continue;
            }
            const params = board.keywords ? { keywords: opts.keywords } : {};
            const r = await cached(board.platform, params, force, () => callFetchJobs(board.module || board.platform, board.keywords ? { keywords: opts.keywords } : undefined));
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
            if (js.error)
                errors.push(`${p}: ${js.error}`);
        }
        if (!platforms?.length || platforms.includes("dreamoffer")) {
            const dream = await callFetchJobs("dreamoffer", {
                keywords: opts.keywords,
                limit: 30,
            });
            collected.push(...dream.jobs);
            if (dream.error)
                errors.push(`dreamoffer: ${dream.error}`);
        }
        // Employer ATS boards live in core: the company list is a repo file, so a
        // downloadable module would resolve it to its own install dir and find none.
        if (!platforms?.length || platforms.includes("ats")) {
            const r = await cached("ats", { keywords: opts.keywords }, force, () => fetchAtsJobs({ keywords: opts.keywords }));
            collected.push(...r.jobs);
            note("ats", r);
            if (r.error && !softError(r.error))
                errors.push(`ats: ${r.error}`);
        }
        if (!platforms?.length || platforms.includes("habr_career")) {
            const r = await cached("habr_career", { keywords: opts.keywords }, force, async () => {
                const habr = await fetchHabrCareerJobs({ keywords: opts.keywords });
                if (habr.jobs.length)
                    return habr;
                // The frontend JSON is unversioned — fall back to the RSS we used before.
                const rss = await fetchRssJobs(["habr_career"]);
                return {
                    jobs: rss.jobs,
                    error: rss.jobs.length ? undefined : habr.error,
                };
            });
            collected.push(...r.jobs);
            note("habr_career", r);
            if (r.error)
                errors.push(`habr_career: ${r.error}`);
        }
        // Asia — public APIs, no keys. Wired in core rather than as downloadable
        // modules so they work in a fresh checkout; moving them into the module
        // registry is a packing run, not a rewrite (see TODO).
        for (const board of ASIA_BOARDS) {
            if (platforms?.length && !platforms.includes(board.platform))
                continue;
            const r = await cached(board.platform, { keywords: opts.keywords }, force, () => board.fetch({ keywords: opts.keywords }));
            collected.push(...r.jobs);
            note(board.platform, r);
            if (r.error)
                errors.push(`${board.platform}: ${r.error}`);
        }
        const rssBoards = RSS_JOB_PLATFORMS.filter((id) => id !== "startup_jobs" && (!platforms?.length || platforms.includes(id)));
        if (rssBoards.length) {
            const r = await cachedRss(rssBoards, force, cacheHit);
            collected.push(...r.jobs);
            if (r.error)
                errors.push(r.error);
        }
    }
    if (opts?.include_agent_gigs) {
        for (const id of AGENT_GIG_PLATFORMS) {
            if (platforms?.length && !platforms.includes(id))
                continue;
            const r = await callFetchJobs(id);
            collected.push(...r.jobs);
            if (r.error && !softError(r.error))
                errors.push(`${id}: ${r.error}`);
        }
    }
    if (wantUpwork) {
        const uw = await callFetchJobs("upwork", { query: opts?.upwork_query });
        collected.push(...uw.jobs);
        if (uw.error && !softError(uw.error))
            errors.push(`upwork: ${uw.error}`);
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
    // Telegram folds into the same scan — no separate branch. It runs when the
    // caller names it explicitly (platforms includes "telegram"), OR on a full
    // scan (no platform filter) when the session is activated locally. The gate is
    // local-only (telegramActivated reads env + session file + channels, no
    // network), so a full scan for someone who never set up TG stays silent and
    // fast. The fetch itself is wrapped in a budget: getAuthState() and per-chat
    // search hit the network and can flood-wait for a minute, and the vacancy scan
    // must degrade to a soft error rather than hang on a throttled account.
    const wantTelegram = platforms?.includes("telegram") ||
        (!platforms?.length && telegramActivated());
    if (wantTelegram) {
        const tgKeywords = opts?.keywords?.length
            ? opts.keywords
            : opts?.upwork_query
                ? String(opts.upwork_query).split(/\s+/).filter((w) => w && w !== "OR")
                : undefined;
        const budgetMs = Math.max(Number(process.env.WORKIX_TG_SCAN_BUDGET_MS) || 90_000, 10_000);
        const tg = await Promise.race([
            fetchTelegramJobs({ keywords: tgKeywords }),
            new Promise((resolve) => setTimeout(() => resolve({
                jobs: [],
                error: `telegram: scan exceeded ${Math.round(budgetMs / 1000)}s budget — skipped (raise WORKIX_TG_SCAN_BUDGET_MS)`,
            }), budgetMs)),
        ]);
        collected.push(...tg.jobs);
        if (tg.error)
            errors.push(`telegram: ${tg.error}`);
    }
    // Multi-location boards hand back one row per city for the same posting —
    // collapse before the store learns them as separate cards (see dedupe.ts).
    const deduped = dedupeJobs(collected);
    const stored = upsertJobs(deduped.jobs);
    // Cheap and self-limiting: drops only rows already past their TTL.
    pruneCache();
    return {
        jobs: stored,
        errors,
        cached: fromCache,
        duplicates_collapsed: deduped.collapsed,
    };
}
