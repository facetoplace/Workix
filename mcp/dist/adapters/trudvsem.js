import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
const BASE = "https://opendata.trudvsem.ru/api/v1/vacancies";
function textOf(v) {
    const parts = [];
    if (v.duty)
        parts.push(v.duty);
    if (typeof v.requirements === "string")
        parts.push(v.requirements);
    if (v.requirement?.education) {
        const exp = v.requirement.experience;
        parts.push(`Требования: ${v.requirement.education}${exp ? `, опыт ${exp} г.` : ""}`);
    }
    if (v.schedule)
        parts.push(`График: ${v.schedule}`);
    return parts.join("\n").replace(/\s+/g, " ").trim().slice(0, 4000);
}
function budgetOf(v) {
    const cur = v.currency || "RUB";
    if (v.salary_min && v.salary_max && v.salary_min !== v.salary_max) {
        return `${v.salary_min}–${v.salary_max} ${cur}`;
    }
    if (v.salary_min)
        return `от ${v.salary_min} ${cur}`;
    return v.salary || undefined;
}
async function searchOnce(text, region, limit) {
    const qs = new URLSearchParams({ offset: "0", limit: String(limit), text });
    const url = region
        ? `${BASE}/region/${encodeURIComponent(region)}?${qs}`
        : `${BASE}?${qs}`;
    const { data, error, status } = await fetchJson(url, {
        headers: {
            Accept: "application/json",
            "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
        },
        proxy: false,
    });
    if (error || !data?.results) {
        return { jobs: [], error: error || `Trudvsem HTTP ${status}` };
    }
    // A filter that matches nothing returns results:{} — an empty page, not a fault.
    const rows = data.results.vacancies || [];
    const jobs = [];
    for (const row of rows) {
        const v = row.vacancy;
        const link = v?.vac_url;
        if (!v || !link || !v["job-name"])
            continue;
        const company = v.company?.name ? ` @ ${v.company.name}` : "";
        const date = v.date_modify || v["creation-date"];
        jobs.push({
            id: jobId("trudvsem", link),
            platform: "trudvsem",
            kind: "job",
            title: `${v["job-name"]}${company}`,
            description: textOf(v),
            link,
            date: date ? new Date(date).toISOString() : new Date().toISOString(),
            budget: budgetOf(v),
            fetchedAt: new Date().toISOString(),
            raw: {
                region: v.region?.name,
                region_code: v.region?.region_code,
                employment: v.employment,
                schedule: v.schedule,
                source: v.source,
                specialisation: v.category?.specialisation,
            },
        });
    }
    return { jobs, totalCount: data.meta?.total };
}
export async function fetchTrudvsemJobs(opts) {
    const region = opts?.region?.trim() || process.env.TRUDVSEM_REGION?.trim();
    const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 100);
    // `text` is matched as one phrase, so a joined keyword list ("flutter mobile
    // react") matches nothing. Each keyword is its own query instead, capped
    // because every query is a separate round trip against a slow origin.
    const maxQueries = Math.max(Number(process.env.TRUDVSEM_MAX_QUERIES || 3) || 3, 1);
    const terms = (opts?.text?.trim()
        ? [opts.text.trim()]
        : (opts?.keywords || []).map((k) => k.trim()).filter(Boolean)).slice(0, maxQueries);
    if (!terms.length) {
        terms.push(process.env.TRUDVSEM_TEXT?.trim() || "разработчик");
    }
    const results = await Promise.all(terms.map((t) => searchOnce(t, region, limit)));
    const seen = new Set();
    const jobs = [];
    for (const r of results) {
        for (const j of r.jobs) {
            if (seen.has(j.id))
                continue;
            seen.add(j.id);
            jobs.push(j);
        }
    }
    const firstError = results.find((r) => r.error)?.error;
    if (!jobs.length && firstError)
        return { jobs: [], error: firstError };
    return { jobs, totalCount: results[0]?.totalCount };
}
