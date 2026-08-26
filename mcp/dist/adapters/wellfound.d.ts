import type { Job } from "../types.js";
/**
 * Wellfound (AngelList Talent) — startup + co-founder/CTO roles. Login-gated,
 * Cloudflare-fronted SPA, so we read it through the persistent `wellfound`
 * browser profile (log in once via scripts/board-open.mjs wellfound … +
 * board-save.mjs wellfound). Scrolls to lazy-load the list, filters by keyword.
 */
export declare function fetchWellfoundJobs(opts?: {
    keywords?: string[];
    limit?: number;
    role?: string;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
