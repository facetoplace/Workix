import type { Job } from "./types.js";
export declare function ttlMinutesFor(source: string): number;
/**
 * The key must carry every parameter that changes the answer, or the cache will
 * confidently serve someone else's search — Trudvsem keyed only by name would
 * return "разработчик" results to a query for "designer".
 */
export declare function cacheKey(source: string, params?: unknown): string;
export interface CacheHit {
    jobs: Job[];
    fetchedAt: string;
    ageMinutes: number;
}
export declare function readCache(source: string, params?: unknown, opts?: {
    force?: boolean;
}): CacheHit | undefined;
export declare function writeCache(source: string, params: unknown, jobs: Job[]): void;
export declare function pruneCache(): number;
export declare function clearCache(source?: string): number;
export declare function cacheStatus(): {
    entries: number;
    fresh: number;
    sources: Array<{
        source: string;
        entries: number;
        items: number;
        ageMinutes: number;
        ttlMinutes: number;
    }>;
};
