import { statSync } from "node:fs";
import { join } from "node:path";
import { cacheStatus, clearCache, pruneCache } from "../fetchCache.js";
import { dataDir, pruneJobs, storeStats } from "../store.js";
/**
 * Visibility and housekeeping for the local SQLite store: what is in it, what
 * the shared fetch cache is currently serving, and the two prunes.
 */
export async function runStoreStatus(args) {
    const dir = dataDir();
    const actions = {};
    if (args?.clear_cache) {
        const source = args.clear_cache.trim().toLowerCase();
        actions.cleared =
            source === "all" ? clearCache() : clearCache(source);
        actions.cleared_source = source;
    }
    if (args?.prune_cache) {
        actions.expired_removed = pruneCache();
    }
    if (typeof args?.prune_jobs_days === "number") {
        actions.jobs_pruned = pruneJobs({ days: args.prune_jobs_days });
    }
    let dbBytes = 0;
    try {
        dbBytes = statSync(join(dir, "workix.db")).size;
    }
    catch {
        /* first run */
    }
    const cache = cacheStatus();
    return {
        data_dir: dir,
        db_file: "workix.db",
        db_size_mb: Number((dbBytes / 1048576).toFixed(1)),
        rows: storeStats(),
        cache: {
            entries: cache.entries,
            fresh: cache.fresh,
            sources: cache.sources,
            note: "TTL is per source; metered boards (jobspipe) are held far longer. Override with WORKIX_CACHE_TTL_<SOURCE> in minutes, or 0 to disable.",
        },
        ...(Object.keys(actions).length ? { actions } : {}),
        hints: [
            "force_refresh: true on workix_digest / workix_search bypasses the cache for one run",
            "WORKIX_JOB_TTL_DAYS (default 30) sets how long cards without attached work are kept",
        ],
    };
}
