import { jobId } from "../store.js";
import { withProfilePage } from "../browserFetch.js";
import type { Job } from "../types.js";

interface RawProfi {
  title: string;
  price: string;
  link: string;
  meta: string;
}

/**
 * Runs INSIDE the page — no external refs. The Profi cabinet renders each new
 * client order as `<a data-testid="<id>_order-snippet" href="/backoffice/n.php?o=<id>&analytics_data=…">`
 * with an `<h3>` title, a `<p>` description and the price as plain text ("до 50 000 ₽").
 * Class names are hashed styled-components (churn every deploy), so we anchor on
 * the testid / href shape, the semantic h3/p, and a ₽ regex — never on classes.
 * The link is canonicalised to `?o=<id>` so the same order at two board slots
 * (different analytics_data) does not double.
 */
function extractProfi(): { url: string; items: RawProfi[] } {
  const seen = new Set<string>();
  const items: RawProfi[] = [];
  const anchors = document.querySelectorAll<HTMLAnchorElement>(
    "a[data-testid$='order-snippet'], a[href*='/backoffice/n.php?o=']",
  );
  anchors.forEach((a) => {
    const idm = a.href.match(/[?&]o=(\d+)/);
    if (!idm) return;
    const link = `${location.origin}/backoffice/n.php?o=${idm[1]}`;
    if (seen.has(link)) return;
    seen.add(link);
    const clean = (s: string | null | undefined) =>
      (s || "").replace(/\bfalse\b/g, " ").replace(/\s+/g, " ").trim();
    const title = clean(a.querySelector("h3")?.textContent) || clean(a.textContent).slice(0, 80);
    if (!title || title.length < 3) return;
    const description = clean(a.querySelector("p")?.textContent);
    const full = clean(a.textContent);
    const priceM = full.match(/(?:до|от)?\s*\d[\d\s]*₽/);
    const price = priceM ? priceM[0].replace(/\s+/g, " ").trim() : "";
    const meta = (description || full).slice(0, 400);
    items.push({ title: title.slice(0, 140), price, link, meta });
  });
  return { url: location.href, items: items.slice(0, 80) };
}

/**
 * Profi.ru — RU services marketplace (private clients). The partner mTLS API is
 * out of scope, so orders are read from the logged-in cabinet through the
 * persistent `profi` browser profile (log in once via
 * scripts/board-open.mjs profi https://profi.ru/backoffice/ + board-save.mjs profi).
 * Read-only ingest; отклик остаётся ручным через сайт. Filters locally by keyword.
 *
 * PROFI_URL overrides the cabinet feed page (e.g. a saved filtered view).
 */
export async function fetchProfiJobs(opts?: {
  keywords?: string[];
  limit?: number;
}): Promise<{ jobs: Job[]; error?: string }> {
  const url = process.env.PROFI_URL || "https://profi.ru/backoffice/";
  const { data, error } = await withProfilePage<{ url: string; items: RawProfi[] }>(
    "profi",
    url,
    extractProfi,
    { waitMs: 6000, scrolls: 3 },
  );
  if (error) return { jobs: [], error: `profi: ${error}` };
  const rows = data?.items || [];
  if (!rows.length) {
    return {
      jobs: [],
      error:
        "profi: no order cards rendered — session may be logged out (re-run board-open.mjs profi https://profi.ru/backoffice/)",
    };
  }
  const words = (opts?.keywords || []).map((w) => w.trim().toLowerCase()).filter(Boolean);
  const limit = Math.min(Math.max(Number(opts?.limit) || 60, 1), 100);
  const now = new Date().toISOString();
  const jobs: Job[] = [];
  for (const r of rows) {
    const hay = `${r.title} ${r.meta}`.toLowerCase();
    if (words.length && !words.some((w) => hay.includes(w))) continue;
    jobs.push({
      id: jobId("profi", r.link),
      platform: "profi",
      kind: "service",
      title: r.title,
      description: r.meta,
      link: r.link,
      budget: r.price || undefined,
      date: now,
      fetchedAt: now,
      raw: { price: r.price, source: "profi_browser" },
    });
    if (jobs.length >= limit) break;
  }
  return { jobs };
}
