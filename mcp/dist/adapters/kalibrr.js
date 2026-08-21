import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
/**
 * Kalibrr (PH + SEA) — public job board JSON on `GET /kjs/job_board/search`.
 * Verified 2026-08-11: `limit` alone answers 400 with a helpful
 * `application/problem+json` ("Missing query parameter 'offset'"); with both it
 * returns 200.
 *
 * Job URL is assembled, not served: `/c/<company.code>/jobs/<id>/<slug>`
 * (checked against a live posting — 200, no redirect).
 */
const BASE = "https://www.kalibrr.com";
const SEARCH = `${BASE}/kjs/job_board/search`;
function stripHtml(s) {
    return (s || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim();
}
function locationOf(job) {
    const a = job.google_location?.address_components || {};
    return [a.city, a.region, a.country].filter(Boolean).join(", ");
}
function salaryOf(job) {
    if (!job.salary_shown)
        return undefined;
    const lo = job.base_salary;
    const hi = job.maximum_salary;
    if (!lo && !hi)
        return undefined;
    const cur = job.salary_currency || "";
    const per = job.salary_interval ? `/${job.salary_interval}` : "";
    return `${lo ?? "?"}–${hi ?? "?"} ${cur}${per}`.trim();
}
export async function fetchKalibrrJobs(opts) {
    const limitRaw = opts?.limit ?? Number(process.env.KALIBRR_LIMIT);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 40;
    const text = opts?.keywords?.filter(Boolean).join(" ") ||
        process.env.KALIBRR_TEXT?.trim() ||
        "";
    const qs = new URLSearchParams({
        limit: String(limit),
        offset: "0",
    });
    if (text)
        qs.set("text", text);
    const { data, error, status } = await fetchJson(`${SEARCH}?${qs}`, {
        headers: { Accept: "application/json", "Accept-Language": "en-US,en;q=0.9" },
        proxy: false,
    });
    if (error || !data?.jobs) {
        return { jobs: [], error: error || `Kalibrr HTTP ${status}` };
    }
    const jobs = [];
    for (const j of data.jobs) {
        const code = j.company?.code;
        if (!j.id || !j.name || !code)
            continue;
        const link = `${BASE}/c/${code}/jobs/${j.id}/${j.slug || ""}`.replace(/\/$/, "");
        const company = j.company?.name || j.company_name;
        const remote = j.is_work_from_home
            ? "Remote"
            : j.is_hybrid
                ? "Hybrid"
                : undefined;
        jobs.push({
            id: jobId("kalibrr", link),
            platform: "kalibrr",
            kind: "job",
            title: `${j.name}${company ? ` @ ${company}` : ""}`.slice(0, 200),
            description: [
                stripHtml(j.description).slice(0, 2500),
                stripHtml(j.qualifications).slice(0, 800),
                [locationOf(j), remote].filter(Boolean).join(" · "),
            ]
                .filter(Boolean)
                .join("\n\n"),
            link,
            date: j.activation_date
                ? new Date(j.activation_date).toISOString()
                : new Date().toISOString(),
            budget: salaryOf(j),
            fetchedAt: new Date().toISOString(),
            raw: {
                company,
                industry: j.company?.industry,
                location: locationOf(j),
                remote: Boolean(j.is_work_from_home),
                hybrid: Boolean(j.is_hybrid),
                function: j.function,
                region: "ph",
            },
        });
    }
    return {
        jobs,
        totalCount: data.count,
        error: jobs.length ? undefined : "kalibrr: no jobs in response",
    };
}
export async function pingKalibrr() {
    const started = Date.now();
    const r = await fetchKalibrrJobs({ limit: 5 });
    return {
        platform: "kalibrr",
        ok: r.jobs.length > 0,
        status: r.jobs.length ? 200 : 0,
        ms: Date.now() - started,
        viaProxy: false,
        items: r.jobs.length,
        error: r.error,
        source: SEARCH,
    };
}
