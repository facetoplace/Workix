import { callFetchJobs, getAdapter } from "../adapterLoader.js";
import { loadAtsCompanies } from "../adapters/ats.js";
import { jobspipeUsage } from "../adapters/jobspipe.js";
import { pingProductRadar } from "../adapters/product_radar.js";
import { pingRssPlatform } from "../adapters/rss.js";
import { loadEnv } from "../env.js";
import { proxyPoolInfo } from "../proxyPool.js";
/** Boards that stay dark until their key is in env — and where to get one. */
const KEYED_BOARDS = [
    {
        platform: "adzuna",
        env: ["ADZUNA_APP_ID", "ADZUNA_APP_KEY"],
        signup: "https://developer.adzuna.com/",
    },
    {
        // Their dashboard spells it JOBS_PIPE_KEY; either name works.
        platform: "jobspipe",
        env: ["JOBSPIPE_API_KEY|JOBS_PIPE_KEY"],
        signup: "https://jobspipe.dev/agent",
    },
    {
        platform: "usajobs",
        env: ["USAJOBS_API_KEY", "USAJOBS_EMAIL"],
        signup: "https://developer.usajobs.gov/apirequest/",
    },
    {
        platform: "superjob",
        env: ["SUPERJOB_APP_ID"],
        signup: "https://api.superjob.ru/",
    },
    {
        platform: "careerjet",
        env: ["CAREERJET_AFFID"],
        signup: "https://www.careerjet.com/partners/",
    },
    {
        platform: "jooble",
        env: ["JOOBLE_API_KEY"],
        signup: "https://jooble.org/api/about",
    },
];
export async function runSourcesStatus() {
    loadEnv();
    const pool = await proxyPoolInfo();
    const rssIds = [
        "fl_ru",
        "freelance_ru",
        "weblancer_net",
        "habr_career",
        "djinni",
        "jobspresso",
        "reddit",
    ];
    const rss = await Promise.all(rssIds.map((id) => pingRssPlatform(id)));
    const product_radar = await pingProductRadar();
    // Key-gated boards: read env rather than loading the modules, so status stays
    // instant and works before the adapter registry has been published.
    // "A|B" means either name is accepted; a bare name is required.
    const keyed = KEYED_BOARDS.map((b) => ({
        platform: b.platform,
        configured: b.env.every((slot) => slot.split("|").some((k) => Boolean(process.env[k]?.trim()))),
        env: b.env,
        signup: b.signup,
    }));
    const atsCompanies = loadAtsCompanies();
    const kworkMod = await getAdapter("kwork");
    const kworkConfigured = typeof kworkMod?.configured === "function" ? kworkMod.configured() : false;
    let kwork = { configured: kworkConfigured, skipped: true };
    if (kworkConfigured) {
        const started = Date.now();
        const r = await callFetchJobs("kwork");
        kwork = {
            configured: true,
            ok: !r.error || r.jobs.length > 0,
            items: r.jobs.length,
            ms: Date.now() - started,
            error: r.error,
            viaProxy: pool.count > 0,
        };
    }
    const fhMod = await getAdapter("freelancehunt");
    const fhConfigured = typeof fhMod?.configured === "function" ? fhMod.configured() : false;
    let freelancehunt = { configured: fhConfigured, skipped: true };
    if (fhConfigured) {
        const started = Date.now();
        const r = await callFetchJobs("freelancehunt");
        freelancehunt = {
            configured: true,
            ok: !r.error || r.jobs.length > 0,
            items: r.jobs.length,
            ms: Date.now() - started,
            error: r.error,
        };
    }
    const uwMod = await getAdapter("upwork");
    const upworkConfigured = typeof uwMod?.configured === "function" ? uwMod.configured() : false;
    let upwork = { configured: upworkConfigured, skipped: true };
    if (upworkConfigured) {
        const started = Date.now();
        const r = await callFetchJobs("upwork", { first: 5 });
        const companySelector = uwMod?.companySelector;
        const orgs = companySelector ? await companySelector() : null;
        upwork = {
            configured: true,
            ok: !r.error || r.jobs.length > 0,
            items: r.jobs.length,
            totalCount: r.totalCount,
            ms: Date.now() - started,
            error: r.error,
            company_selector: orgs,
        };
    }
    const flnMod = await getAdapter("freelancer");
    const freelancerConfigured = typeof flnMod?.configured === "function" ? flnMod.configured() : false;
    let freelancer_com = {
        configured: freelancerConfigured,
        skipped: true,
    };
    if (freelancerConfigured) {
        const started = Date.now();
        const r = await callFetchJobs("freelancer", { limit: 5 });
        freelancer_com = {
            configured: true,
            ok: !r.error || r.jobs.length > 0,
            items: r.jobs.length,
            ms: Date.now() - started,
            error: r.error,
        };
    }
    const okCount = rss.filter((r) => r.ok).length;
    const keyedOn = keyed.filter((k) => k.configured).length;
    return {
        proxy_pool: pool,
        rss,
        product_radar,
        kwork,
        freelancehunt,
        upwork,
        freelancer_com,
        ats: {
            companies: atsCompanies.length,
            providers: [...new Set(atsCompanies.map((c) => c.ats))],
            note: "Employer boards from mcp/ats-companies.json (or ATS_COMPANIES env)",
        },
        keyed_boards: keyed,
        jobspipe: jobspipeUsage(),
        adapters: {
            note: "Heavy board adapters are downloaded from the hub registry on first use",
        },
        summary: `RSS ok ${okCount}/${rss.length}; product_radar=${product_radar.ok ? "ok" : "fail"}; upwork=${upworkConfigured ? "on" : "off"}; freelancer=${freelancerConfigured ? "on" : "off"}; keyed boards ${keyedOn}/${keyed.length}; ats companies ${atsCompanies.length}`,
    };
}
