/**
 * Visibility and housekeeping for the local SQLite store: what is in it, what
 * the shared fetch cache is currently serving, and the two prunes.
 */
export declare function runStoreStatus(args?: {
    /** Delete cached rows whose TTL has passed. */
    prune_cache?: boolean;
    /** Drop cards older than N days that carry no work (no share, draft, outreach). */
    prune_jobs_days?: number;
    /** Drop cached responses for one source, or all of them when "all". */
    clear_cache?: string;
}): Promise<unknown>;
