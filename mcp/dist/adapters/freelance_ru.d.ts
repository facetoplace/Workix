import type { Job } from "../types.js";
/** Freelance.ru: RSS often 404; HTML /task works via RU SOCKS5 (PROXY_1). */
export declare function fetchFreelanceRuJobs(): Promise<{
    jobs: Job[];
    error?: string;
    viaProxy?: boolean;
    source?: string;
}>;
export declare function pingFreelanceRu(): Promise<{
    platform: string;
    ok: boolean;
    status: number;
    ms: number;
    viaProxy: boolean;
    items?: number;
    error?: string;
    source?: string;
}>;
