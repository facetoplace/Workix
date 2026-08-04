import { fetchText } from "../http.js";
import { jobId } from "../store.js";
export async function fetchWorkingNomadsJobs(opts) {
    const category = opts?.category?.trim() ||
        process.env.WORKING_NOMADS_CATEGORY?.trim() ||
        "";
    const url = "https://www.workingnomads.com/api/exposed_jobs/";
    const res = await fetchText(url, {
        headers: {
            Accept: "application/json",
            "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
        },
        proxy: false,
        timeoutMs: 45000,
    });
    if (!res.ok) {
        return {
            jobs: [],
            error: res.error || `Working Nomads HTTP ${res.status}`,
        };
    }
    let data;
    try {
        data = JSON.parse(res.text);
    }
    catch (e) {
        return {
            jobs: [],
            error: e instanceof Error ? e.message : "Working Nomads JSON parse error",
        };
    }
    if (!Array.isArray(data)) {
        return { jobs: [], error: "Working Nomads: expected JSON array" };
    }
    const catLower = category.toLowerCase();
    const jobs = [];
    for (const row of data) {
        if (!row.title || !row.url)
            continue;
        if (catLower &&
            !(row.category_name || "").toLowerCase().includes(catLower) &&
            !(row.tags || []).some((t) => t.toLowerCase().includes(catLower))) {
            continue;
        }
        const company = row.company_name ? ` @ ${row.company_name}` : "";
        jobs.push({
            id: jobId("working_nomads", row.url),
            platform: "working_nomads",
            kind: "job",
            title: `${row.title}${company}`,
            description: (row.description || "")
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 4000),
            link: row.url,
            date: row.pub_date
                ? new Date(row.pub_date).toISOString()
                : new Date().toISOString(),
            fetchedAt: new Date().toISOString(),
            raw: {
                category: row.category_name,
                tags: row.tags,
                location: row.location,
            },
        });
    }
    return { jobs };
}
