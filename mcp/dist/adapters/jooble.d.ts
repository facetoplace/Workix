import type { Job } from "../types.js";
export declare function joobleConfigured(): boolean;
export declare function fetchJoobleJobs(opts?: {
    keywords?: string;
    location?: string;
    page?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
    totalCount?: number;
}>;
