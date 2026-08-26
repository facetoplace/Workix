import { jobId } from "../store.js";
import { withProfilePage } from "../browserFetch.js";
import type { Job } from "../types.js";

interface RawWf {
  title: string;
  company: string;
  link: string;
  meta: string;
}

/** Runs INSIDE the page. Wellfound job links look like /jobs/<id>-<slug>. */
function extractWf(): { url: string; items: RawWf[] } {
  const seen = new Set<string>();
  const items: RawWf[] = [];
  document.querySelectorAll('a[href*="/jobs/"]').forEach((a) => {
    const link = (a as HTMLAnchorElement).href;
    if (!/\/jobs\/\d+/.test(link) || seen.has(link)) return;
    seen.add(link);
    const title = (a.textContent || "").trim();
    if (!title || title.length < 3) return;
    const card = a.closest("[class*='jobListing'], [class*='styles_job'], li, div");
    const company =
      card?.querySelector('a[href*="/company/"]')?.textContent?.trim() ||
      (card?.querySelector("[class*='company'], h2, h3") as HTMLElement | null)?.textContent?.trim() ||
      "";
    const meta = (card?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 300);
    items.push({ title: title.slice(0, 120), company: company.slice(0, 60), link, meta });
  });
  return { url: location.href, items: items.slice(0, 80) };
}

/**
 * Wellfound (AngelList Talent) — startup + co-founder/CTO roles. Login-gated,
 * Cloudflare-fronted SPA, so we read it through the persistent `wellfound`
 * browser profile (log in once via scripts/board-open.mjs wellfound … +
 * board-save.mjs wellfound). Scrolls to lazy-load the list, filters by keyword.
 */
export async function fetchWellfoundJobs(opts?: {
  keywords?: string[];
  limit?: number;
  role?: string;
}): Promise<{ jobs: Job[]; error?: string }> {
  // A role slug (e.g. "mobile-developer", "cofounder") lists more than /jobs.
  const url = opts?.role
    ? `https://wellfound.com/role/r/${encodeURIComponent(opts.role)}`
    : "https://wellfound.com/jobs";
  // Wellfound is Cloudflare-gated: headless Chrome gets challenged, so use a
  // real (minimized) window when we have to launch our own.
  const { data, error } = await withProfilePage<{ url: string; items: RawWf[] }>("wellfound", url, extractWf, {
    waitMs: 7000,
    scrolls: 5,
    headful: true,
  });
  if (error) return { jobs: [], error: `wellfound: ${error}` };
  const rows = data?.items || [];
  if (!rows.length) {
    return { jobs: [], error: "wellfound: no cards rendered — session may be logged out (re-run board-open.mjs wellfound)" };
  }
  const words = (opts?.keywords || []).map((w) => w.trim().toLowerCase()).filter(Boolean);
  const limit = Math.min(Math.max(Number(opts?.limit) || 60, 1), 100);
  const now = new Date().toISOString();
  const jobs: Job[] = [];
  for (const r of rows) {
    const hay = `${r.title} ${r.company} ${r.meta}`.toLowerCase();
    if (words.length && !words.some((w) => hay.includes(w))) continue;
    jobs.push({
      id: jobId("wellfound", r.link),
      platform: "wellfound",
      kind: "job",
      title: `${r.title}${r.company ? " @ " + r.company : ""}`,
      description: r.meta,
      link: r.link,
      date: now,
      fetchedAt: now,
      raw: { company: r.company, source: "wellfound_browser" },
    });
    if (jobs.length >= limit) break;
  }
  return { jobs };
}
