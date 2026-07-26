import type { Job } from "../types.js";
export declare function fetchRemoteOkJobs(): Promise<{
    jobs: Job[];
    error?: string;
}>;
