import type { Job } from "../types.js";
export declare function fetchKalibrrJobs(opts?: {
    keywords?: string[];
    limit?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
    totalCount?: number;
}>;
export declare function pingKalibrr(): Promise<{
    platform: string;
    ok: boolean;
    status: number;
    ms: number;
    viaProxy: boolean;
    items?: number;
    error?: string;
    source?: string;
}>;
