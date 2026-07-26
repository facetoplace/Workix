import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import type { Job } from "../types.js";
export declare const meta: AdapterMeta;
export declare function configured(): boolean;
export declare function fetchJobs(_ctx: AdapterContext, opts?: {
    query?: string;
    limit?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
export declare function placeBid(_ctx: AdapterContext, opts: {
    projectId: number;
    amount: number;
    period: number;
    description: string;
}): Promise<{
    ok: boolean;
    error?: string;
    raw?: unknown;
}>;
export declare function projectId(job: Job): number | undefined;
