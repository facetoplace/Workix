export declare function runSearch(args: {
    keywords?: string[];
    minus?: string[];
    platforms?: string[];
    since?: string;
    hours?: number;
    limit?: number;
    offset?: number;
    refresh?: boolean;
    include_jobs?: boolean;
    include_agent_gigs?: boolean;
    /** Ignore the shared fetch cache and re-read every source from the network. */
    force_refresh?: boolean;
}): Promise<unknown>;
