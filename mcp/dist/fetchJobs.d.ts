import type { Job } from "./types.js";
export declare function refreshJobs(opts?: {
    platforms?: string[];
    includeKwork?: boolean;
    include_jobs?: boolean;
    include_agent_gigs?: boolean;
    include_freelancehunt?: boolean;
    include_upwork?: boolean;
    include_freelancer?: boolean;
    hh_text?: string;
    upwork_query?: string;
    freelancer_query?: string;
    /** Passed to adapters that support text filter (e.g. Dream Offer). */
    keywords?: string[];
}): Promise<{
    jobs: Job[];
    errors: string[];
}>;
