import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
export async function fetchAidevboardJobs(opts) {
    const maxPages = Math.min(Math.max(opts?.pages ?? 2, 1), 5);
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 50);
    const q = opts?.q?.trim() || process.env.AIDEV_Q?.trim() || "";
    const tags = opts?.tags?.trim() || process.env.AIDEV_TAGS?.trim() || "";
    const workplace = opts?.workplace?.trim() ||
        process.env.AIDEV_WORKPLACE?.trim() ||
        "remote";
    const apiKey = process.env.AIDEV_API_KEY?.trim() || "";
    const postedWithin = Number(process.env.AIDEV_POSTED_WITHIN_DAYS || "30") || 30;
    const headers = {
        Accept: "application/json",
        "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
    };
    if (apiKey)
        headers.Authorization = `Bearer ${apiKey}`;
    const jobs = [];
    let lastError = "";
    for (let page = 1; page <= maxPages; page++) {
        const qs = new URLSearchParams({
            page: String(page),
            limit: String(limit),
            posted_within_days: String(Math.min(Math.max(postedWithin, 1), 90)),
        });
        if (workplace && workplace !== "all")
            qs.set("workplace", workplace);
        if (q)
            qs.set("q", q);
        if (tags)
            qs.set("tags", tags);
        const url = `https://aidevboard.com/api/v1/jobs?${qs}`;
        const { data, error, status } = await fetchJson(url, {
            headers,
            proxy: false,
        });
        if (error || !data?.jobs || !Array.isArray(data.jobs)) {
            lastError = error || `AI Dev Jobs HTTP ${status}`;
            break;
        }
        for (const row of data.jobs) {
            const link = row.url || (row.id ? `https://aidevboard.com/job/${row.id}` : "");
            if (!row.title || !link)
                continue;
            const company = row.company_name ? ` @ ${row.company_name}` : "";
            jobs.push({
                id: jobId("aidevboard", String(row.id || link)),
                platform: "aidevboard",
                kind: "job",
                title: `${row.title}${company}`,
                description: (row.description || "")
                    .replace(/<[^>]+>/g, " ")
                    .replace(/\s+/g, " ")
                    .trim()
                    .slice(0, 4000),
                link,
                date: row.published_at
                    ? new Date(row.published_at).toISOString()
                    : new Date().toISOString(),
                fetchedAt: new Date().toISOString(),
                raw: {
                    workplace: row.workplace,
                    location: row.location,
                    job_type: row.job_type,
                    experience_level: row.experience_level,
                    salary_min: row.salary_min,
                    salary_max: row.salary_max,
                    tags: row.tags,
                    apply_url: row.apply_url,
                },
            });
        }
        if (!data.has_next || data.jobs.length === 0)
            break;
    }
    if (!jobs.length && lastError)
        return { jobs: [], error: lastError };
    return { jobs, error: lastError || undefined };
}
