import type { Job } from "../types.js";
export declare function fetchWantedlyJobs(opts?: {
    keywords?: string[];
    pages?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
    totalCount?: number;
}>;
export declare function pingWantedly(): Promise<{
    platform: string;
    ok: boolean;
    status: number;
    ms: number;
    viaProxy: boolean;
    items?: number;
    error?: string;
    source?: string;
}>;
