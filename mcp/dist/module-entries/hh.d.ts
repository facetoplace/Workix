import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
export declare const meta: AdapterMeta;
export declare function fetchJobs(_ctx: AdapterContext, opts?: {
    text?: string;
    pages?: number;
}): Promise<{
    jobs: import("../types.js").Job[];
    error?: string;
}>;
