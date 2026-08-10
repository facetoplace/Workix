import type { Job } from "../types.js";
export declare function careerjetConfigured(): boolean;
export declare function fetchCareerjetJobs(opts?: {
    keywords?: string;
    location?: string;
    locale?: string;
    pageSize?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
    totalCount?: number;
}>;
