import type { Job } from "../types.js";
export declare function fetchHabrCareerJobs(opts?: {
    pages?: number;
    remoteOnly?: boolean;
    keywords?: string[];
}): Promise<{
    jobs: Job[];
    error?: string;
    totalCount?: number;
}>;
