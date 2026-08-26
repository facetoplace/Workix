import type { Job } from "../types.js";
export declare function fetchAijobsJobs(opts?: {
    keywords?: string[];
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
