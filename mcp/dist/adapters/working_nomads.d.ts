import type { Job } from "../types.js";
export declare function fetchWorkingNomadsJobs(opts?: {
    category?: string;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
