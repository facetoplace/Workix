import { fetchText } from "../http.js";
import { jobId } from "../store.js";
/**
 * web3.career — large Web3/crypto board (TON, mobile, AI, backend). Clean
 * server-rendered HTML: each vacancy is a `job-row-grid table_row` with the
 * canonical link `/<slug>/<id>`, title, company, salary and posted time. No key
 * needed. We walk a few pages of /remote-jobs and dedupe by id.
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const strip = (s) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
function parseRows(html) {
    const jobs = [];
    const seen = new Set();
    // Split on row boundaries; the marker class opens each vacancy <tr>.
    const chunks = html.split(/class="job-row-grid table_row"/).slice(1);
    for (const chunk of chunks) {
        const linkM = chunk.match(/href="\/([a-z0-9-]+)\/(\d{3,7})"/i);
        if (!linkM)
            continue;
        const id = linkM[2];
        if (seen.has(id))
            continue;
        seen.add(id);
        const link = `https://web3.career/${linkM[1]}/${id}`;
        const titleM = chunk.match(/job-title-truncate"[^>]*>([^<]+)</i);
        const title = titleM ? strip(titleM[1]) : "";
        if (!title)
            continue;
        const companyM = chunk.match(/<h3[^>]*>([^<]+)</i);
        const company = companyM ? strip(companyM[1]) : "";
        const dateM = chunk.match(/datetime="([^"]+)"/i);
        let date = new Date().toISOString();
        if (dateM) {
            const d = new Date(dateM[1].replace(" ", "T"));
            if (!Number.isNaN(d.getTime()))
                date = d.toISOString();
        }
        // salary cell (may be empty)
        const salM = chunk.match(/cell-salary[^>]*>([\s\S]{0,260}?)<\/td>/i);
        const salary = salM ? strip(salM[1]) : "";
        const budget = /\$|\d{2,}\s*[kк]/i.test(salary) ? salary.slice(0, 40) : undefined;
        // tags (skills) if present
        const tags = [...chunk.matchAll(/\/([a-z0-9+.#-]+)-jobs"[^>]*>\s*([^<]+)</gi)]
            .map((m) => strip(m[2]))
            .filter((t) => t && t.length < 24)
            .slice(0, 8);
        jobs.push({
            id: jobId("web3career", link),
            platform: "web3career",
            kind: "job",
            title: `${title}${company ? " @ " + company : ""}`,
            description: [company && `Company: ${company}`, salary && `Salary: ${salary}`, tags.length && `Stack: ${tags.join(", ")}`]
                .filter(Boolean)
                .join("\n"),
            link,
            date,
            budget,
            fetchedAt: new Date().toISOString(),
            raw: { company, tags },
        });
    }
    return jobs;
}
export async function fetchWeb3CareerJobs(opts) {
    const pages = Math.min(Math.max(Number(opts?.pages) || 3, 1), 6);
    const all = new Map();
    const errors = [];
    for (let p = 1; p <= pages; p++) {
        const url = p === 1 ? "https://web3.career/remote-jobs" : `https://web3.career/remote-jobs?page=${p}`;
        const { text, ok, status, error } = await fetchText(url, {
            headers: { "User-Agent": UA, "Accept-Language": "en" },
            timeoutMs: 20000,
        });
        if (!ok || !text) {
            errors.push(`page ${p}: ${error || "HTTP " + status}`);
            continue;
        }
        const rows = parseRows(text);
        for (const j of rows)
            all.set(j.id, j);
        if (!rows.length)
            break; // no more results
    }
    const jobs = [...all.values()];
    return {
        jobs,
        error: jobs.length ? undefined : errors.slice(0, 3).join("; ") || "web3career: no rows parsed",
    };
}
