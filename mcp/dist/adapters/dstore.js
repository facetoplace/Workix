/**
 * dStore public agent API — https://dstore.one/api.txt
 * Same surface as official dstore-mcp (search_catalog, get_app, get_similar, add_url, …).
 * Discovery: https://dstore.one/llms.txt
 */
import { fetchText } from "../http.js";
import { enrichApiError } from "../apiError.js";
export const DSTORE_DOCS = {
    api: "https://dstore.one/api.txt",
    llms: "https://dstore.one/llms.txt",
    llm_alias: "https://dstore.one/llm.txt",
    agent: "https://dstore.one/agent",
    storefront: "https://dstore.one",
    apiBase: "https://db.dstore.one",
    search: "https://db.dstore.one/api/search",
    similar: "https://db.dstore.one/api/similar",
    quota: "https://db.dstore.one/api/agent/quota",
    mcp: "dstore-mcp (stdio; tools search_catalog / get_app / get_similar / add_url / get_list / quota_status)",
};
function apiBase() {
    return String(process.env.DSTORE_API_BASE || DSTORE_DOCS.apiBase).replace(/\/$/, "");
}
function authHeaders() {
    const key = String(process.env.DSTORE_API_KEY || "").trim();
    const h = {
        Accept: "application/json",
        "User-Agent": "Workix-MCP/0.3 (+https://workix.co; dstore)",
    };
    if (key) {
        h.Authorization = `Bearer ${key}`;
        h["X-DStore-Key"] = key;
    }
    return h;
}
function normalizeProductUrl(raw) {
    let u = String(raw || "").trim();
    if (!u)
        return { error: "url required" };
    if (!/^https?:\/\//i.test(u))
        u = `https://${u}`;
    try {
        const parsed = new URL(u);
        if (!parsed.hostname)
            return { error: "invalid_url" };
        return parsed.toString();
    }
    catch {
        return { error: "invalid_url" };
    }
}
function parseJson(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        return { raw: text };
    }
}
async function dstoreGet(path, query) {
    const url = new URL(apiBase() + path);
    if (query) {
        for (const [k, v] of Object.entries(query)) {
            if (v == null || v === "")
                continue;
            url.searchParams.set(k, String(v));
        }
    }
    const res = await fetchText(url.toString(), {
        proxy: false,
        timeoutMs: 25000,
        headers: authHeaders(),
    });
    const body = parseJson(res.text);
    if (!res.ok) {
        const fallback = body?.message ||
            body?.error ||
            res.error ||
            `HTTP ${res.status}`;
        const enriched = enrichApiError({
            status: res.status,
            data: body,
            service: "dStore",
            fallbackError: fallback,
        });
        const retryAfterSec = typeof enriched.retryAfterSec === "number" ? enriched.retryAfterSec : undefined;
        const hint = typeof enriched.hint === "string" ? enriched.hint : undefined;
        return {
            ok: false,
            status: res.status,
            body,
            error: String(enriched.message || enriched.error || fallback),
            ...(enriched.rateLimited === true ? { rateLimited: true } : {}),
            ...(retryAfterSec != null ? { retryAfterSec } : {}),
            ...(enriched.limits != null ? { limits: enriched.limits } : {}),
            ...(hint ? { hint } : {}),
        };
    }
    return { ok: true, status: res.status, body };
}
function dstoreApiFail(r, extra) {
    return {
        ok: false,
        httpStatus: r.status,
        error: r.error,
        body: r.body,
        docs: DSTORE_DOCS,
        ...(r.rateLimited
            ? {
                rateLimited: true,
                retryAfterSec: r.retryAfterSec,
                limits: r.limits,
                hint: r.hint,
            }
            : {}),
        ...extra,
    };
}
/** Catalog search (semantic when embeddings exist). */
export async function dstoreSearch(args) {
    const q = String(args.q || "").trim();
    if (q.length < 2 && !args.tld) {
        return { ok: false, error: "q min 2 chars (or pass tld)", docs: DSTORE_DOCS };
    }
    const r = await dstoreGet("/api/search", {
        q: q || undefined,
        limit: args.limit,
        type: args.type,
        tg: args.tg ? "1" : undefined,
        tld: args.tld,
    });
    if (!r.ok) {
        return dstoreApiFail(r, {
            tip: r.hint || "Rate limit ~12 search/min anon. See workix_dstore_quota / upgrade_hint.",
        });
    }
    return {
        ok: true,
        ...r.body,
        docs: DSTORE_DOCS,
        tip: "Use sid → workix_dstore_get or workix_dstore_similar. Official MCP tool: search_catalog.",
    };
}
/** Stored-only similar apps (may be empty if not computed yet). */
export async function dstoreSimilar(args) {
    const sid = String(args.sid ?? "").trim();
    if (!/^\d+$/.test(sid)) {
        return { ok: false, error: "numeric sid required", docs: DSTORE_DOCS };
    }
    const r = await dstoreGet("/api/similar", { sid, limit: args.limit });
    if (!r.ok)
        return dstoreApiFail(r);
    return {
        ok: true,
        ...r.body,
        docs: DSTORE_DOCS,
        tip: "Empty similar[] = not ready yet; also check similar on full card JSON.",
    };
}
export async function dstoreQuota() {
    const r = await dstoreGet("/api/agent/quota");
    if (!r.ok)
        return dstoreApiFail(r);
    return { ok: true, ...r.body, docs: DSTORE_DOCS };
}
export async function dstoreGetList(args) {
    const ref = String(args.list_ref || "").trim();
    if (!ref)
        return { ok: false, error: "list_ref required", docs: DSTORE_DOCS };
    const r = await dstoreGet(`/list/${encodeURIComponent(ref)}.json`);
    if (!r.ok)
        return dstoreApiFail(r);
    return { ok: true, list: r.body, docs: DSTORE_DOCS };
}
/** Submit product URL into dStore catalog (rate-limited ~20/IP/hour). */
export async function dstorePublish(args) {
    const url = normalizeProductUrl(args.url);
    if (typeof url !== "string")
        return { ok: false, ...url, docs: DSTORE_DOCS };
    const r = await dstoreGet("/", { add: url });
    if (!r.ok) {
        return dstoreApiFail(r, {
            retry_after: r.body?.retry_after,
            tip: r.hint ||
                "Rate limit ~20 adds/IP/hour. Prefer reusing sid; do not re-add URL variants while polling.",
        });
    }
    const body = r.body;
    const sid = body?.sid;
    const status = body?.status;
    return {
        ok: true,
        status,
        sid,
        id: body?.id,
        productUrl: url,
        pageUrl: sid != null ? `${DSTORE_DOCS.storefront}/${sid}` : undefined,
        jsonUrl: sid != null ? `${DSTORE_DOCS.storefront}/${sid}.json` : undefined,
        note: status === "new"
            ? "Card created; enrichment may take 30–120s. Poll workix_dstore_get until title/icon ready."
            : status === "exist"
                ? "Already in catalog — reuse sid, do not create duplicates via URL variants."
                : "Found; refresh scheduled. Poll JSON until enrichment settles.",
        docs: DSTORE_DOCS,
        body,
    };
}
/** Read dStore card JSON by sid (or full https://dstore.one/{sid} URL). */
export async function dstoreGetCard(args) {
    let sid = args.sid != null ? String(args.sid).trim() : "";
    if (!sid && args.url) {
        const m = String(args.url).match(/dstore\.one\/(?:list\/)?(\d+)(?:\.json)?/i);
        if (m)
            sid = m[1];
        else {
            const bare = String(args.url).replace(/\.json$/i, "").trim();
            if (/^\d+$/.test(bare))
                sid = bare;
        }
    }
    if (!sid || !/^\d+$/.test(sid)) {
        return {
            ok: false,
            error: "Need numeric sid or dstore.one/{sid} URL",
            docs: DSTORE_DOCS,
        };
    }
    const r = await dstoreGet(`/${sid}.json`);
    if (!r.ok)
        return dstoreApiFail(r, { sid });
    const body = r.body;
    const title = body?.title;
    const icon = body?.icon;
    const ready = Boolean(title) && Boolean(icon);
    return {
        ok: true,
        sid: body?.sid ?? body?.id ?? Number(sid),
        ready,
        pageUrl: `${DSTORE_DOCS.storefront}/${sid}`,
        jsonUrl: `${DSTORE_DOCS.storefront}/${sid}.json`,
        card: body,
        tip: ready
            ? "Card enriched — open pageUrl for human check. Similar apps may be on card.similar."
            : "Still enriching — poll again in 5–10s (up to ~3 min). Do not re-call publish for the same URL.",
        docs: DSTORE_DOCS,
    };
}
