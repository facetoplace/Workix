import { fetchText } from "../http.js";
import { jobId } from "../store.js";
/**
 * aijobs.net — AI / ML / data board. Server-rendered HTML; each vacancy is an
 * anchor `<a class="…stretched-link" href="/job/<slug>-<id>/">Title</a>` with a
 * salary badge alongside. No key.
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const clean = (s) => s.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
export async function fetchAijobsJobs(opts) {
    const { text, ok, status, error } = await fetchText("https://aijobs.net/", {
        headers: { "User-Agent": UA, "Accept-Language": "en" },
        timeoutMs: 20000,
    });
    if (!ok || !text)
        return { jobs: [], error: `aijobs: ${error || "HTTP " + status}` };
    const jobs = [];
    const seen = new Set();
    const now = new Date().toISOString();
    // Anchor + a small trailing window that carries the salary badge.
    const re = /<a[^>]*class="[^"]*stretched-link[^"]*"[^>]*href="(\/job\/[^"]*?-(\d+)\/)"[^>]*>([\s\S]*?)<\/a>([\s\S]{0,220})/gi;
    for (const m of text.matchAll(re)) {
        const [, href, id, titleRaw, tail] = m;
        if (seen.has(id))
            continue;
        seen.add(id);
        const title = clean(titleRaw).replace(/\s+\d{4,}$/, ""); // drop trailing internal id
        if (!title || title.length < 3)
            continue;
        const salM = tail.match(/text-bg-secondary[^>]*>([^<]*(?:USD|EUR|GBP|INR|CNY|\$|€|£)[^<]*)</i);
        const salary = salM ? clean(salM[1]) : "";
        jobs.push({
            id: jobId("aijobs", `https://aijobs.net${href}`),
            platform: "aijobs",
            kind: "job",
            title,
            description: salary ? `Salary: ${salary}` : "",
            link: `https://aijobs.net${href}`,
            date: now,
            budget: salary || undefined,
            fetchedAt: now,
        });
    }
    return { jobs, error: jobs.length ? undefined : "aijobs: no rows parsed" };
}
