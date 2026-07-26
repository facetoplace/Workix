import type { Job } from "../types.js";
export declare function fetchRssJobs(platformIds?: string[]): Promise<{
    jobs: Job[];
    errors: {
        platform: string;
        error: string;
    }[];
}>;
export declare function pingRssPlatform(platformId: string): Promise<{
    platform: string;
    ok: boolean;
    status: number;
    ms: number;
    viaProxy: boolean;
    items?: number;
    error?: string;
}>;
