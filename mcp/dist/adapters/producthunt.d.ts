import type { Job } from "../types.js";
export declare function productHuntConfigured(): boolean;
/** Newest Product Hunt launches as lead cards. */
export declare function fetchProductHuntLeads(opts?: {
    limit?: number;
    keywords?: string[];
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
export declare function pingProductHunt(): Promise<{
    platform: string;
    ok: boolean;
    status: number;
    ms: number;
    viaProxy: boolean;
    items?: number;
    error?: string;
    source?: string;
}>;
