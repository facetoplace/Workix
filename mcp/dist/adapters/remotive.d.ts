import type { Job } from "../types.js";
export declare function fetchRemotiveJobs(opts?: {
    category?: string;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
