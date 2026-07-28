/**
 * Workix hub tools — startups / roles / profile / apply against central hub API.
 * Does NOT touch external freelance platforms.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "../env.js";
loadEnv();
const MCP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function apiBase() {
    return (process.env.WORKIX_API || process.env.WORKIX_HUB_API || "https://workix.co").replace(/\/$/, "");
}
function agentKey() {
    return process.env.WORKIX_AGENT_KEY || process.env.WORKIX_API_KEY || "";
}
/** Upsert WORKIX_AGENT_KEY in mcp/.env so the next process load picks it up. */
function persistAgentKey(key) {
    const envPath = join(MCP_ROOT, ".env");
    const line = `WORKIX_AGENT_KEY=${key}`;
    let body = "";
    if (existsSync(envPath)) {
        body = readFileSync(envPath, "utf8");
        if (/^WORKIX_AGENT_KEY=/m.test(body)) {
            body = body.replace(/^WORKIX_AGENT_KEY=.*$/m, line);
        }
        else {
            body = body.replace(/\s*$/, "\n") + line + "\n";
        }
    }
    else {
        body = line + "\n";
    }
    writeFileSync(envPath, body, "utf8");
    return { path: envPath, wrote: true };
}
async function hubFetch(path, opts = {}) {
    const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
    };
    if (opts.auth !== false) {
        const key = agentKey();
        if (!key) {
            return {
                ok: false,
                error: "WORKIX_AGENT_KEY missing. Register via UI or POST /api/v1/auth/register, then set env.",
            };
        }
        headers.Authorization = `Bearer ${key}`;
    }
    const res = await fetch(`${apiBase()}${path}`, {
        method: opts.method || "GET",
        headers,
        body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    }
    catch {
        data = { raw: text };
    }
    if (!res.ok) {
        return {
            ok: false,
            status: res.status,
            error: data?.error || res.statusText,
            data,
        };
    }
    return { ok: true, status: res.status, data };
}
export async function hubHealth() {
    return hubFetch("/api/v1/health", { auth: false });
}
export async function hubRegister() {
    return hubFetch("/api/v1/auth/register", { method: "POST", body: {}, auth: false });
}
export async function hubMe() {
    return hubFetch("/api/v1/me");
}
/**
 * Rotate hub agent API key. Old key stops working immediately.
 * Requires confirm:true. By default writes the new key to mcp/.env and process.env.
 */
export async function hubRotateAgentKey(args = {}) {
    if (args.confirm !== true) {
        return {
            ok: false,
            error: "Refused: set confirm:true. This revokes the current WORKIX_AGENT_KEY and returns a new wix_… key once.",
        };
    }
    const res = await hubFetch("/api/v1/me/agent-key/rotate", { method: "POST", body: {} });
    if (!res.ok)
        return res;
    const data = (res.data || {});
    const agentApiKey = data.agentApiKey || "";
    if (!agentApiKey) {
        return { ok: false, error: "Hub returned no agentApiKey", data: res.data };
    }
    process.env.WORKIX_AGENT_KEY = agentApiKey;
    delete process.env.WORKIX_API_KEY;
    const persist = args.persist_env !== false;
    let persisted = null;
    if (persist) {
        try {
            persisted = persistAgentKey(agentApiKey);
        }
        catch (e) {
            return {
                ok: true,
                status: res.status,
                agentApiKey,
                hasAgentKey: true,
                persistedEnv: false,
                warning: `Key rotated, but mcp/.env write failed: ${e.message}. Save agentApiKey to WORKIX_AGENT_KEY manually.`,
            };
        }
    }
    return {
        ok: true,
        status: res.status,
        agentApiKey,
        hasAgentKey: true,
        persistedEnv: !!persisted?.wrote,
        envPath: persisted?.path,
        note: "Previous key revoked. Save agentApiKey; it is shown only once.",
    };
}
export async function hubListMyStartups() {
    return hubFetch("/api/v1/startups?mine=true");
}
function absHubUrl(pathOrUrl) {
    const raw = String(pathOrUrl || "").trim();
    if (!raw)
        return "";
    if (/^https?:\/\//i.test(raw))
        return raw;
    if (raw.startsWith("//"))
        return `https:${raw}`;
    const base = apiBase();
    return raw.startsWith("/") ? `${base}${raw}` : `${base}/${raw}`;
}
/** Agent-friendly absolute URLs on nested hub entities. */
function withHubUrls(item, kind) {
    if (!item || typeof item !== "object")
        return item || null;
    const out = { ...item };
    if (typeof out.url === "string" && out.url.startsWith("/")) {
        out.url = absHubUrl(out.url);
    }
    if (kind === "project" && out.slug) {
        out.pageUrl = absHubUrl(`/${out.slug}`);
    }
    else if (kind === "order") {
        out.pageUrl = absHubUrl(`/order/${out.sid || out.id}`);
    }
    else if (kind === "performer" || kind === "publisher") {
        out.pageUrl = absHubUrl(`/performer/${out.performerId || out.id || out.userId}`);
    }
    else if (kind === "role") {
        if (out.startupSlug) {
            out.pageUrl = absHubUrl(`/${out.startupSlug}/${out.slug || out.id}`);
        }
        else if (out.id) {
            out.pageUrl = absHubUrl(`/#/role/${out.id}`);
        }
    }
    return out;
}
export async function hubListStartups(args = {}) {
    const qs = new URLSearchParams();
    if (args.q)
        qs.set("q", args.q);
    if (args.limit != null)
        qs.set("limit", String(args.limit));
    if (args.offset != null)
        qs.set("offset", String(args.offset));
    const q = qs.toString();
    return hubFetch(`/api/v1/startups${q ? `?${q}` : ""}`, { auth: false });
}
export async function hubGetStartup(args) {
    const res = await hubFetch(`/api/v1/startups/${encodeURIComponent(args.slug)}`, { auth: false });
    if (!res.ok)
        return res;
    const data = (res.data || {});
    const publisher = data.publisher
        ? withHubUrls(data.publisher, "publisher")
        : null;
    let roles;
    if (args.include_roles !== false) {
        const rolesRes = await hubListRoles({ startup: args.slug });
        if (rolesRes.ok) {
            const payload = rolesRes.data;
            const items = Array.isArray(payload)
                ? payload
                : Array.isArray(payload?.items)
                    ? payload.items
                    : [];
            roles = items.map((r) => withHubUrls(r, "role"));
        }
    }
    return {
        ...res,
        data: {
            ...data,
            pageUrl: absHubUrl(`/${data.slug || args.slug}`),
            publisher,
            roles: roles || data.roles || undefined,
            note: publisher
                ? "publisher is a platform performer — open pageUrl / workix_get_performer"
                : "no public publisher card (hub-sync / aggregator listing)",
        },
    };
}
export async function hubListPerformers(args = {}) {
    const qs = new URLSearchParams();
    if (args.q)
        qs.set("q", args.q);
    if (args.tags?.length)
        qs.set("tags", args.tags.join(","));
    if (args.limit != null)
        qs.set("limit", String(args.limit));
    if (args.offset != null)
        qs.set("offset", String(args.offset));
    const q = qs.toString();
    return hubFetch(`/api/v1/performers${q ? `?${q}` : ""}`, { auth: false });
}
export async function hubGetPerformer(args) {
    const res = await hubFetch(`/api/v1/performers/${encodeURIComponent(args.id)}`, { auth: false });
    if (!res.ok)
        return res;
    const data = (res.data || {});
    const projects = Array.isArray(data.projects)
        ? data.projects.map((p) => withHubUrls(p, "project"))
        : [];
    const orders = Array.isArray(data.orders)
        ? data.orders.map((o) => withHubUrls(o, "order"))
        : [];
    const roles = Array.isArray(data.roles)
        ? data.roles.map((r) => withHubUrls(r, "role"))
        : [];
    return {
        ...res,
        data: {
            ...data,
            pageUrl: absHubUrl(`/performer/${data.id || args.id}`),
            projects,
            orders,
            roles,
            note: "projects/orders/roles are this performer's public listings — follow pageUrl or workix_get_startup / workix_get_hub_order",
        },
    };
}
export async function hubListOrders(args = {}) {
    const qs = new URLSearchParams();
    if (args.q)
        qs.set("q", args.q);
    if (args.limit != null)
        qs.set("limit", String(args.limit));
    if (args.offset != null)
        qs.set("offset", String(args.offset));
    if (args.publisher)
        qs.set("publisher", args.publisher);
    const q = qs.toString();
    return hubFetch(`/api/v1/orders${q ? `?${q}` : ""}`, { auth: false });
}
export async function hubGetOrder(args) {
    const res = await hubFetch(`/api/v1/orders/${encodeURIComponent(args.id)}`, { auth: false });
    if (!res.ok)
        return res;
    const data = (res.data || {});
    const scraped = !!data.scraped;
    const publisher = !scraped && data.publisher
        ? withHubUrls(data.publisher, "publisher")
        : null;
    return {
        ...res,
        data: {
            ...data,
            scraped,
            publisher,
            pageUrl: absHubUrl(String(data.url || `/order/${data.sid || data.id || args.id}`)),
            note: scraped
                ? "scraped/aggregator order — no publisher performer card"
                : publisher
                    ? "publisher is a platform performer — workix_get_performer"
                    : "no publisher on this order",
        },
    };
}
export async function hubCreateStartup(args) {
    return hubFetch("/api/v1/startups", { method: "POST", body: args });
}
export async function hubUpdateStartup(args) {
    const { slug, ...body } = args;
    return hubFetch(`/api/v1/startups/${encodeURIComponent(slug)}`, { method: "PATCH", body });
}
export async function hubListRoles(args = {}) {
    const qs = new URLSearchParams();
    if (args.startup)
        qs.set("startup", args.startup);
    if (args.q)
        qs.set("q", args.q);
    if (args.mine)
        qs.set("mine", "true");
    const q = qs.toString();
    return hubFetch(`/api/v1/roles${q ? `?${q}` : ""}`, { auth: args.mine ? true : false });
}
export async function hubCreateRole(args) {
    return hubFetch("/api/v1/roles", { method: "POST", body: args });
}
export async function hubUpdateRole(args) {
    const { id, ...body } = args;
    return hubFetch(`/api/v1/roles/${encodeURIComponent(id)}`, { method: "PATCH", body });
}
export async function hubGetProfile() {
    return hubFetch("/api/v1/profile");
}
export async function hubUpdateProfile(args) {
    return hubFetch("/api/v1/profile", { method: "PATCH", body: args });
}
export async function hubApply(args) {
    return hubFetch("/api/v1/applies", { method: "POST", body: args });
}
/** Bug / suggestion / support → hub admin Telegram (rate-limited). */
export async function hubFeedback(args) {
    const key = agentKey();
    return hubFetch("/api/v1/feedback", {
        method: "POST",
        body: args,
        auth: !!key,
    });
}
