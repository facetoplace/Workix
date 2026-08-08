/**
 * Workix hub tools — startups / roles / profile / apply against central hub API.
 * Does NOT touch external freelance platforms.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "../env.js";
import { enrichApiError } from "../apiError.js";
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
        return enrichApiError({
            status: res.status,
            data,
            retryAfterHeader: res.headers.get("retry-after"),
            service: "workix hub",
            fallbackError: data?.error || res.statusText,
        });
    }
    return { ok: true, status: res.status, data };
}
export async function hubHealth() {
    return hubFetch("/api/v1/health", { auth: false });
}
export async function hubRegister() {
    const res = await hubFetch("/api/v1/auth/register", { method: "POST", body: {}, auth: false });
    if (!res.ok)
        return res;
    return {
        ...res,
        tip: "Next: save agentApiKey as WORKIX_AGENT_KEY, then create a performer card with workix_update_profile (name, headline, bio, skills, openTo, slug). Share https://workix.co/{slug}; free CV PDF https://workix.co/{slug}/pdf.",
    };
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
        const pid = out.performerId || out.id || out.userId;
        if (out.slug) {
            out.pageUrl = absHubUrl(`/${out.slug}`);
            out.pdfUrl = absHubUrl(`/${out.slug}/pdf`);
        }
        else if (pid) {
            out.pageUrl = absHubUrl(`/performer/${pid}`);
            out.pdfUrl = absHubUrl(`/performer/${pid}/pdf`);
        }
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
    const pageUrl = data.slug
        ? absHubUrl(`/${data.slug}`)
        : absHubUrl(`/performer/${data.id || args.id}`);
    const pdfUrl = data.slug
        ? absHubUrl(`/${data.slug}/pdf`)
        : absHubUrl(`/performer/${data.id || args.id}/pdf`);
    return {
        ...res,
        data: {
            ...data,
            pageUrl,
            pdfUrl,
            projects,
            orders,
            roles,
            note: `Shareable profile: ${pageUrl}. Free CV/resume PDF: ${pdfUrl}. Own card: workix_update_profile (+ slug). Listings: pageUrl or workix_get_startup / workix_get_hub_order.`,
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
            note: data.external
                ? "external board mirror — see external.platform/url/contributedBy; no personal publisher card"
                : scraped
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
export async function hubUpdateOrder(args) {
    const { id, ...body } = args;
    return hubFetch(`/api/v1/orders/${encodeURIComponent(id)}`, { method: "PATCH", body });
}
/** Share external board jobs into hub catalog (auto publisher + meta.external). */
export async function hubShareOrders(items) {
    return hubFetch("/api/v1/orders/share", { method: "POST", body: { items } });
}
function withProfileUrls(data) {
    if (!data || typeof data !== "object")
        return data || null;
    const slug = typeof data.slug === "string" ? data.slug.trim().toLowerCase() : "";
    const id = data.id || data.userId || data.performerId;
    const pageUrl = slug
        ? absHubUrl(`/${slug}`)
        : id
            ? absHubUrl(`/performer/${id}`)
            : undefined;
    const pdfUrl = slug
        ? absHubUrl(`/${slug}/pdf`)
        : id
            ? absHubUrl(`/performer/${id}/pdf`)
            : undefined;
    return {
        ...data,
        ...(pageUrl ? { pageUrl } : {}),
        ...(pdfUrl ? { pdfUrl } : {}),
        tip: "Tell the user: shareable profile pageUrl; free ready-made CV/resume PDF at pdfUrl (no paywall).",
        note: slug
            ? `Share profile: ${pageUrl}. Free CV PDF: ${pdfUrl}. Rename slug with workix_update_profile when free.`
            : 'No vanity slug yet — set via workix_update_profile (e.g. slug:"devstorm") for https://workix.co/{slug} + free CV https://workix.co/{slug}/pdf. Must be free (not a project or another performer).',
    };
}
export async function hubGetProfile() {
    const res = await hubFetch("/api/v1/profile");
    if (!res.ok)
        return res;
    return { ...res, data: withProfileUrls((res.data || {})) };
}
export async function hubUpdateProfile(args) {
    const res = await hubFetch("/api/v1/profile", { method: "PATCH", body: args });
    if (!res.ok) {
        const err = String(res.error || "").toLowerCase();
        if (res.status === 409 || err.includes("slug taken")) {
            return {
                ...res,
                error: "Slug taken — choose another (shared namespace with projects and other performers).",
                hint: "Pick a free slug, e.g. workix_update_profile { slug: \"your-name\" }. Check with workix_get_startup / workix_get_performer first.",
            };
        }
        if (res.status === 400 && (err.includes("slug reserved") || err.includes("invalid slug"))) {
            return {
                ...res,
                error: res.error || "Invalid or reserved slug",
                hint: "Use lowercase latin, digits, hyphens; min 2 chars; not a reserved path (api, performer, order, …).",
            };
        }
        return res;
    }
    return { ...res, data: withProfileUrls((res.data || {})) };
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
