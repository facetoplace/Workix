import type { Job } from "../types.js";
/** JobSearchDB is a human-curated directory, so its useful output is leads to
 * specialized boards; it must not be treated as a vacancy feed. */
export declare function fetchJobSearchDbBoards(opts?: {
    keywords?: string[];
    limit?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
