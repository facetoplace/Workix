import type { Job } from "../types.js";
export declare function fetchDiceJobs(opts?: {
    keywords?: string[];
    limit?: number;
    hours?: number;
    location?: string;
    /** Keep only roles whose employer sponsors visas. */
    willingToSponsor?: boolean;
    remoteOnly?: boolean;
}): Promise<{
    jobs: Job[];
    error?: string;
    totalCount?: number;
}>;
