import type { Job } from "./types.js";
export declare function refreshJobs(opts?: {
    platforms?: string[];
    includeKwork?: boolean;
    include_jobs?: boolean;
    include_freelancehunt?: boolean;
    include_upwork?: boolean;
    include_freelancer?: boolean;
    hh_text?: string;
    upwork_query?: string;
    freelancer_query?: string;
}): Promise<{
    jobs: Job[];
    errors: string[];
}>;
