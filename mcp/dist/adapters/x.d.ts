import type { Job } from "../types.js";
/**
 * X (Twitter) — hiring tweets and founder/co-founder posts as outbound leads.
 * X killed cheap API access and its search is login-walled, so — like Avito — the
 * adapter is double-gated: it runs solely when the caller names `x` AND sets
 * X_ENABLE=1, and it never applies (DM / reply stays manual in the browser). It
 * reads the live-search timeline from the logged-in `x` browser profile (log in
 * once via scripts/board-open.mjs x https://x.com/home + board-save.mjs x),
 * emits kind:"lead", and filters locally by keyword.
 *
 * X_QUERIES overrides the search set ('<label>::<query>' entries, ';'-separated);
 * X_QUERY is a single-lane shorthand; X_URL pins one search page verbatim.
 */
export declare function fetchXLeads(opts?: {
    keywords?: string[];
    limit?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
