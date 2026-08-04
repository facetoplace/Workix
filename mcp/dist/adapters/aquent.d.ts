import type { Job } from "../types.js";
export declare function fetchAquentJobs(opts?: {
    count?: number;
    remoteOnly?: boolean;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
