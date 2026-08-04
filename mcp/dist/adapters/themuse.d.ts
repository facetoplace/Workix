import type { Job } from "../types.js";
export declare function fetchTheMuseJobs(opts?: {
    pages?: number;
    category?: string;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
