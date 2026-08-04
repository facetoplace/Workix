import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
export async function fetchArbeitnowJobs(opts) {
    const maxPages = Math.min(Math.max(opts?.pages ?? 2, 1), 5);
    const remoteOnly = opts?.remoteOnly ??
        process.env.ARBEITNOW_REMOTE_ONLY?.trim() !== "0";
    const jobs = [];
    let lastError = "";
    for (let page = 1; page <= maxPages; page++) {
        const url = `https://www.arbeitnow.com/api/job-board-api?page=${page}`;
        const { data, error, status } = await fetchJson(url, {
            headers: {
                Accept: "application/json",
                "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
            },
            proxy: false,
        });
        if (error || !data?.data || !Array.isArray(data.data)) {
            lastError = error || `Arbeitnow HTTP ${status}`;
            break;
        }
        for (const row of data.data) {
            if (!row.title || !row.url)
                continue;
            if (remoteOnly && !row.remote)
                continue;
            const date = row.created_at
                ? new Date(row.created_at * 1000).toISOString()
                : new Date().toISOString();
            jobs.push({
                id: jobId("arbeitnow", row.url),
                platform: "arbeitnow",
                kind: "job",
                title: `${row.title}${row.company_name ? " @ " + row.company_name : ""}`,
                description: (row.description || "")
                    .replace(/<[^>]+>/g, " ")
                    .replace(/\s+/g, " ")
                    .trim()
                    .slice(0, 4000),
                link: row.url,
                date,
                fetchedAt: new Date().toISOString(),
                raw: {
                    remote: row.remote,
                    location: row.location,
                    tags: row.tags,
                    job_types: row.job_types,
                    slug: row.slug,
                },
            });
        }
        if (!data.links?.next)
            break;
    }
    if (!jobs.length && lastError)
        return { jobs: [], error: lastError };
    return { jobs, error: lastError || undefined };
}
