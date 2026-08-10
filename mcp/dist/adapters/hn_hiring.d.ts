import type { Job } from "../types.js";
export declare function fetchHnHiringJobs(opts?: {
    keywords?: string[];
    /** Postings to keep after filtering. */
    limit?: number;
    /** Read this thread instead of the current month, e.g. "48747976". */
    storyId?: string;
}): Promise<{
    jobs: Job[];
    error?: string;
    totalCount?: number;
}>;
