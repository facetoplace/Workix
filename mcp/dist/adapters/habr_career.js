import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
export async function fetchHabrCareerJobs(opts) {
    const maxPages = Math.min(Math.max(opts?.pages ?? 2, 1), 5);
    const remoteOnly = opts?.remoteOnly ?? process.env.HABR_CAREER_REMOTE_ONLY !== "0";
    const kw = (opts?.keywords || [])
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean);
    const jobs = [];
    let lastError = "";
    let total;
    for (let page = 1; page <= maxPages; page++) {
        const qs = new URLSearchParams({
            sort: "date",
            type: "all",
            page: String(page),
        });
        if (remoteOnly)
            qs.set("remote", "true");
        const url = `https://career.habr.com/api/frontend/vacancies?${qs}`;
        const { data, error, status } = await fetchJson(url, {
            headers: {
                Accept: "application/json",
                "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
                Referer: "https://career.habr.com/vacancies",
            },
            proxy: false,
        });
        if (error || !data?.list) {
            lastError = error || `Habr Career HTTP ${status}`;
            break;
        }
        total = data.meta?.totalResults ?? total;
        for (const v of data.list) {
            if (!v.title || !v.href || v.archived)
                continue;
            const company = v.company?.title ? ` @ ${v.company.title}` : "";
            const title = `${v.title}${company}`;
            if (kw.length && !kw.some((k) => title.toLowerCase().includes(k))) {
                continue;
            }
            const link = `https://career.habr.com${v.href}`;
            jobs.push({
                id: jobId("habr_career", link),
                platform: "habr_career",
                kind: "job",
                title,
                description: [
                    v.salaryQualification?.title
                        ? `Грейд: ${v.salaryQualification.title}`
                        : "",
                    v.skills?.length
                        ? `Навыки: ${v.skills.map((s) => s.title).filter(Boolean).join(", ")}`
                        : "",
                    v.divisions?.length
                        ? `Направление: ${v.divisions.map((d) => d.title).filter(Boolean).join(", ")}`
                        : "",
                    v.locations?.length
                        ? `Локация: ${v.locations.map((l) => l.title).filter(Boolean).join(", ")}`
                        : "",
                    v.remoteWork ? "Можно удалённо" : "",
                ]
                    .filter(Boolean)
                    .join("\n"),
                link,
                date: v.publishedDate?.date
                    ? new Date(v.publishedDate.date).toISOString()
                    : new Date().toISOString(),
                budget: v.salary?.formatted?.trim() || undefined,
                fetchedAt: new Date().toISOString(),
                raw: {
                    remote: v.remoteWork,
                    employment: v.employment,
                    qualification: v.salaryQualification?.title,
                    company_accredited: v.company?.accredited,
                    company_rating: v.company?.rating?.value,
                    skills: v.skills?.map((s) => s.title),
                },
            });
        }
        if (!data.list.length)
            break;
    }
    if (!jobs.length && lastError)
        return { jobs: [], error: lastError };
    return { jobs, error: lastError || undefined, totalCount: total };
}
