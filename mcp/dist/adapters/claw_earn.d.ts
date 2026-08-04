import type { Job } from "../types.js";
export declare function fetchClawEarnJobs(opts?: {
    tab?: string;
    limit?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
