import type { Job } from "../types.js";
export declare function fetchSeekClawJobs(opts?: {
    limit?: number;
    offset?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
