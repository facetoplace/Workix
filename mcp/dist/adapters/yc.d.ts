import type { Job } from "../types.js";
/**
 * Y Combinator "Work at a Startup" — founding/CTO/agent-systems roles at YC
 * startups. The site is a login-gated SPA that blocks plain HTTP, so we read it
 * through the persistent `yc` browser profile (log in once via
 * scripts/board-open.mjs yc … + board-save.mjs yc). Filters locally by keyword.
 */
export declare function fetchYcJobs(opts?: {
    keywords?: string[];
    limit?: number;
    role?: string;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
