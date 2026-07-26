import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
export declare const meta: AdapterMeta;
export declare function configured(): boolean;
export declare function fetchJobs(_ctx: AdapterContext): Promise<{
    jobs: import("../types.js").Job[];
    error?: string;
}>;
export declare function bid(_ctx: AdapterContext, opts: {
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
