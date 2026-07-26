import type { Job } from "../types.js";
export declare function fetchHhJobs(opts?: {
    text?: string;
    pages?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
