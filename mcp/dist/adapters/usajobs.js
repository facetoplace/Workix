import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
export function usajobsConfigured() {
    return Boolean(process.env.USAJOBS_API_KEY?.trim() && process.env.USAJOBS_EMAIL?.trim());
}
export async function fetchUsaJobs(opts) {
    const key = process.env.USAJOBS_API_KEY?.trim();
    const email = process.env.USAJOBS_EMAIL?.trim();
    if (!key || !email) {
        return {
            jobs: [],
            error: "usajobs: USAJOBS_API_KEY + USAJOBS_EMAIL missing (optional)",
        };
    }
    const keyword = opts?.keyword?.trim() || process.env.USAJOBS_KEYWORD?.trim() || "software";
    const perPage = Math.min(Math.max(opts?.resultsPerPage ?? 50, 1), 500);
    const remoteOnly = opts?.remoteOnly ?? process.env.USAJOBS_REMOTE_ONLY === "1";
    const qs = new URLSearchParams({
        Keyword: keyword,
        ResultsPerPage: String(perPage),
        SortField: "opendate",
        SortDirection: "desc",
    });
    if (remoteOnly)
        qs.set("RemoteIndicator", "True");
    const { data, error, status } = await fetchJson(`https://data.usajobs.gov/api/search?${qs}`, {
        headers: {
            Host: "data.usajobs.gov",
            "User-Agent": email,
            "Authorization-Key": key,
            Accept: "application/json",
        },
        proxy: false,
    });
    if (error || !data?.SearchResult?.SearchResultItems) {
        return { jobs: [], error: error || `USAJOBS HTTP ${status}` };
    }
    const jobs = [];
    for (const item of data.SearchResult.SearchResultItems) {
        const d = item.MatchedObjectDescriptor;
        const link = d?.PositionURI || d?.ApplyURI?.[0];
        if (!d?.PositionTitle || !link)
            continue;
        const pay = d.PositionRemuneration?.[0];
        const org = d.OrganizationName ? ` @ ${d.OrganizationName}` : "";
        jobs.push({
            id: jobId("usajobs", item.MatchedObjectId || link),
            platform: "usajobs",
            kind: "job",
            title: `${d.PositionTitle}${org}`,
            description: (d.UserArea?.Details?.JobSummary || "")
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 4000),
            link,
            date: d.PublicationStartDate
                ? new Date(d.PublicationStartDate).toISOString()
                : new Date().toISOString(),
            budget: pay?.MinimumRange && pay?.MaximumRange
                ? `${pay.MinimumRange}–${pay.MaximumRange} USD/${pay.RateIntervalCode || "yr"}`
                : undefined,
            fetchedAt: new Date().toISOString(),
            raw: {
                location: d.PositionLocationDisplay,
                department: d.DepartmentName,
                schedule: d.PositionSchedule?.map((s) => s.Name),
                telework: d.UserArea?.Details?.TeleworkEligible,
                closes: d.ApplicationCloseDate,
            },
        });
    }
    return { jobs, totalCount: data.SearchResult.SearchResultCountAll };
}
