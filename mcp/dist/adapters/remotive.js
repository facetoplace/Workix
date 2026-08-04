import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
export async function fetchRemotiveJobs(opts) {
    const category = opts?.category?.trim() ||
        process.env.REMOTIVE_CATEGORY?.trim() ||
        "software-dev";
    const qs = new URLSearchParams();
    if (category && category !== "all")
        qs.set("category", category);
    const url = `https://remotive.com/api/remote-jobs${qs.toString() ? `?${qs}` : ""}`;
    const { data, error, status } = await fetchJson(url, {
        headers: {
            Accept: "application/json",
            "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
        },
        proxy: false,
    });
    if (error || !data?.jobs || !Array.isArray(data.jobs)) {
        return { jobs: [], error: error || `Remotive HTTP ${status}` };
    }
    const jobs = [];
    for (const row of data.jobs) {
        if (!row.title || !row.id)
            continue;
        const link = row.url || `https://remotive.com/remote-jobs/${row.id}`;
        const date = row.publication_date
            ? new Date(row.publication_date).toISOString()
            : new Date().toISOString();
        jobs.push({
            id: jobId("remotive", link),
            platform: "remotive",
            kind: "job",
            title: `${row.title}${row.company_name ? " @ " + row.company_name : ""}`,
            description: (row.description || "")
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 4000),
            link,
            date,
            budget: row.salary || undefined,
            fetchedAt: new Date().toISOString(),
            raw: {
                category: row.category,
                job_type: row.job_type,
                location: row.candidate_required_location,
            },
        });
    }
    return { jobs };
}
