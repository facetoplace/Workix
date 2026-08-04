import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
export async function fetchTheMuseJobs(opts) {
    const maxPages = Math.min(Math.max(opts?.pages ?? 2, 1), 5);
    const category = opts?.category?.trim() ||
        process.env.THEMUSE_CATEGORY?.trim() ||
        "";
    const jobs = [];
    let lastError = "";
    for (let page = 1; page <= maxPages; page++) {
        const qs = new URLSearchParams({
            page: String(page),
            descending: "true",
        });
        if (category)
            qs.append("category", category);
        const url = `https://www.themuse.com/api/public/jobs?${qs}`;
        const { data, error, status } = await fetchJson(url, {
            headers: {
                Accept: "application/json",
                "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
            },
            proxy: false,
        });
        if (error || !data?.results || !Array.isArray(data.results)) {
            lastError = error || `The Muse HTTP ${status}`;
            break;
        }
        for (const row of data.results) {
            const link = row.refs?.landing_page;
            if (!row.name || !link)
                continue;
            const company = row.company?.name ? ` @ ${row.company.name}` : "";
            jobs.push({
                id: jobId("themuse", String(row.id || link)),
                platform: "themuse",
                kind: "job",
                title: `${row.name}${company}`,
                description: (row.contents || "")
                    .replace(/<[^>]+>/g, " ")
                    .replace(/\s+/g, " ")
                    .trim()
                    .slice(0, 4000),
                link,
                date: row.publication_date
                    ? new Date(row.publication_date).toISOString()
                    : new Date().toISOString(),
                fetchedAt: new Date().toISOString(),
                raw: {
                    type: row.type,
                    locations: row.locations?.map((l) => l.name),
                    categories: row.categories?.map((c) => c.name),
                    levels: row.levels?.map((l) => l.name),
                },
            });
        }
        if (page >= (data.page_count || page))
            break;
        if (data.results.length === 0)
            break;
    }
    if (!jobs.length && lastError)
        return { jobs: [], error: lastError };
    return { jobs, error: lastError || undefined };
}
