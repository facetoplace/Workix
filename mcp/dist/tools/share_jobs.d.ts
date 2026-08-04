import type { Job } from "../types.js";
export declare function runShareJobs(args: {
    job_ids?: string[];
    jobs?: Job[];
    /** Re-POST even if local store already marked hubShare (hub may still skip as exists). */
    force?: boolean;
}): Promise<unknown>;
export declare function runHubShareStatus(args: {
    limit?: number;
    platform?: string;
}): Promise<unknown>;
