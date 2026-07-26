import type { Job } from "../types.js";
export declare function freelancerConfigured(): boolean;
export declare function fetchFreelancerJobs(opts?: {
    query?: string;
    limit?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
export declare function freelancerPlaceBid(opts: {
    projectId: number;
    amount: number;
    period: number;
    description: string;
}): Promise<{
    ok: boolean;
    error?: string;
    raw?: unknown;
}>;
export declare function freelancerProjectId(job: Job): number | undefined;
