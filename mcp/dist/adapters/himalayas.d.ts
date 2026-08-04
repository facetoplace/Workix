import type { Job } from "../types.js";
export declare function fetchHimalayasJobs(opts?: {
    limit?: number;
    pages?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
