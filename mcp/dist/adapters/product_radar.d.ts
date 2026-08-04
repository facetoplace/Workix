import type { Job } from "../types.js";
/** Product Radar «Набираю людей в команду» — HTML pages with pagination. */
export declare function fetchProductRadarJobs(opts?: {
    maxPages?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
    pages?: number;
    viaProxy?: boolean;
}>;
export declare function pingProductRadar(): Promise<{
    platform: string;
    ok: boolean;
    status: number;
    ms: number;
    viaProxy: boolean;
    items?: number;
    error?: string;
    source?: string;
}>;
