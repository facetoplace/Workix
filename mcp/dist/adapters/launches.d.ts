import type { Job } from "../types.js";
/** Show HN + r/SideProject launches as lead cards. */
export declare function fetchLaunchLeads(opts?: {
    limit?: number;
    keywords?: string[];
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
export declare function pingLaunches(): Promise<{
    platform: string;
    ok: boolean;
    status: number;
    ms: number;
    viaProxy: boolean;
    items?: number;
    error?: string;
    source?: string;
}>;
