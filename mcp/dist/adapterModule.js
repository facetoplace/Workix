/** Platforms served by core RSS adapter (never downloaded). */
export const CORE_RSS_PLATFORMS = [
    "fl_ru",
    "freelance_ru",
    "weblancer_net",
];
/** Default module id for a platform id (when platforms.json has no module field). */
export const PLATFORM_MODULE_MAP = {
    kwork: "kwork",
    freelancehunt: "freelancehunt",
    hh: "hh",
    remoteok: "remoteok",
    remotive: "remotive",
    arbeitnow: "arbeitnow",
    adzuna: "adzuna",
    himalayas: "himalayas",
    weworkremotely: "weworkremotely",
    jobicy: "jobicy",
    working_nomads: "working_nomads",
    themuse: "themuse",
    four_day_week: "four_day_week",
    aidevboard: "aidevboard",
    aquent: "aquent",
    trudvsem: "trudvsem",
    nofluff: "nofluff",
    landing_jobs: "landing_jobs",
    getonbrd: "getonbrd",
    getmatch: "getmatch",
    hn_hiring: "hn_hiring",
    dice: "dice",
    workopia: "workopia",
    jobspipe: "jobspipe",
    usajobs: "usajobs",
    superjob: "superjob",
    careerjet: "careerjet",
    jooble: "jooble",
    growth_talent: "growth_talent",
    claw_earn: "claw_earn",
    seekclaw: "seekclaw",
    superteam_earn: "superteam_earn",
    rentahuman: "rentahuman",
    openwork: "openwork",
    upwork: "upwork",
    freelancer_com: "freelancer",
    dstore: "dstore",
    telegram: "telegram",
};
/**
 * Feed-only job boards served by the core RSS adapter on `include_jobs`.
 * No module, no key — the URL lives in platforms.json.
 * `reddit` is one multireddit feed, not one platform per subreddit.
 */
export const RSS_JOB_PLATFORMS = [
    "djinni",
    "jobspresso",
    "reddit",
    "dribbble_jobs",
    "startup_jobs",
    "jobscollider",
];
/**
 * Job boards pulled on `include_jobs`, in digest order.
 *
 * `opts` is a fixed payload; boards that need per-call context (hh text,
 * Dream Offer keywords, the JobSpy bridge) stay wired by hand in fetchJobs.
 * `soft` marks boards that skip quietly when their key is absent, so an
 * unkeyed install does not fill the digest with noise about optional sources.
 */
export const JOB_BOARD_MODULES = [
    { platform: "remoteok" },
    { platform: "remotive" },
    { platform: "arbeitnow" },
    { platform: "adzuna", soft: true },
    { platform: "himalayas" },
    { platform: "weworkremotely" },
    { platform: "jobicy" },
    { platform: "working_nomads" },
    { platform: "themuse" },
    { platform: "four_day_week" },
    { platform: "aidevboard" },
    { platform: "aquent" },
    { platform: "trudvsem", keywords: true },
    { platform: "nofluff", keywords: true },
    { platform: "landing_jobs", keywords: true },
    { platform: "getonbrd", keywords: true },
    { platform: "getmatch", keywords: true },
    { platform: "hn_hiring", keywords: true },
    { platform: "dice", keywords: true },
    { platform: "workopia", soft: true, keywords: true },
    {
        platform: "jobspipe",
        soft: true,
        keywords: true,
        metered: "JOBSPIPE_IN_DIGEST",
    },
    { platform: "usajobs", soft: true, keywords: true },
    { platform: "superjob", soft: true, keywords: true },
    { platform: "careerjet", soft: true, keywords: true },
    { platform: "jooble", soft: true, keywords: true },
];
/** Agent/gig marketplaces — pulled when include_agent_gigs is set. */
export const AGENT_GIG_PLATFORMS = [
    "growth_talent",
    "claw_earn",
    "seekclaw",
    "superteam_earn",
    "rentahuman",
    "openwork",
];
