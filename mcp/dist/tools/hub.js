/**
 * Workix hub tools — startups / roles / profile / apply against central hub API.
 * Does NOT touch external freelance platforms.
 */
import { loadEnv } from "../env.js";
loadEnv();
function apiBase() {
    return (process.env.WORKIX_API || process.env.WORKIX_HUB_API || "https://workix.co").replace(/\/$/, "");
}
function agentKey() {
    return process.env.WORKIX_AGENT_KEY || process.env.WORKIX_API_KEY || "";
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
export async function hubListMyStartups() {
    return hubFetch("/api/v1/startups?mine=true");
}
export async function hubListStartups(args = {}) {
    const qs = new URLSearchParams();
    if (args.q)
        qs.set("q", args.q);
    const q = qs.toString();
    return hubFetch(`/api/v1/startups${q ? `?${q}` : ""}`, { auth: false });
}
export async function hubGetStartup(args) {
    return hubFetch(`/api/v1/startups/${encodeURIComponent(args.slug)}`, { auth: false });
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
