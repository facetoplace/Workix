import type { Job } from "../types.js";
interface Row {
    slug: string;
    name: string;
    rank?: number;
    score?: string;
    description?: string;
    country?: string;
}
export declare function parseRankingRows(html: string): Row[];
export declare function fetchStartupRankingLeads(opts?: {
    limit?: number;
    keywords?: string[];
    path?: string;
    attempts?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
    tries?: number;
}>;
export declare function pingStartupRanking(): Promise<{
    platform: string;
    ok: boolean;
    status: number;
    ms: number;
    viaProxy: boolean;
    items?: number;
    error?: string;
    source?: string;
}>;
export {};
