import { JOBSPY_PLATFORMS, fetchJobSpyJobs, jobspyAvailable, } from "../adapters/jobspy.js";
/**
 * One module, eight boards — all reached through the user's own jobspy install.
 *
 * The list is spelled out rather than referencing JOBSPY_PLATFORMS because
 * scripts/pack-adapters.mjs reads `platforms:` out of this file with a regex
 * and only understands a literal array; a variable silently degrades the
 * registry entry to `["jobspy"]`. Keep in sync with SITE_BY_PLATFORM — the
 * assertion below fails the build if they drift.
 */
export const meta = {
    id: "jobspy",
    version: "1.1.0",
    platforms: [
        "indeed",
        "glassdoor",
        "ziprecruiter",
        "naukri",
        "bdjobs",
        "google_jobs",
        "bayt",
        "linkedin",
    ],
    envKeys: ["PYTHON_BIN", "JOBSPY_LINKEDIN_DESCRIPTIONS"],
};
if (meta.platforms.length !== JOBSPY_PLATFORMS.length ||
    meta.platforms.some((p) => !JOBSPY_PLATFORMS.includes(p))) {
    throw new Error(`jobspy: meta.platforms [${meta.platforms}] out of sync with the adapter [${JOBSPY_PLATFORMS}]`);
}
export async function configured() {
    return jobspyAvailable(process.env);
}
export async function fetchJobs(ctx, opts) {
    const platform = typeof opts?.platform === "string" ? opts.platform : "indeed";
    return fetchJobSpyJobs({
        env: ctx.env,
        platform,
        what: typeof opts?.what === "string" ? opts.what : undefined,
        location: typeof opts?.location === "string" ? opts.location : undefined,
        hours: typeof opts?.hours === "number" ? opts.hours : undefined,
        limit: typeof opts?.limit === "number" ? opts.limit : undefined,
        proxies: Array.isArray(opts?.proxies)
            ? opts.proxies.filter((p) => typeof p === "string")
            : undefined,
    });
}
