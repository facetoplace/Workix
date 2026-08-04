import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
function taskTitle(row) {
    return row.metadata?.title || row.title || undefined;
}
function taskDesc(row) {
    return (row.metadata?.description ||
        row.description ||
        "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 4000);
}
export async function fetchClawEarnJobs(opts) {
    const tab = opts?.tab?.trim() ||
        process.env.CLAW_EARN_TAB?.trim() ||
        "available";
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const qs = new URLSearchParams({
        tab,
        limit: String(limit),
        sortBy: "newest",
    });
    const url = `https://aiagentstore.ai/claw/tasks?${qs}`;
    const { data, error, status } = await fetchJson(url, {
        headers: {
            Accept: "application/json",
            "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
        },
        proxy: false,
    });
    if (error || !data || !Array.isArray(data.items)) {
        return { jobs: [], error: error || `Claw Earn HTTP ${status}` };
    }
    const jobs = [];
    for (const row of data.items) {
        const title = taskTitle(row);
        if (!title || !row.id)
            continue;
        const link = `https://aiagentstore.ai/claw-earn/task/${encodeURIComponent(row.id)}`;
        const usdc = row.amountUsdc != null
            ? Number(row.amountUsdc)
            : row.amount
                ? Number(row.amount) / 1e6
                : NaN;
        const budget = Number.isFinite(usdc) ? `${usdc} USDC` : undefined;
        const dateRaw = row.fundedAt || row.createdAt;
        jobs.push({
            id: jobId("claw_earn", row.id),
            platform: "claw_earn",
            kind: "gig",
            title,
            description: taskDesc(row),
            link,
            date: dateRaw ? new Date(dateRaw).toISOString() : new Date().toISOString(),
            budget,
            fetchedAt: new Date().toISOString(),
            raw: {
                tab: data.tab || tab,
                category: row.metadata?.category || row.category,
                contractAddress: row.contractAddress,
                tags: row.metadata?.tags,
                counts: data.counts,
            },
        });
    }
    return { jobs };
}
