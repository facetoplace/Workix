import type { Job } from "../types.js";
export declare function looksLikeFunding(title: string): boolean;
export declare function parseHeadline(title: string): {
    company?: string;
    amount?: string;
    stage?: string;
};
/** Funding announcements from the news feeds, as lead cards. */
export declare function fetchFundingLeads(opts?: {
    limit?: number;
    keywords?: string[];
}): Promise<{
    jobs: Job[];
    error?: string;
    feeds?: number;
}>;
export declare function pingFunding(): Promise<{
    platform: string;
    ok: boolean;
    status: number;
    ms: number;
    viaProxy: boolean;
    items?: number;
    error?: string;
    source?: string;
}>;
