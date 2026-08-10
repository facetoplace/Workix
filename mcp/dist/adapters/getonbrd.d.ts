import type { Job } from "../types.js";
export declare function fetchGetOnBrdJobs(opts?: {
    query?: string;
    perPage?: number;
    remoteOnly?: boolean;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
