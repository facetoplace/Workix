import type { Job } from "../types.js";
export declare function usajobsConfigured(): boolean;
export declare function fetchUsaJobs(opts?: {
    keyword?: string;
    resultsPerPage?: number;
    remoteOnly?: boolean;
}): Promise<{
    jobs: Job[];
    error?: string;
    totalCount?: number;
}>;
