import type { Job } from "../types.js";
export declare function superjobConfigured(): boolean;
export declare function fetchSuperJobJobs(opts?: {
    keyword?: string;
    count?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
    totalCount?: number;
}>;
