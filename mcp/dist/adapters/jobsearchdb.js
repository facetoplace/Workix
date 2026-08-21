import { fetchText } from "../http.js";
import { jobId } from "../store.js";
const BASE = "https://www.jobsearchdb.com";
function decode(s) {
    return s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
/** JobSearchDB is a human-curated directory, so its useful output is leads to
 * specialized boards; it must not be treated as a vacancy feed. */
export async function fetchJobSearchDbBoards(opts) {
    const r = await fetchText(BASE, { proxy: false, timeoutMs: 20000 });
    if (!r.ok)
        return { jobs: [], error: `jobsearchdb: public directory unavailable (${r.status || r.error || "network error"})` };
    const limit = Math.min(Math.max(opts?.limit ?? 80, 1), 200);
    const words = (opts?.keywords || []).map((x) => x.trim().toLowerCase()).filter(Boolean);
    const links = new Map();
    for (const m of r.text.matchAll(/href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
        const url = m[1].replace(/&amp;/g, "&");
        if (/jobsearchdb\.com/i.test(new URL(url).hostname))
            continue;
        const label = decode(m[2]) || url;
        if (/sponsor|linkedin|submit|newsletter|facebook|twitter|instagram/i.test(label))
            continue;
        links.set(url, label);
    }
    const now = new Date().toISOString();
    const jobs = [];
    for (const [link, label] of [...links.entries()].slice(0, limit)) {
        const title = label.slice(0, 200);
        const description = `Specialized job board discovered via Job Search Database: ${title}`;
        if (words.length && !words.some((w) => `${title} ${description}`.toLowerCase().includes(w)))
            continue;
        jobs.push({ id: jobId("jobsearchdb", link), platform: "jobsearchdb", kind: "lead", title: `Job board: ${title}`, description, link, date: now, fetchedAt: now, raw: { source: "jobsearchdb_directory" } });
    }
    return jobs.length ? { jobs } : { jobs: [], error: "jobsearchdb: no external job boards parsed" };
}
