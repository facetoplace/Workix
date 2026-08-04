import type { Job } from "../types.js";
export declare function adzunaConfigured(): boolean;
export declare function fetchAdzunaJobs(opts?: {
    what?: string;
    country?: string;
    page?: number;
    resultsPerPage?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
    totalCount?: number;
}>;
