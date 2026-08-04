import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
export async function fetchSeekClawJobs(opts) {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const offset = Math.max(opts?.offset ?? 0, 0);
    const qs = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
    });
    const url = `https://www.seekclaw.com/api/jobs?${qs}`;
    const { data, error, status } = await fetchJson(url, {
        headers: {
            Accept: "application/json",
            "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
        },
        proxy: false,
    });
    const rows = data?.data?.jobs || data?.jobs;
    if (error || !rows || !Array.isArray(rows)) {
        return { jobs: [], error: error || `SeekClaw HTTP ${status}` };
    }
    const jobs = [];
    for (const row of rows) {
        if (!row.title || row.id == null)
            continue;
        const link = row.url ||
            row.link ||
            (row.slug
                ? `https://www.seekclaw.com/jobs/${row.slug}`
                : `https://www.seekclaw.com/jobs/${row.id}`);
        const company = typeof row.company === "string"
            ? row.company
            : row.company?.name || "";
        const reward = row.budget ?? row.reward;
        const budget = reward != null
            ? `${reward}${row.currency ? ` ${row.currency}` : ""}`.trim()
            : undefined;
        const dateRaw = row.postedAt || row.createdAt || row.updatedAt;
        jobs.push({
            id: jobId("seekclaw", String(row.id)),
            platform: "seekclaw",
            kind: "gig",
            title: company ? `${row.title} @ ${company}` : row.title,
            description: (row.description || row.summary || "")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 4000),
            link,
            date: dateRaw ? new Date(dateRaw).toISOString() : new Date().toISOString(),
            budget,
            fetchedAt: new Date().toISOString(),
            raw: { status: row.status, skills: row.skills },
        });
    }
    return { jobs };
}
