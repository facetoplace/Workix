import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
function budgetOf(j) {
    const cur = j.currency_code || "EUR";
    if (j.gross_salary_low && j.gross_salary_high) {
        return `${j.gross_salary_low}–${j.gross_salary_high} ${cur}/yr`;
    }
    const one = j.gross_salary_low || j.gross_salary_high;
    return one ? `${one} ${cur}/yr` : undefined;
}
export async function fetchLandingJobs(opts) {
    const remoteOnly = opts?.remoteOnly ?? process.env.LANDING_JOBS_REMOTE_ONLY === "1";
    const { data, error, status } = await fetchJson("https://landing.jobs/api/v1/jobs", {
        headers: {
            Accept: "application/json",
            "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
        },
        proxy: false,
    });
    if (error || !Array.isArray(data)) {
        return { jobs: [], error: error || `Landing.jobs HTTP ${status}` };
    }
    const kw = (opts?.keywords || [])
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean);
    const jobs = [];
    for (const j of data) {
        if (!j.title || !j.url)
            continue;
        if (remoteOnly && !j.remote)
            continue;
        if (kw.length && !kw.some((k) => j.title.toLowerCase().includes(k))) {
            continue;
        }
        jobs.push({
            id: jobId("landing_jobs", String(j.id || j.url)),
            platform: "landing_jobs",
            kind: "job",
            title: j.title,
            description: `${j.role_description || ""}\n${j.main_requirements || ""}`
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 4000),
            link: j.url,
            date: new Date(j.published_at || j.created_at || Date.now()).toISOString(),
            budget: budgetOf(j),
            fetchedAt: new Date().toISOString(),
            raw: {
                remote: j.remote,
                type: j.type,
                tags: j.tags,
                locations: j.locations,
                expires_at: j.expires_at,
            },
        });
    }
    return { jobs };
}
