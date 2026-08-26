import type { Job } from "../types.js";
export declare function fetchReactJobs(opts?: {
    keywords?: string[];
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
