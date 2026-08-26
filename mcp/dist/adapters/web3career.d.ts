import type { Job } from "../types.js";
export declare function fetchWeb3CareerJobs(opts?: {
    keywords?: string[];
    pages?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
