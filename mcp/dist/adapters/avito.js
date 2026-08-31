import { jobId } from "../store.js";
import { withProfilePage } from "../browserFetch.js";
/**
 * Runs INSIDE the page — no external refs. Avito Работа (vacancies) renders each
 * result as a `data-marker="item"` card with an `item-title` anchor linking to
 * `/…/vakansii/…_<id>` and an `item-price` (the salary). Those data-markers are
 * far more stable than the hashed class names, so we anchor on them and fall
 * back to plain /vakansii/ links. The link is canonicalised (tracking query
 * stripped) so the same vacancy at two feed slots does not double.
 */
function extractAvito() {
    const seen = new Set();
    const items = [];
    const cards = document.querySelectorAll("[data-marker='item']");
    const nodes = cards.length
        ? Array.from(cards)
        : Array.from(document.querySelectorAll("a[href*='/vakansii/']"));
    nodes.forEach((node) => {
        const card = node.closest("[data-marker='item']") || node;
        const titleA = card.querySelector("[data-marker='item-title']") ||
            (card.matches("a[href]") ? card : null) ||
            card.querySelector("a[href*='/vakansii/']");
        if (!titleA)
            return;
        const raw = titleA.href;
        if (!raw)
            return;
        const link = raw.split("?")[0];
        if (seen.has(link))
            return;
        const title = (titleA.textContent || "").replace(/\s+/g, " ").trim();
        if (!title || title.length < 4)
            return;
        seen.add(link);
        const priceEl = card.querySelector("[data-marker='item-price'], [itemprop='price'], meta[itemprop='price']");
        const price = (priceEl?.textContent || priceEl?.getAttribute("content") || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 60);
        const meta = (card.textContent || "").replace(/\s+/g, " ").trim().slice(0, 400);
        items.push({ title: title.slice(0, 140), price, link, meta });
    });
    return { url: location.href, items: items.slice(0, 80) };
}
/**
 * Avito Работа — RU vacancies. Avito's terms restrict automated collection, so
 * this adapter is double-gated: it runs solely when the caller names `avito` AND
 * sets AVITO_ENABLE=1, and it never applies — отклик/чат остаётся ручным. Reads
 * the vacancy feed from the logged-in `avito` browser profile, headful (Avito
 * challenges headless). Log in once via scripts/board-open.mjs avito
 * https://www.avito.ru/profile + board-save.mjs avito. Filters locally by keyword.
 *
 * AVITO_URL overrides the feed — point it at a saved vacancy search (region /
 * remote / query), e.g. https://www.avito.ru/all/vakansii?...
 */
export async function fetchAvitoJobs(opts) {
    if (process.env.AVITO_ENABLE !== "1") {
        return {
            jobs: [],
            error: "avito: ToS restricts automated collection — set AVITO_ENABLE=1 to opt in to browser ingest (optional)",
        };
    }
    const url = process.env.AVITO_URL || "https://www.avito.ru/all/vakansii";
    const { data, error } = await withProfilePage("avito", url, extractAvito, { waitMs: 7000, scrolls: 3, headful: true });
    if (error)
        return { jobs: [], error: `avito: ${error}` };
    const rows = data?.items || [];
    if (!rows.length) {
        return {
            jobs: [],
            error: "avito: no cards rendered — session may be logged out or blocked (re-run board-open.mjs avito)",
        };
    }
    const words = (opts?.keywords || []).map((w) => w.trim().toLowerCase()).filter(Boolean);
    const limit = Math.min(Math.max(Number(opts?.limit) || 60, 1), 100);
    const now = new Date().toISOString();
    const jobs = [];
    for (const r of rows) {
        const hay = `${r.title} ${r.meta}`.toLowerCase();
        if (words.length && !words.some((w) => hay.includes(w)))
            continue;
        jobs.push({
            id: jobId("avito", r.link),
            platform: "avito",
            kind: "job",
            title: r.title,
            description: r.meta,
            link: r.link,
            budget: r.price || undefined,
            date: now,
            fetchedAt: now,
            raw: { price: r.price, source: "avito_browser" },
        });
        if (jobs.length >= limit)
            break;
    }
    return { jobs };
}
