import { jobId } from "../store.js";
import { withProfilePage } from "../browserFetch.js";
/** Runs INSIDE the page — no external refs. Pulls the rendered job cards. */
function extractYc() {
    const seen = new Set();
    const items = [];
    document.querySelectorAll('a[href*="/jobs/"]').forEach((a) => {
        const link = a.href;
        if (!/\/jobs\/\d+/.test(link) || seen.has(link))
            return;
        seen.add(link);
        const title = (a.textContent || "").trim();
        if (!title || title.length < 3)
            return;
        const card = a.closest("li, [class*='job'], [class*='directory'], div");
        const company = card?.querySelector('a[href*="/companies/"]')?.textContent?.trim() ||
            card?.querySelector("[class*='company']")?.textContent?.trim() ||
            "";
        const meta = (card?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 300);
        items.push({ title: title.slice(0, 120), company: company.slice(0, 60), link, meta });
    });
    return { url: location.href, items: items.slice(0, 60) };
}
/**
 * Y Combinator "Work at a Startup" — founding/CTO/agent-systems roles at YC
 * startups. The site is a login-gated SPA that blocks plain HTTP, so we read it
 * through the persistent `yc` browser profile (log in once via
 * scripts/board-open.mjs yc … + board-save.mjs yc). Filters locally by keyword.
 */
export async function fetchYcJobs(opts) {
    const role = opts?.role || "eng";
    const url = `https://www.workatastartup.com/jobs?role=${encodeURIComponent(role)}`;
    const { data, error } = await withProfilePage("yc", url, extractYc, {
        waitMs: 6000,
    });
    if (error)
        return { jobs: [], error: `yc: ${error}` };
    const rows = data?.items || [];
    if (!rows.length) {
        return { jobs: [], error: "yc: no cards rendered — session may be logged out (re-run board-open.mjs yc)" };
    }
    const words = (opts?.keywords || []).map((w) => w.trim().toLowerCase()).filter(Boolean);
    const limit = Math.min(Math.max(Number(opts?.limit) || 60, 1), 100);
    const now = new Date().toISOString();
    const jobs = [];
    for (const r of rows) {
        const hay = `${r.title} ${r.company} ${r.meta}`.toLowerCase();
        if (words.length && !words.some((w) => hay.includes(w)))
            continue;
        jobs.push({
            id: jobId("yc_work_at_startup", r.link),
            platform: "yc_work_at_startup",
            kind: "job",
            title: `${r.title}${r.company ? " @ " + r.company : ""}`,
            description: r.meta,
            link: r.link,
            date: now,
            fetchedAt: now,
            raw: { company: r.company, source: "yc_browser" },
        });
        if (jobs.length >= limit)
            break;
    }
    return { jobs };
}
