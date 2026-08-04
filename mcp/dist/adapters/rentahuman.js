import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
export async function fetchRentAHumanJobs(opts) {
    const pageSize = Math.min(Math.max(opts?.limit ?? 25, 1), 50);
    const maxPages = Math.min(Math.max(opts?.pages ?? 2, 1), 4);
    const jobs = [];
    let cursor;
    for (let page = 0; page < maxPages; page++) {
        const qs = new URLSearchParams({ limit: String(pageSize) });
        if (cursor)
            qs.set("cursor", cursor);
        const url = `https://rentahuman.ai/api/bounties?${qs}`;
        const { data, error, status } = await fetchJson(url, {
            headers: {
                Accept: "application/json",
                "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
            },
            proxy: false,
        });
        if (error || !data?.bounties || !Array.isArray(data.bounties)) {
            if (!jobs.length) {
                return { jobs: [], error: error || `RentAHuman HTTP ${status}` };
            }
            break;
        }
        for (const row of data.bounties) {
            if (!row.title || !row.id)
                continue;
            if (row.status && !/open|partially/i.test(row.status))
                continue;
            const link = `https://rentahuman.ai/bounties/${row.id}`;
            const budget = row.price != null
                ? `${row.price} ${row.currency || "USD"}${row.priceType ? ` (${row.priceType})` : ""}`
                : undefined;
            const dateRaw = row.wentLiveAt || row.createdAt || row.deadline;
            const loc = row.location?.isRemoteAllowed
                ? "remote ok"
                : row.location?.country || "";
            jobs.push({
                id: jobId("rentahuman", row.id),
                platform: "rentahuman",
                kind: "gig",
                title: row.agentName
                    ? `${row.title} (by ${row.agentName})`
                    : row.title,
                description: [
                    row.description || "",
                    row.category ? `category: ${row.category}` : "",
                    loc ? `location: ${loc}` : "",
                    row.skillsNeeded?.length
                        ? `skills: ${row.skillsNeeded.join(", ")}`
                        : "",
                ]
                    .filter(Boolean)
                    .join("\n")
                    .replace(/\s+/g, " ")
                    .trim()
                    .slice(0, 4000),
                link,
                date: dateRaw
                    ? new Date(dateRaw).toISOString()
                    : new Date().toISOString(),
                budget,
                fetchedAt: new Date().toISOString(),
                raw: {
                    status: row.status,
                    agentType: row.agentType,
                    spotsRemaining: row.spotsRemaining,
                    category: row.category,
                },
            });
        }
        if (!data.hasMore || !data.nextCursor)
            break;
        cursor = data.nextCursor;
    }
    return { jobs };
}
