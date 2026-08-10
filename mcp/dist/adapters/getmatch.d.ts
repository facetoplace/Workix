import type { Job } from "../types.js";
export declare function fetchGetmatchJobs(opts?: {
    keywords?: string[];
    /** Cards to read from the board before filtering. */
    limit?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
    totalCount?: number;
}>;
