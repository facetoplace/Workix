import { callMcpTool } from "../mcpClient.js";
import { jobId } from "../store.js";
const MCP_URL = "https://api.startup.jobs/mcp";
function rows(payload) {
    if (Array.isArray(payload))
        return payload;
    if (!payload || typeof payload !== "object")
        return [];
    const p = payload;
    for (const key of ["jobs", "results", "data", "listings"]) {
        if (Array.isArray(p[key]))
            return p[key];
    }
    return [];
}
export function startupJobsMcpEnabled() {
    return process.env.STARTUP_JOBS_MCP_ENABLED !== "0";
}
export async function callStartupJobsMcp(tool, args = {}) {
    const allowed = new Set([
        "search_jobs",
        "get_job",
        "get_company",
        "get_company_jobs",
        "list_roles",
        "list_countries",
        "job_trends",
        "salary_benchmarks",
    ]);
    if (!allowed.has(tool))
        return { error: `startup_jobs MCP tool is not allowlisted: ${tool}` };
    if (!startupJobsMcpEnabled())
        return { error: "startup_jobs MCP disabled" };
    return callMcpTool({
        url: process.env.STARTUP_JOBS_MCP_URL?.trim() || MCP_URL,
        tool,
        args,
        token: process.env.STARTUP_JOBS_API_KEY?.trim() || undefined,
        timeoutMs: 30000,
    });
}
export async function fetchStartupJobsMcp(opts) {
    if (!startupJobsMcpEnabled())
        return { jobs: [], error: "startup_jobs MCP disabled" };
    const keyword = (opts?.keywords || []).filter(Boolean).join(" ").trim() || undefined;
    const args = {
        ...(keyword ? { keyword } : {}),
        ...(opts?.remote !== undefined ? { remote: opts.remote } : {}),
        limit: Math.min(Math.max(opts?.limit ?? 40, 1), 100),
    };
    const res = await callStartupJobsMcp("search_jobs", args);
    if (res.error || res.isError)
        return { jobs: [], error: res.error || `startup_jobs MCP: ${(res.text || "request rejected").slice(0, 300)}` };
    const now = new Date().toISOString();
    const out = [];
    for (const row of rows(res.structured ?? res.data)) {
        const link = row.url || row.job_url || row.apply_url;
        const title = row.title || row.name;
        if (!link || !title)
            continue;
        const company = typeof row.company === "string" ? row.company : row.company?.name || row.company_name;
        out.push({
            id: jobId("startup_jobs", row.guid || row.id || link),
            platform: "startup_jobs",
            kind: "job",
            title: title.slice(0, 200),
            description: [company, row.location, row.workplace_type, row.description || row.summary].filter(Boolean).join("\n\n").slice(0, 4000),
            link,
            date: row.posted_at || row.published_at || now,
            budget: row.salary,
            fetchedAt: now,
            raw: { source: "startup_jobs_mcp", company, location: row.location, apply_url: row.apply_url },
        });
    }
    return out.length ? { jobs: out } : { jobs: [], error: "startup_jobs MCP: unexpected or empty search response" };
}
