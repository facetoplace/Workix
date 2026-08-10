import type { Job } from "../types.js";
export declare function fetchTrudvsemJobs(opts?: {
    text?: string;
    keywords?: string[];
    region?: string;
    limit?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
    totalCount?: number;
}>;
