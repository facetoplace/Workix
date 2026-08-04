import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
export declare const meta: AdapterMeta;
export declare function configured(): boolean;
export declare function fetchJobs(_ctx: AdapterContext, opts?: Record<string, unknown>): Promise<{
    jobs: import("../types.js").Job[];
    error?: string;
    totalCount?: number;
}>;
