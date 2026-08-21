import type { Job } from "./types.js";
/**
 * `collapsed` counts the rows dropped, so callers can say what was hidden
 * instead of silently shrinking the list.
 */
export declare function dedupeJobs(jobs: Job[]): {
    jobs: Job[];
    collapsed: number;
};
