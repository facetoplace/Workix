export declare function runCollect(args: {
    keywords?: string[];
    include_jobs?: boolean;
    include_agent_gigs?: boolean;
    tg_days?: number;
    skip_http?: boolean;
    skip_telegram?: boolean;
    force_refresh?: boolean;
}): Promise<unknown>;
export declare function runDbSearch(args: {
    query?: string;
    keywords?: string[];
    platforms?: string[];
    days?: number;
    hours?: number;
    limit?: number;
    hide_applied?: boolean;
    include_resumes?: boolean;
}): Promise<unknown>;
