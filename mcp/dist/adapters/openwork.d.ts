import type { Job } from "../types.js";
export declare function fetchOpenworkJobs(opts?: {
    openOnly?: boolean;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
