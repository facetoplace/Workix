import type { Job } from "../types.js";
export declare function fetchJobicyJobs(opts?: {
    count?: number;
    tag?: string;
    geo?: string;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
