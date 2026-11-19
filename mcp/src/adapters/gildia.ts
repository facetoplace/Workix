import { jobId } from "../store.js";
import { withProfilePage } from "../browserFetch.js";
import type { Job } from "../types.js";

/**
 * Gildia (gildia.global) — a networking platform where people post "leads":
 * client requests gathered from chats and groups (kind: lead, NOT a vacancy).
 *
 * How we read it
 * --------------
 * Gildia's feed lives behind an email/password login that the server protects
 * with an anti-bot challenge (POST /api/auth/login answers `captcha_failed` to
 * a plain HTTP client). So there is no headless HTTP login here — instead the
 * adapter reuses a browser profile you signed into ONCE, and pulls the feed from
 * inside that logged-in page:
 *
 *   1. reads the JWT the SPA keeps in localStorage (`accessToken`);
 *   2. calls the site's own JSON API from the page (same origin, Authorization
 *      header) — GET /api/leads;
 *   3. if the API call fails, falls back to reading the rendered lead cards
 *      straight from the DOM.
 *
 * Log in once (window opens, you type there — nothing goes through the agent):
 *   node scripts/board-open.mjs gildia https://gildia.global/ru/login
 *   node scripts/board-save.mjs gildia
 *
 * Read-only: отклик/чат с клиентом остаются ручными на сайте. Filtering by
 * keywords happens locally over a page we pull in full.
 *
 * GILDIA_URL overrides the feed page (e.g. a saved filtered view).
 */

interface RawLead {
  title: string;
  price: string;
  link: string;
  meta: string;
}

/**
 * Runs INSIDE the logged-in page — no external refs. Tries the site API first
 * (token from localStorage), then falls back to scraping the rendered cards.
 * Anchors on href shapes and semantic text, never on hashed class names.
 */
async function extractGildia(): Promise<{ url: string; source: string; items: RawLead[] }> {
  const origin = location.origin;
  const clean = (s: string | null | undefined): string =>
    (s || "").replace(/\s+/g, " ").trim();
  const toLink = (href: string): string =>
    href.startsWith("http") ? href : `${origin}${href.startsWith("/") ? "" : "/"}${href}`;

  const mapLead = (row: Record<string, unknown>, index: number): RawLead => {
    const pick = (...keys: string[]): string => {
      for (const key of keys) {
        const value = row[key];
        if (typeof value === "string" && value.trim()) return clean(value);
        if (typeof value === "number") return String(value);
      }
      return "";
    };
    const rawLink = pick("url", "link", "href");
    const id = pick("id", "leadId", "groupId");
    const link = rawLink
      ? toLink(rawLink)
      : id
        ? `${origin}/ru/leads/${encodeURIComponent(id)}`
        : `${origin}/ru/leads`;
    return {
      title: pick("title", "name", "subject", "topic").slice(0, 140) || `Gildia lead ${index + 1}`,
      price: pick("budget", "price", "amount"),
      link,
      meta: pick("description", "text", "message", "body", "preview").slice(0, 600),
    };
  };

  // 1) JSON API, authenticated with the SPA's own token.
  try {
    const token = ["accessToken", "access_token", "token"]
      .map((key) => localStorage.getItem(key) || "")
      .find(Boolean) || "";
    if (token) {
      const res = await fetch(`${origin}/api/leads`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const payload: unknown = await res.json();
        const list = Array.isArray(payload)
          ? payload
          : payload && typeof payload === "object"
            ? ((payload as Record<string, unknown>).items ||
              (payload as Record<string, unknown>).leads ||
              (payload as Record<string, unknown>).data ||
              (payload as Record<string, unknown>).results ||
              [])
            : [];
        if (Array.isArray(list) && list.length) {
          return {
            url: location.href,
            source: "api",
            items: (list as Record<string, unknown>[])
              .slice(0, 120)
              .map(mapLead)
              .filter((r) => r.title),
          };
        }
      }
    }
  } catch {
    /* fall through to DOM */
  }

  // 2) DOM fallback — rendered lead cards.
  const seen = new Set<string>();
  const items: RawLead[] = [];
  const anchors = document.querySelectorAll<HTMLAnchorElement>(
    "a[href*='/leads/'], a[href*='/ru/leads/'], a[href*='/en/leads/']",
  );
  anchors.forEach((a) => {
    const link = a.href;
    if (!link || seen.has(link)) return;
    seen.add(link);
    const card = (a.closest("article, li, div") as HTMLElement | null) || a;
    const title = clean(
      card.querySelector("h1, h2, h3, h4")?.textContent || a.textContent,
    ).slice(0, 140);
    if (!title || title.length < 3) return;
    const full = clean(card.textContent);
    const priceM = full.match(/(?:до|от)?\s*\d[\d\s]*[₽$€]/);
    items.push({
      title,
      price: priceM ? priceM[0].replace(/\s+/g, " ").trim() : "",
      link,
      meta: full.slice(0, 600),
    });
  });
  return { url: location.href, source: "dom", items: items.slice(0, 120) };
}

export async function extractGildiaSnapshot(
  snapshot: string,
  origin = "https://gildia.global",
): Promise<{ source: "dom"; items: RawLead[] }> {
  const rows = Array.from(snapshot.matchAll(/<a\s+[^>]*href=["']([^"']*\/leads\/[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi));
  const items: RawLead[] = rows.map((match) => ({
    title: match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140),
    price: "",
    link: new URL(match[1], origin).toString(),
    meta: match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 600),
  })).filter((item) => item.title.length >= 3);
  return { source: "dom", items };
}

export async function fetchGildiaJobs(opts?: {
  keywords?: string[];
  limit?: number;
}): Promise<{ jobs: Job[]; error?: string }> {
  const url = process.env.GILDIA_URL || "https://gildia.global/ru/leads";
  const { data, error } = await withProfilePage<Awaited<ReturnType<typeof extractGildia>>>(
    "gildia",
    url,
    extractGildia,
    { waitMs: 6000, scrolls: 3 },
  );
  if (error) return { jobs: [], error: `gildia: ${error}` };
  const rows = data?.items || [];
  if (!rows.length) {
    return {
      jobs: [],
      error:
        "gildia: no leads rendered — session may be logged out or a Cloudflare challenge is showing (re-run: node scripts/board-open.mjs gildia https://gildia.global/ru/login)",
    };
  }
  const words = (opts?.keywords || []).map((w) => w.trim().toLowerCase()).filter(Boolean);
  const limit = Math.min(Math.max(Number(opts?.limit) || 60, 1), 120);
  const now = new Date().toISOString();
  const jobs: Job[] = [];
  for (const r of rows) {
    const hay = `${r.title} ${r.meta}`.toLowerCase();
    if (words.length && !words.some((w) => hay.includes(w))) continue;
    jobs.push({
      id: jobId("gildia", r.link),
      platform: "gildia",
      kind: "lead",
      title: r.title,
      description: r.meta,
      link: r.link,
      budget: r.price || undefined,
      date: now,
      fetchedAt: now,
      raw: { price: r.price, source: `gildia_${data?.source || "browser"}` },
    });
    if (jobs.length >= limit) break;
  }
  return { jobs };
}

/** True when a Gildia browser profile exists — not proof of a live session. */
export function gildiaConfigured(): boolean {
  return Boolean(process.env.GILDIA_URL || process.env.GILDIA_EMAIL);
}
