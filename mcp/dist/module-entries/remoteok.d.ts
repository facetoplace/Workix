import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
export declare const meta: AdapterMeta;
export declare function fetchJobs(_ctx: AdapterContext): Promise<{
    jobs: import("../types.js").Job[];
    error?: string;
}>;
