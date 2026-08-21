import type { Job } from "../types.js";
export declare function fetchTheHubJobs(opts?: {
    keywords?: string[];
    limit?: number;
    pages?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
