import type { Job } from "../types.js";
export declare function fetchRemocateJobs(opts?: {
    keywords?: string[];
    limit?: number;
    pages?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
