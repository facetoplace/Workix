import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
function budgetOf(p) {
    const s = p.salary;
    if (!s?.from && !s?.to)
        return undefined;
    const cur = s.currency || "PLN";
    const type = s.type ? ` ${s.type}` : "";
    if (s.from && s.to && s.from !== s.to) {
        return `${s.from}–${s.to} ${cur}/mo${type}`;
    }
    return `${s.from || s.to} ${cur}/mo${type}`;
}
export async function fetchNoFluffJobs(opts) {
    const category = opts?.category?.trim() || process.env.NOFLUFF_CATEGORY?.trim() || "backend";
    const region = opts?.region?.trim() || process.env.NOFLUFF_REGION?.trim() || "pl";
    // Opt-in, unlike the remote-first boards: NoFluff is a regional board and
    // `fullyRemote` is false on most rows even when "Remote" is one of the
    // listed places, so defaulting this on filtered all 20k postings away.
    const remoteOnly = opts?.remoteOnly ?? process.env.NOFLUFF_REMOTE_ONLY === "1";
    const limit = Math.min(Math.max(opts?.limit ?? 200, 1), 1000);
    const qs = new URLSearchParams({
        criteria: `category=${category}`,
        page: "1",
        salaryCurrency: "PLN",
        salaryPeriod: "month",
        region,
    });
    const url = `https://nofluffjobs.com/api/joboffers/main?${qs}`;
    const { data, error, status } = await fetchJson(url, {
        headers: {
            Accept: "application/json",
            "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
        },
        proxy: false,
    });
    if (error || !data?.postings) {
        return { jobs: [], error: error || `NoFluffJobs HTTP ${status}` };
    }
    const kw = (opts?.keywords || [])
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean);
    const jobs = [];
    for (const p of data.postings) {
        if (!p.title || !p.url)
            continue;
        const isRemote = Boolean(p.fullyRemote) ||
            (p.location?.places || []).some((pl) => /remote/i.test(pl.city || ""));
        if (remoteOnly && !isRemote)
            continue;
        const title = `${p.title}${p.name ? ` @ ${p.name}` : ""}`;
        if (kw.length && !kw.some((k) => title.toLowerCase().includes(k)))
            continue;
        const link = `https://nofluffjobs.com/job/${p.url}`;
        const cities = (p.location?.places || [])
            .map((pl) => pl.city)
            .filter(Boolean);
        jobs.push({
            id: jobId("nofluff", p.id || link),
            platform: "nofluff",
            kind: "job",
            title,
            description: [
                p.seniority?.length ? `Seniority: ${p.seniority.join(", ")}` : "",
                p.category ? `Category: ${p.category}` : "",
                cities.length ? `Locations: ${cities.slice(0, 6).join(", ")}` : "",
                isRemote ? "Remote" : "",
            ]
                .filter(Boolean)
                .join("\n"),
            link,
            date: new Date(p.renewed || p.posted || Date.now()).toISOString(),
            budget: budgetOf(p),
            fetchedAt: new Date().toISOString(),
            raw: {
                category: p.category,
                seniority: p.seniority,
                remote: isRemote,
                fullyRemote: p.fullyRemote,
                regions: p.regions,
            },
        });
        if (jobs.length >= limit)
            break;
    }
    return { jobs, totalCount: data.totalCount };
}
