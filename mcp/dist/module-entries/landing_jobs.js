import { fetchLandingJobs } from "../adapters/landing_jobs.js";
export const meta = {
    id: "landing_jobs",
    version: "1.0.0",
    platforms: ["landing_jobs"],
    envKeys: ["LANDING_JOBS_REMOTE_ONLY"],
};
export async function fetchJobs(_ctx, opts) {
    return fetchLandingJobs({
        keywords: Array.isArray(opts?.keywords)
            ? opts.keywords
            : undefined,
    });
}
