import { callMcpTool } from "../mcpClient.js";
import { jobId } from "../store.js";
/**
 * Dice — US tech-only board, reached through its own MCP server.
 *
 * Dice ships no public REST API; the MCP server at mcp.dice.com is the whole
 * public surface, and it answers tools/call without any authentication
 * (verified 2026-08-10: 5 073 hits for "python", real cards, live apply URLs).
 * So this is a bridge in the same spirit as the JobSpy one — we speak to
 * somebody else's server rather than reimplementing their board.
 *
 * Two things it gives us that no other source in the set does: a salary on
 * most cards, and `willingToSponsor` — visa sponsorship as a first-class
 * filter, which is the single most asked-for thing in relocation searches.
 *
 * Quirk worth pinning: `posted_date` is an enum and it is case-sensitive —
 * ONE | THREE | SEVEN. Lowercase gets a pydantic validation error rather than
 * being coerced.
 */
const MCP_URL = "https://mcp.dice.com/mcp";
/** Dice buckets recency into three fixed windows; pick the smallest that covers. */
function postedWindow(hours) {
    if (!hours)
        return undefined;
    if (hours <= 24)
        return "ONE";
    if (hours <= 72)
        return "THREE";
    if (hours <= 168)
        return "SEVEN";
    return undefined;
}
export async function fetchDiceJobs(opts) {
    const keyword = (opts?.keywords || []).filter(Boolean).join(" ").trim() ||
        process.env.DICE_KEYWORD?.trim() ||
        "developer";
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const sponsor = opts?.willingToSponsor ?? (process.env.DICE_SPONSOR_ONLY === "1" || undefined);
    const remoteOnly = opts?.remoteOnly ?? (process.env.DICE_REMOTE_ONLY === "1" || undefined);
    const args = {
        keyword,
        jobs_per_page: limit,
        page_number: 1,
    };
    const posted = postedWindow(opts?.hours);
    if (posted)
        args.posted_date = posted;
    if (opts?.location)
        args.location = opts.location;
    if (sponsor)
        args.willing_to_sponsor = true;
    if (remoteOnly)
        args.workplace_types = ["Remote"];
    const res = await callMcpTool({ url: MCP_URL, tool: "search_jobs", args });
    if (res.error)
        return { jobs: [], error: `dice: ${res.error}` };
    if (res.isError) {
        // The server puts validation failures in the text block, not in the RPC
        // error — passing them through is the difference between "0 results" and
        // "you sent the wrong enum".
        return { jobs: [], error: `dice: ${(res.text || "rejected").slice(0, 300)}` };
    }
    const payload = (res.structured ?? res.data);
    const rows = payload?.data;
    if (!Array.isArray(rows)) {
        return { jobs: [], error: "dice: unexpected response shape" };
    }
    const now = new Date().toISOString();
    const jobs = [];
    for (const row of rows) {
        const link = row.detailsPageUrl;
        if (!link || !row.title)
            continue;
        jobs.push({
            id: jobId("dice", row.guid || row.id || link),
            platform: "dice",
            kind: "job",
            title: row.title,
            description: (row.summary || "").replace(/\s+/g, " ").trim().slice(0, 4000),
            link,
            date: row.postedDate || row.modifiedDate || now,
            budget: row.salary?.trim() || undefined,
            fetchedAt: now,
            raw: {
                company: row.companyName,
                location: row.jobLocation?.displayName,
                employmentType: row.employmentType,
                employerType: row.employerType,
                workplaceTypes: row.workplaceTypes,
                isRemote: row.isRemote,
                // Dice is the only source in the set that publishes this.
                willingToSponsor: row.willingToSponsor,
                easyApply: row.easyApply,
            },
        });
    }
    return { jobs, totalCount: payload?.metadata?.total };
}
