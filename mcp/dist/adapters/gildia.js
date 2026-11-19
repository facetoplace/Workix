import { jobId } from "../store.js";
import { withProfilePage } from "../browserFetch.js";
/**
 * Runs INSIDE the logged-in page — no external refs. Tries the site API first
 * (token from localStorage), then falls back to scraping the rendered cards.
 * Anchors on href shapes and semantic text, never on hashed class names.
 */
async function extractGildia() {
    const origin = location.origin;
    const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
    const toLink = (href) => href.startsWith("http") ? href : `${origin}${href.startsWith("/") ? "" : "/"}${href}`;
    const mapLead = (row, index) => {
        const pick = (...keys) => {
            for (const key of keys) {
                const value = row[key];
                if (typeof value === "string" && value.trim())
                    return clean(value);
                if (typeof value === "number")
                    return String(value);
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
                const payload = await res.json();
                const list = Array.isArray(payload)
                    ? payload
                    : payload && typeof payload === "object"
                        ? (payload.items ||
                            payload.leads ||
                            payload.data ||
                            payload.results ||
                            [])
                        : [];
                if (Array.isArray(list) && list.length) {
                    return {
                        url: location.href,
                        source: "api",
                        items: list
                            .slice(0, 120)
                            .map(mapLead)
                            .filter((r) => r.title),
                    };
                }
            }
        }
    }
    catch {
        /* fall through to DOM */
    }
    // 2) DOM fallback — rendered lead cards.
    const seen = new Set();
    const items = [];
    const anchors = document.querySelectorAll("a[href*='/leads/'], a[href*='/ru/leads/'], a[href*='/en/leads/']");
    anchors.forEach((a) => {
        const link = a.href;
        if (!link || seen.has(link))
            return;
        seen.add(link);
        const card = a.closest("article, li, div") || a;
        const title = clean(card.querySelector("h1, h2, h3, h4")?.textContent || a.textContent).slice(0, 140);
        if (!title || title.length < 3)
            return;
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
export async function extractGildiaSnapshot(snapshot, origin = "https://gildia.global") {
    const rows = Array.from(snapshot.matchAll(/<a\s+[^>]*href=["']([^"']*\/leads\/[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi));
    const items = rows.map((match) => ({
        title: match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140),
        price: "",
        link: new URL(match[1], origin).toString(),
        meta: match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 600),
    })).filter((item) => item.title.length >= 3);
    return { source: "dom", items };
}
export async function fetchGildiaJobs(opts) {
    const url = process.env.GILDIA_URL || "https://gildia.global/ru/leads";
    const { data, error } = await withProfilePage("gildia", url, extractGildia, { waitMs: 6000, scrolls: 3 });
    if (error)
        return { jobs: [], error: `gildia: ${error}` };
    const rows = data?.items || [];
    if (!rows.length) {
        return {
            jobs: [],
            error: "gildia: no leads rendered — session may be logged out or a Cloudflare challenge is showing (re-run: node scripts/board-open.mjs gildia https://gildia.global/ru/login)",
        };
    }
    const words = (opts?.keywords || []).map((w) => w.trim().toLowerCase()).filter(Boolean);
    const limit = Math.min(Math.max(Number(opts?.limit) || 60, 1), 120);
    const now = new Date().toISOString();
    const jobs = [];
    for (const r of rows) {
        const hay = `${r.title} ${r.meta}`.toLowerCase();
        if (words.length && !words.some((w) => hay.includes(w)))
            continue;
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
        if (jobs.length >= limit)
            break;
    }
    return { jobs };
}
/** True when a Gildia browser profile exists — not proof of a live session. */
export function gildiaConfigured() {
    return Boolean(process.env.GILDIA_URL || process.env.GILDIA_EMAIL);
}
