import { detectCompanyTechStack, fetchJobsPipeJobs, jobspipeUsage, resetJobspipeUsage, } from "../adapters/jobspipe.js";
/**
 * JobsPipe is metered — one credit per job returned — so these tools exist to
 * make the meter visible and to let a search be aimed precisely instead of
 * pulled blind through the digest.
 */
export async function runJobspipeUsage(args) {
    if (args?.reset) {
        resetJobspipeUsage();
    }
    const u = jobspipeUsage();
    return {
        ...u,
        note: u.configured
            ? "1 credit = 1 job returned. The counter is local: it tracks what this MCP spent, not what JobsPipe billed."
            : "Set JOBS_PIPE_KEY (or JOBSPIPE_API_KEY) in .env, then restart the MCP.",
        hint: u.remaining <= 0
            ? "Budget spent. Raise JOBSPIPE_MONTHLY_BUDGET or reset if the plan renewed."
            : `${u.remaining} of ${u.budget} jobs left this month.`,
    };
}
export async function runJobspipeSearch(args) {
    const before = jobspipeUsage();
    const r = await fetchJobsPipeJobs({
        titles: args.titles,
        excludeTitles: args.exclude_titles,
        keywords: args.keywords,
        companies: args.companies,
        skills: args.skills,
        locations: args.locations,
        countries: args.countries,
        sources: args.sources,
        excludeSources: args.exclude_sources,
        seniority: args.seniority,
        remoteOnly: args.remote_only,
        maxAgeDays: args.max_age_days,
        limit: args.limit,
    });
    const after = jobspipeUsage();
    return {
        items: r.jobs.length,
        error: r.error,
        spent_this_call: after.jobs - before.jobs,
        remaining_this_month: after.remaining,
        jobs: r.jobs.map((j) => ({
            id: j.id,
            title: j.title,
            link: j.link,
            date: j.date,
            budget: j.budget,
            raw: j.raw,
        })),
    };
}
export async function runCompanyTechStack(args) {
    const r = await detectCompanyTechStack(args);
    return {
        domain: args.domain,
        ok: r.ok,
        error: r.error,
        stack: r.result,
        note: "Free of job credits — this runs on JobsPipe's stack scanner, not the jobs quota.",
    };
}
