import type { Job } from "../types.js";
export declare function fetchLandingJobs(opts?: {
    remoteOnly?: boolean;
    keywords?: string[];
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
