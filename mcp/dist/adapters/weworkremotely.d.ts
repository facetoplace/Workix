import type { Job } from "../types.js";
export declare function fetchWeWorkRemotelyJobs(opts?: {
    category?: string;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
