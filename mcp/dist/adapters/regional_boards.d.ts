import type { Job } from "../types.js";
export declare function fetchRegionalBoardJobs(platform: string, opts?: {
    keywords?: string[];
    limit?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
