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
  return (process.env.WORKIX_API || process.env.WORKIX_HUB_API || "https://workix.co").replace(
    /\/$/,
    "",
  );
}

function agentKey() {
  return process.env.WORKIX_AGENT_KEY || process.env.WORKIX_API_KEY || "";
}

/** Upsert WORKIX_AGENT_KEY in mcp/.env so the next process load picks it up. */
function persistAgentKey(key: string): { path: string; wrote: boolean } {
  const envPath = join(MCP_ROOT, ".env");
  const line = `WORKIX_AGENT_KEY=${key}`;
  let body = "";
  if (existsSync(envPath)) {
    body = readFileSync(envPath, "utf8");
    if (/^WORKIX_AGENT_KEY=/m.test(body)) {
      body = body.replace(/^WORKIX_AGENT_KEY=.*$/m, line);
    } else {
      body = body.replace(/\s*$/, "\n") + line + "\n";
    }
  } else {
    body = line + "\n";
  }
  writeFileSync(envPath, body, "utf8");
  return { path: envPath, wrote: true };
}

async function hubFetch(path: string, opts: { method?: string; body?: unknown; auth?: boolean } = {}) {
  const headers: Record<string, string> = {
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
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    return enrichApiError({
      status: res.status,
      data,
      retryAfterHeader: res.headers.get("retry-after"),
      service: "workix hub",
      fallbackError: (data as { error?: string })?.error || res.statusText,
    });
  }
  return { ok: true, status: res.status, data };
}

export async function hubHealth() {
  return hubFetch("/api/v1/health", { auth: false });
}

export async function hubRegister() {
  const res = await hubFetch("/api/v1/auth/register", { method: "POST", body: {}, auth: false });
  if (!res.ok) return res;
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
export async function hubRotateAgentKey(args: {
  confirm?: boolean;
  persist_env?: boolean;
} = {}) {
  if (args.confirm !== true) {
    return {
      ok: false,
      error:
        "Refused: set confirm:true. This revokes the current WORKIX_AGENT_KEY and returns a new wix_… key once.",
    };
  }
  const res = await hubFetch("/api/v1/me/agent-key/rotate", { method: "POST", body: {} });
  if (!res.ok) return res;
  const data = (res.data || {}) as { agentApiKey?: string; hasAgentKey?: boolean };
  const agentApiKey = data.agentApiKey || "";
  if (!agentApiKey) {
    return { ok: false, error: "Hub returned no agentApiKey", data: res.data };
  }
  process.env.WORKIX_AGENT_KEY = agentApiKey;
  delete process.env.WORKIX_API_KEY;
  const persist = args.persist_env !== false;
  let persisted: { path: string; wrote: boolean } | null = null;
  if (persist) {
    try {
      persisted = persistAgentKey(agentApiKey);
    } catch (e) {
      return {
        ok: true,
        status: res.status,
        agentApiKey,
        hasAgentKey: true,
        persistedEnv: false,
        warning: `Key rotated, but mcp/.env write failed: ${(e as Error).message}. Save agentApiKey to WORKIX_AGENT_KEY manually.`,
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

function absHubUrl(pathOrUrl: string | undefined | null) {
  const raw = String(pathOrUrl || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  const base = apiBase();
  return raw.startsWith("/") ? `${base}${raw}` : `${base}/${raw}`;
}

type HubEntityKind = "project" | "order" | "performer" | "role" | "publisher";

/** Agent-friendly absolute URLs on nested hub entities. */
function withHubUrls<T extends Record<string, unknown>>(
  item: T | null | undefined,
  kind: HubEntityKind,
): T | null {
  if (!item || typeof item !== "object") return item || null;
  const out: Record<string, unknown> = { ...item };
  if (typeof out.url === "string" && out.url.startsWith("/")) {
    out.url = absHubUrl(out.url);
  }
  if (kind === "project" && out.slug) {
    out.pageUrl = absHubUrl(`/${out.slug}`);
  } else if (kind === "order") {
    out.pageUrl = absHubUrl(`/order/${out.sid || out.id}`);
  } else if (kind === "performer" || kind === "publisher") {
    const pid = out.performerId || out.id || out.userId;
    if (out.slug) {
      out.pageUrl = absHubUrl(`/${out.slug}`);
      out.pdfUrl = absHubUrl(`/${out.slug}/pdf`);
    } else if (pid) {
      out.pageUrl = absHubUrl(`/performer/${pid}`);
      out.pdfUrl = absHubUrl(`/performer/${pid}/pdf`);
    }
  } else if (kind === "role") {
    if (out.startupSlug) {
      out.pageUrl = absHubUrl(`/${out.startupSlug}/${out.slug || out.id}`);
    } else if (out.id) {
      out.pageUrl = absHubUrl(`/#/role/${out.id}`);
    }
  }
  return out as T;
}

export async function hubListStartups(args: { q?: string; limit?: number; offset?: number } = {}) {
  const qs = new URLSearchParams();
  if (args.q) qs.set("q", args.q);
  if (args.limit != null) qs.set("limit", String(args.limit));
  if (args.offset != null) qs.set("offset", String(args.offset));
  const q = qs.toString();
  return hubFetch(`/api/v1/startups${q ? `?${q}` : ""}`, { auth: false });
}

export async function hubGetStartup(args: { slug: string; include_roles?: boolean }) {
  const res = await hubFetch(`/api/v1/startups/${encodeURIComponent(args.slug)}`, { auth: false });
  if (!res.ok) return res;
  const data = (res.data || {}) as Record<string, unknown>;
  const publisher = data.publisher
    ? withHubUrls(data.publisher as Record<string, unknown>, "publisher")
    : null;
  let roles: unknown[] | undefined;
  if (args.include_roles !== false) {
    const rolesRes = await hubListRoles({ startup: args.slug });
    if (rolesRes.ok) {
      const payload = rolesRes.data as { items?: unknown[] } | unknown[] | null;
      const items = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
          ? payload.items
          : [];
      roles = items.map((r) => withHubUrls(r as Record<string, unknown>, "role"));
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

export async function hubListPerformers(args: {
  q?: string;
  tags?: string[];
  collab?: string[];
  limit?: number;
  offset?: number;
} = {}) {
  const qs = new URLSearchParams();
  if (args.q) qs.set("q", args.q);
  if (args.tags?.length) qs.set("tags", args.tags.join(","));
  if (args.collab?.length) qs.set("collab", args.collab.join(","));
  if (args.limit != null) qs.set("limit", String(args.limit));
  if (args.offset != null) qs.set("offset", String(args.offset));
  const q = qs.toString();
  return hubFetch(`/api/v1/performers${q ? `?${q}` : ""}`, { auth: false });
}

export async function hubGetPerformer(args: { id: string }) {
  const res = await hubFetch(`/api/v1/performers/${encodeURIComponent(args.id)}`, { auth: false });
  if (!res.ok) return res;
  const data = (res.data || {}) as Record<string, unknown>;
  const projects = Array.isArray(data.projects)
    ? data.projects.map((p) => withHubUrls(p as Record<string, unknown>, "project"))
    : [];
  const orders = Array.isArray(data.orders)
    ? data.orders.map((o) => withHubUrls(o as Record<string, unknown>, "order"))
    : [];
  const roles = Array.isArray(data.roles)
    ? data.roles.map((r) => withHubUrls(r as Record<string, unknown>, "role"))
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

export async function hubListOrders(args: {
  q?: string;
  limit?: number;
  offset?: number;
  publisher?: string;
} = {}) {
  const qs = new URLSearchParams();
  if (args.q) qs.set("q", args.q);
  if (args.limit != null) qs.set("limit", String(args.limit));
  if (args.offset != null) qs.set("offset", String(args.offset));
  if (args.publisher) qs.set("publisher", args.publisher);
  const q = qs.toString();
  return hubFetch(`/api/v1/orders${q ? `?${q}` : ""}`, { auth: false });
}

export async function hubGetOrder(args: { id: string }) {
  const res = await hubFetch(`/api/v1/orders/${encodeURIComponent(args.id)}`, { auth: false });
  if (!res.ok) return res;
  const data = (res.data || {}) as Record<string, unknown>;
  const scraped = !!data.scraped;
  const publisher = !scraped && data.publisher
    ? withHubUrls(data.publisher as Record<string, unknown>, "publisher")
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
          ? "scraped/aggregator order — no publisher participant card"
          : publisher
            ? "publisher is a platform participant — workix_get_performer"
            : "no publisher on this order",
    },
  };
}

export type InfoLink = { label?: string; url: string; kind?: string };

export type ProjectStage =
  | "idea"
  | "stealth"
  | "preseed"
  | "seed"
  | "mvp"
  | "early"
  | "growth"
  | "scale"
  | "mature"
  | "project";

export async function hubCreateStartup(args: {
  name: string;
  description?: string;
  slug?: string;
  url?: string;
  logo?: string;
  links?: Array<InfoLink | string>;
  tags?: string[];
  stage?: ProjectStage;
  status?: "draft" | "pending";
  applyDefaults?: Record<string, string>;
}) {
  return hubFetch("/api/v1/startups", { method: "POST", body: args });
}

export async function hubUpdateStartup(args: {
  slug: string;
  /** Rename project URL when the new slug is free. */
  newSlug?: string;
  name?: string;
  description?: string;
  url?: string;
  logo?: string;
  links?: Array<InfoLink | string>;
  tags?: string[];
  stage?: ProjectStage;
  status?: "draft" | "pending" | "active" | "approved" | "closed" | "frozen";
  applyDefaults?: Record<string, string>;
}) {
  const { slug, ...body } = args;
  return hubFetch(`/api/v1/startups/${encodeURIComponent(slug)}`, { method: "PATCH", body });
}

/**
 * "Delete" a company/startup card from the catalog. This is a SOFT close: the
 * listing is flipped to status "closed" (hidden from the public catalog) via the
 * owner-permitted PATCH. The row is kept — full hard delete (removing roles and
 * applications for good) is admin-only on the server (DELETE /startups/:slug).
 */
export async function hubDeleteStartup(args: { slug: string }) {
  const res = await hubFetch(`/api/v1/startups/${encodeURIComponent(args.slug)}`, {
    method: "PATCH",
    body: { status: "closed" },
  });
  if (!res.ok) return res;
  return {
    ...res,
    note: "Soft close: listing set to status=closed and hidden from the public catalog. The card is kept; permanent deletion is admin-only.",
  };
}

export async function hubListRoles(args: { startup?: string; q?: string; mine?: boolean } = {}) {
  const qs = new URLSearchParams();
  if (args.startup) qs.set("startup", args.startup);
  if (args.q) qs.set("q", args.q);
  if (args.mine) qs.set("mine", "true");
  const q = qs.toString();
  return hubFetch(`/api/v1/roles${q ? `?${q}` : ""}`, { auth: args.mine ? true : false });
}

export async function hubCreateRole(args: {
  startupId?: string;
  title: string;
  description?: string;
  slug?: string;
  kind?: string;
  project?: string;
  payment?: { budget?: string | number; type?: string; cur?: string };
  apply_url?: string;
  apply_email?: string;
  apply_telegram?: string;
  links?: Array<InfoLink | string>;
  tags?: string[];
  status?: "draft" | "pending";
}) {
  return hubFetch("/api/v1/roles", { method: "POST", body: args });
}

export async function hubUpdateRole(args: {
  id: string;
  title?: string;
  description?: string;
  kind?: string;
  project?: string;
  payment?: { budget?: string | number; type?: string; cur?: string };
  apply_url?: string;
  apply_email?: string;
  apply_telegram?: string;
  links?: Array<InfoLink | string>;
  tags?: string[];
  status?: "draft" | "pending" | "active" | "approved" | "closed" | "frozen";
}) {
  const { id, ...body } = args;
  return hubFetch(`/api/v1/roles/${encodeURIComponent(id)}`, { method: "PATCH", body });
}

export async function hubUpdateOrder(args: {
  id: string;
  title?: string;
  description?: string;
  kind?: string;
  project?: string;
  payment?: { budget?: string | number; type?: string; cur?: string };
  links?: Array<InfoLink | string>;
  tags?: string[];
  status?: "draft" | "pending" | "active" | "approved" | "closed" | "frozen";
}) {
  const { id, ...body } = args;
  return hubFetch(`/api/v1/orders/${encodeURIComponent(id)}`, { method: "PATCH", body });
}

/** Share external board jobs into hub catalog (auto publisher + meta.external). */
export async function hubShareOrders(
  items: Array<{
    title: string;
    description?: string;
    platform: string;
    url: string;
    externalId?: string;
    kind?: string;
    originalPublishedAt?: string;
    date?: string;
    budget?: string;
    payment?: { budget?: string | number; type?: string; cur?: string };
    tags?: string[];
  }>,
) {
  return hubFetch("/api/v1/orders/share", { method: "POST", body: { items } });
}

function withProfileUrls(data: Record<string, unknown> | null | undefined) {
  if (!data || typeof data !== "object") return data || null;
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
      : 'No vanity slug yet — set via workix_update_profile (e.g. slug:"username") for https://workix.co/{slug} + free CV https://workix.co/{slug}/pdf. Must be free (not a project or another performer).',
  };
}

export async function hubGetProfile() {
  const res = await hubFetch("/api/v1/profile");
  if (!res.ok) return res;
  return { ...res, data: withProfileUrls((res.data || {}) as Record<string, unknown>) };
}

export async function hubUpdateProfile(args: Record<string, unknown>) {
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
  return { ...res, data: withProfileUrls((res.data || {}) as Record<string, unknown>) };
}

export async function hubBumpProfile() {
  const res = await hubFetch("/api/v1/profile/bump", { method: "POST", body: {} });
  if (!res.ok) return res;
  return { ...res, data: withProfileUrls((res.data || {}) as Record<string, unknown>) };
}

export async function hubApply(args: {
  roleId: string;
  name?: string;
  contact?: string;
  message?: string;
  Description?: string;
  Interesity?: number;
  Difficulty?: number;
  Understandability?: number;
  Budget?: string | number;
  Currency?: string;
  Time?: number;
}) {
  return hubFetch("/api/v1/applies", { method: "POST", body: args });
}

/** Funnel used by the hub application tracker (lib/hub-applications.js). */
export type ApplicationStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "reply"
  | "interview"
  | "offer"
  | "hired"
  | "rejected"
  | "closed";

/**
 * Record "the user applied to this job" on the hub. A raw board job
 * (url + platform + title) is mirrored into the catalog first, so tracking an
 * apply also publishes the listing. Idempotent per listing.
 */
export async function hubRecordApplication(args: {
  orderId?: string;
  roleId?: string;
  url?: string;
  platform?: string;
  externalId?: string;
  title?: string;
  description?: string;
  kind?: string;
  budget?: string;
  tags?: string[];
  originalPublishedAt?: string;
  status?: ApplicationStatus | string;
  channel?: string;
  via?: "agent" | "user" | "web";
  text?: string;
  textSource?: "agent" | "user";
  note?: string;
  appliedAt?: string;
}) {
  return hubFetch("/api/v1/applications", { method: "POST", body: args });
}

/** The caller's own applications — cross-device history, with the sent texts. */
export async function hubListApplications(args: {
  status?: string;
  q?: string;
  url?: string;
  orderId?: string;
  roleId?: string;
  since?: string;
  limit?: number;
  offset?: number;
  with_text?: boolean;
} = {}) {
  const qs = new URLSearchParams();
  if (args.status) qs.set("status", args.status);
  if (args.q) qs.set("q", args.q);
  if (args.url) qs.set("url", args.url);
  if (args.orderId) qs.set("orderId", args.orderId);
  if (args.roleId) qs.set("roleId", args.roleId);
  if (args.since) qs.set("since", args.since);
  if (args.limit != null) qs.set("limit", String(args.limit));
  if (args.offset != null) qs.set("offset", String(args.offset));
  if (args.with_text === false) qs.set("with_text", "0");
  const q = qs.toString();
  return hubFetch(`/api/v1/applications${q ? `?${q}` : ""}`);
}

/** Move an application along the funnel, or attach the text after the fact. */
export async function hubUpdateApplication(args: {
  id: string;
  status?: ApplicationStatus | string;
  text?: string;
  textSource?: "agent" | "user";
  note?: string;
  channel?: string;
  appliedAt?: string;
}) {
  const { id, ...body } = args;
  return hubFetch(`/api/v1/applications/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body,
  });
}

/** Delete one of the caller's application rows. The catalog listing stays. */
export async function hubDeleteApplication(args: { id: string }) {
  return hubFetch(`/api/v1/applications/${encodeURIComponent(args.id)}`, {
    method: "DELETE",
  });
}

/** Bug / suggestion / support → hub admin Telegram (rate-limited). */
export async function hubFeedback(args: {
  type: "bug" | "suggestion" | "support" | "other";
  message: string;
  subject?: string;
  contact?: string;
  context?: string;
}) {
  const key = agentKey();
  return hubFetch("/api/v1/feedback", {
    method: "POST",
    body: args,
    auth: !!key,
  });
}
