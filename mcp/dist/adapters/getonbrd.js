import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
export async function fetchGetOnBrdJobs(opts) {
    const query = opts?.query?.trim() || process.env.GETONBRD_QUERY?.trim() || "developer";
    const perPage = Math.min(Math.max(opts?.perPage ?? 50, 1), 100);
    const remoteOnly = opts?.remoteOnly ?? process.env.GETONBRD_REMOTE_ONLY !== "0";
    const qs = new URLSearchParams({
        query,
        per_page: String(perPage),
        expand: "[]",
    });
    const url = `https://www.getonbrd.com/api/v0/search/jobs?${qs}`;
    const { data, error, status } = await fetchJson(url, {
        headers: {
            Accept: "application/json",
            "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
        },
        proxy: false,
    });
    if (error || !data?.data) {
        return { jobs: [], error: error || `Get on Board HTTP ${status}` };
    }
    const jobs = [];
    for (const row of data.data) {
        const a = row.attributes;
        const link = row.links?.public_url;
        if (!a?.title || !link)
            continue;
        if (remoteOnly && !a.remote)
            continue;
        // published_at is unix seconds, not ms.
        const date = a.published_at
            ? new Date(a.published_at * 1000).toISOString()
            : new Date().toISOString();
        const salary = a.min_salary && a.max_salary
            ? `${a.min_salary}–${a.max_salary} USD/mo`
            : a.min_salary
                ? `from ${a.min_salary} USD/mo`
                : undefined;
        jobs.push({
            id: jobId("getonbrd", row.id || link),
            platform: "getonbrd",
            kind: "job",
            title: a.title,
            description: `${a.description || ""}\n${a.functions || ""}`
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 4000),
            link,
            date,
            budget: salary,
            fetchedAt: new Date().toISOString(),
            raw: {
                remote: a.remote,
                remote_modality: a.remote_modality,
                remote_zone: a.remote_zone,
                category: a.category_name,
                countries: a.countries,
            },
        });
    }
    return { jobs };
}
