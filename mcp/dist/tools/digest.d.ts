export declare function runDigest(args: {
    hours?: number;
    keywords?: string[];
    minus?: string[];
    platforms?: string[];
    limit?: number;
    only_new?: boolean;
    preset?: string;
    include_jobs?: boolean;
    include_agent_gigs?: boolean;
    include_services?: boolean;
    use_profile_filters?: boolean;
    /** Batch-share digest cards to Workix hub (no per-item confirm). Needs WORKIX_AGENT_KEY. */
    share_to_hub?: boolean;
}): Promise<unknown>;
