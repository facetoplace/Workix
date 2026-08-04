import type { Job } from "./types.js";
/** Host capabilities passed into downloadable adapter modules. */
export interface AdapterContext {
    dataDir: string;
    env: NodeJS.ProcessEnv;
    log: (msg: string) => void;
}
export interface AdapterMeta {
    id: string;
    version: string;
    platforms: string[];
    envKeys?: string[];
    minCore?: string;
}
export interface FetchJobsResult {
    jobs: Job[];
    error?: string;
    totalCount?: number;
}
export interface AdapterModule {
    meta: AdapterMeta;
    fetchJobs: (ctx: AdapterContext, opts?: Record<string, unknown>) => Promise<FetchJobsResult>;
    configured?: () => boolean;
    /** Optional board-specific helpers (submit, OAuth, …). */
    [key: string]: unknown;
}
export interface RegistryModule {
    id: string;
    version: string;
    platforms: string[];
    sha256: string;
    url: string;
    minCore?: string;
    envKeys?: string[];
}
export interface AdapterRegistry {
    updated: string;
    baseUrl: string;
    modules: RegistryModule[];
}
/** Platforms served by core RSS adapter (never downloaded). */
export declare const CORE_RSS_PLATFORMS: readonly ["fl_ru", "freelance_ru", "weblancer_net"];
/** Default module id for a platform id (when platforms.json has no module field). */
export declare const PLATFORM_MODULE_MAP: Record<string, string>;
/** Agent/gig marketplaces — pulled when include_agent_gigs is set. */
export declare const AGENT_GIG_PLATFORMS: readonly ["growth_talent", "claw_earn", "seekclaw", "superteam_earn", "rentahuman", "openwork"];
