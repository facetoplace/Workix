import type { Job } from "../types.js";
export declare function superteamEarnConfigured(): boolean;
export declare function fetchSuperteamEarnJobs(opts?: {
    take?: number;
    type?: string;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
