import { createHash } from "node:crypto";
import { db } from "./db.js";
/**
 * Cache of board responses, keyed by source + the parameters that shaped the
 * request. It lives in SQLite rather than in memory because every MCP session
 * is a separate process: without a shared cache, two sessions searching the same
 * thing hit all ~25 boards twice.
 *
 * TTL is per source class, not global. A public RSS feed can be re-read cheaply;
 * a metered API cannot, so JobsPipe gets a much longer default — a stale result
 * there costs nothing, a fresh one costs credits.
 */
const DEFAULT_TTL_MIN = 12;
/** Minutes, by platform. Anything unlisted uses DEFAULT_TTL_MIN. */
const TTL_MINUTES = {
    // Metered: one credit per row returned, so hold results far longer.
    jobspipe: 360,
    // Paid/keyed APIs with monthly call quotas.
    adzuna: 60,
    careerjet: 60,
    jooble: 60,
    usajobs: 60,
    superjob: 30,
    // Heavy payloads or slow origins — re-reading is expensive for everyone.
    ats: 45,
    nofluff: 30,
    trudvsem: 30,
    // Rate-limited feed: a second call inside a minute gets a 429 anyway.
    reddit: 20,
};
export function ttlMinutesFor(source) {
    const override = process.env[`WORKIX_CACHE_TTL_${source.toUpperCase()}`];
    const n = Number(override);
    if (Number.isFinite(n) && n >= 0)
        return n;
    const global = Number(process.env.WORKIX_CACHE_TTL_MIN);
    if (Number.isFinite(global) && global >= 0) {
        return TTL_MINUTES[source] ?? global;
    }
    return TTL_MINUTES[source] ?? DEFAULT_TTL_MIN;
}
/**
 * The key must carry every parameter that changes the answer, or the cache will
 * confidently serve someone else's search — Trudvsem keyed only by name would
 * return "разработчик" results to a query for "designer".
 */
export function cacheKey(source, params) {
    const normalized = JSON.stringify(params ?? {}, (_k, v) => Array.isArray(v) ? [...v].map(String).sort() : v);
    return `${source}:${createHash("sha1").update(normalized).digest("hex").slice(0, 20)}`;
}
export function readCache(source, params, opts) {
    if (opts?.force)
        return undefined;
    const ttl = ttlMinutesFor(source);
    if (ttl <= 0)
        return undefined;
    const row = db()
        .prepare("SELECT fetched_at, expires_at, payload FROM fetch_cache WHERE key = ?")
        .get(cacheKey(source, params));
    if (!row)
        return undefined;
    if (new Date(row.expires_at).getTime() <= Date.now())
        return undefined;
    try {
        const jobs = JSON.parse(row.payload);
        return {
            jobs,
            fetchedAt: row.fetched_at,
            ageMinutes: Math.round((Date.now() - new Date(row.fetched_at).getTime()) / 60000),
        };
    }
    catch {
        return undefined;
    }
}
export function writeCache(source, params, jobs) {
    const ttl = ttlMinutesFor(source);
    if (ttl <= 0)
        return;
    // An empty result is usually a transient block, not "this board is empty".
    // Caching it would hide the board for the whole TTL.
    if (!jobs.length)
        return;
    const now = new Date();
    db()
        .prepare(`INSERT INTO fetch_cache (key, source, fetched_at, expires_at, items, payload)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         fetched_at = excluded.fetched_at,
         expires_at = excluded.expires_at,
         items      = excluded.items,
         payload    = excluded.payload`)
        .run(cacheKey(source, params), source, now.toISOString(), new Date(now.getTime() + ttl * 60000).toISOString(), jobs.length, JSON.stringify(jobs));
}
export function pruneCache() {
    const res = db()
        .prepare("DELETE FROM fetch_cache WHERE expires_at < ?")
        .run(new Date().toISOString());
    return Number(res.changes);
}
export function clearCache(source) {
    const res = source
        ? db().prepare("DELETE FROM fetch_cache WHERE source = ?").run(source)
        : db().prepare("DELETE FROM fetch_cache").run();
    return Number(res.changes);
}
export function cacheStatus() {
    const now = new Date().toISOString();
    const conn = db();
    const entries = conn.prepare("SELECT COUNT(*) AS c FROM fetch_cache").get().c;
    const fresh = conn
        .prepare("SELECT COUNT(*) AS c FROM fetch_cache WHERE expires_at > ?")
        .get(now).c;
    const rows = conn
        .prepare(`SELECT source, COUNT(*) AS entries, SUM(items) AS items, MAX(fetched_at) AS newest
       FROM fetch_cache WHERE expires_at > ? GROUP BY source ORDER BY source`)
        .all(now);
    return {
        entries,
        fresh,
        sources: rows.map((r) => ({
            source: r.source,
            entries: r.entries,
            items: r.items || 0,
            ageMinutes: Math.round((Date.now() - new Date(r.newest).getTime()) / 60000),
            ttlMinutes: ttlMinutesFor(r.source),
        })),
    };
}
