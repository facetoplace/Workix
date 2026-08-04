import type { Job } from "../types.js";
export declare function fetchGrowthTalentJobs(opts?: {
    limit?: number;
    pages?: number;
    remote?: boolean;
    q?: string;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
