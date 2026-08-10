import type { Job } from "../types.js";
export declare function fetchNoFluffJobs(opts?: {
    category?: string;
    region?: string;
    remoteOnly?: boolean;
    keywords?: string[];
    limit?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
    totalCount?: number;
}>;
