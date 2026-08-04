import type { Job } from "../types.js";
export declare function fetchTelegramJobs(opts?: {
    keywords?: string[];
    limit?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
