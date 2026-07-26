import type { Job } from "../types.js";
export declare function kworkConfigured(): boolean;
export declare function fetchKworkJobs(): Promise<{
    jobs: Job[];
    error?: string;
}>;
export declare function kworkGetMe(): Promise<unknown>;
