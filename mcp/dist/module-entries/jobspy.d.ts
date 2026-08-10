import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
/**
 * One module, eight boards — all reached through the user's own jobspy install.
 *
 * The list is spelled out rather than referencing JOBSPY_PLATFORMS because
 * scripts/pack-adapters.mjs reads `platforms:` out of this file with a regex
 * and only understands a literal array; a variable silently degrades the
 * registry entry to `["jobspy"]`. Keep in sync with SITE_BY_PLATFORM — the
 * assertion below fails the build if they drift.
 */
export declare const meta: AdapterMeta;
export declare function configured(): Promise<boolean>;
export declare function fetchJobs(ctx: AdapterContext, opts?: Record<string, unknown>): Promise<{
    jobs: import("../types.js").Job[];
    error?: string;
}>;
