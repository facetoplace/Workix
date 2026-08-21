import { fetchText } from "../http.js";
import { jobId } from "../store.js";
const BOARDS = {
    justjoin_it: { id: "justjoin_it", base: "https://justjoin.it", paths: ["/"], host: /justjoin\.it/i },
    budu_jobs: { id: "budu_jobs", base: "https://budu.jobs", paths: ["/vacancies"], host: /budu\.jobs/i },
    jobio: { id: "jobio", base: "https://www.jobio.co.il", paths: ["/ru/job-list"], host: /jobio\.co\.il/i },
    hiringcafe: { id: "hiringcafe", base: "https://hiringcafe.com", paths: ["/"], host: /hiringcafe\.com/i },
    grepjob: { id: "grepjob", base: "https://grepjob.com", paths: ["/"], host: /grepjob\.com/i },
    yc_work_at_startup: { id: "yc_work_at_startup", base: "https://www.workatastartup.com", paths: ["/jobs"], host: /workatastartup\.com/i },
    wellfound: { id: "wellfound", base: "https://wellfound.com", paths: ["/jobs"], host: /wellfound\.com/i },
    lennys_jobs: { id: "lennys_jobs", base: "https://www.lennysjobs.com", paths: ["/"], host: /lennysjobs\.com/i },
    accel_jobs: { id: "accel_jobs", base: "https://jobs.accel.com", paths: ["/jobs"], host: /jobs\.accel\.com/i },
    sequoia_jobs: { id: "sequoia_jobs", base: "https://jobs.sequoiacap.com", paths: ["/jobs"], host: /sequoiacap\.com/i },
    capitalg_jobs: { id: "capitalg_jobs", base: "https://careers.capitalg.com", paths: ["/jobs"], host: /capitalg\.com/i },
    index_startup_jobs: { id: "index_startup_jobs", base: "https://www.indexventures.com", paths: ["/startup-jobs"], host: /indexventures\.com/i },
    generalcatalyst_jobs: { id: "generalcatalyst_jobs", base: "https://jobs.generalcatalyst.com", paths: ["/jobs"], host: /generalcatalyst\.com/i },
};
function decode(s) {
    return s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function jsonLd(html) {
    const out = [];
    for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        try {
            const value = JSON.parse(m[1]);
            if (Array.isArray(value.itemListElement))
                out.push(...value.itemListElement.filter((x) => Boolean(x && typeof x === "object")));
            else
                out.push(value);
        }
        catch { /* tolerate malformed/embedded JSON */ }
    }
    return out;
}
function links(board, html) {
    const out = new Set();
    for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
        try {
            const url = new URL(m[1], board.base);
            if (board.host.test(url.hostname) && /job|offer|vacanc|position|career|posting/i.test(url.pathname) && url.pathname !== "/vacancies")
                out.add(url.toString());
        }
        catch { /* ignore malformed links */ }
    }
    return [...out];
}
function field(data, ...keys) {
    for (const key of keys)
        if (data?.[key])
            return String(data[key]);
    return undefined;
}
export async function fetchRegionalBoardJobs(platform, opts) {
    const board = BOARDS[platform];
    if (!board)
        return { jobs: [], error: `${platform}: unsupported regional board` };
    const limit = Math.min(Math.max(opts?.limit ?? 40, 1), 100);
    const pages = await Promise.all(board.paths.map((path) => fetchText(`${board.base}${path}`, { proxy: false, timeoutMs: 20000 })));
    const html = pages.find((p) => p.ok)?.text || "";
    if (!html)
        return { jobs: [], error: `${platform}: public page unavailable` };
    const words = (opts?.keywords || []).map((x) => x.trim().toLowerCase()).filter(Boolean);
    const urls = links(board, html).slice(0, limit);
    const structured = jsonLd(html);
    const jobs = [];
    for (const item of structured) {
        const nested = item.item || item;
        const link = field(nested, "url", "sameAs");
        const title = field(nested, "title", "name");
        if (!link || !title || !/https?:\/\//i.test(link))
            continue;
        const description = field(nested, "description") || "";
        if (words.length && !words.some((w) => `${title} ${description}`.toLowerCase().includes(w)))
            continue;
        const now = new Date().toISOString();
        jobs.push({ id: jobId(platform, link), platform, kind: "job", title: decode(title).slice(0, 200), description: decode(description).slice(0, 4000), link, date: field(nested, "datePosted", "datePublished") || now, fetchedAt: now, raw: { source: `${platform}_jsonld` } });
    }
    if (jobs.length)
        return { jobs: jobs.slice(0, limit) };
    const details = await Promise.all(urls.map(async (link) => {
        const r = await fetchText(link, { proxy: false, timeoutMs: 15000 });
        if (!r.ok)
            return null;
        const title = decode(r.text.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || r.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || link.split("/").pop() || platform);
        const description = decode(r.text.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1] || "");
        if (words.length && !words.some((w) => `${title} ${description}`.toLowerCase().includes(w)))
            return null;
        const now = new Date().toISOString();
        return { id: jobId(platform, link), platform, kind: "job", title: title.slice(0, 200), description: description.slice(0, 4000), link, date: now, fetchedAt: now, raw: { source: `${platform}_public_html` } };
    }));
    const out = details.filter((j) => Boolean(j));
    return out.length ? { jobs: out } : { jobs: [], error: `${platform}: no public job cards parsed` };
}
