import type { Job } from "../types.js";
export declare function freelancehuntConfigured(): boolean;
export declare function fetchFreelancehuntJobs(): Promise<{
    jobs: Job[];
    error?: string;
}>;
/** Best-effort bid; API may require extra fields — fallback to browser on failure. */
export declare function freelancehuntBid(opts: {
    projectId: number;
    days: number;
    amount: number;
    currency: string;
    comment: string;
}): Promise<{
    ok: boolean;
    error?: string;
    raw?: unknown;
}>;
