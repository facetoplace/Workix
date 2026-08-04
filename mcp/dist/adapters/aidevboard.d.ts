import type { Job } from "../types.js";
export declare function fetchAidevboardJobs(opts?: {
    pages?: number;
    limit?: number;
    q?: string;
    tags?: string;
    workplace?: string;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
