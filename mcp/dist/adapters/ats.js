import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
/**
 * Employer career boards read straight from the ATS.
 *
 * Every other job source in Workix is an aggregator: it copies a posting and
 * hands us a link that may already be dead. These endpoints are the employer's
 * own board, so the apply URL is always the live one and there is no attribution
 * clause to honour. One company = one call, so coverage is the company list in
 * `ats-companies.json`, not the vendor.
 *
 * All five providers are public and keyless. Verified live 2026-08-10: all
 * five return real postings, Workable included — its parser had shipped
 * untested only because `ats-companies.json` carried no Workable slug, not
 * because the endpoint was broken. Most Workable accounts genuinely sit at
 * `total: 0` between hiring rounds, which is what made it look dead; `zego`
 * had 35 open roles and the parser mapped them first try.
 *
 * Note for whoever widens the list: an unknown slug is not a 404. Workable
 * answers `{"total":0,"results":[]}` for a wrong slug exactly as it does for a
 * real company with nothing open, so a typo here is invisible. Check the slug
 * against apply.workable.com/<slug>/ — that one does redirect to /oops.
 */
function mcpRoot() {
    return (process.env.WORKIX_MCP_ROOT?.trim() ||
        join(dirname(fileURLToPath(import.meta.url)), "..", ".."));
}
function clean(s) {
    return (s || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 4000);
}
function push(jobs, co, fields) {
    const company = co.name || co.slug;
    jobs.push({
        id: jobId("ats", `${co.ats}:${co.slug}:${fields.key}`),
        platform: "ats",
        kind: "job",
        title: `${fields.title} @ ${company}`,
        description: clean(fields.description),
        link: fields.link,
        date: fields.date
            ? new Date(fields.date).toISOString()
            : new Date().toISOString(),
        fetchedAt: new Date().toISOString(),
        raw: { ats: co.ats, company, slug: co.slug, ...(fields.raw || {}) },
    });
}
/** Parse ATS_COMPANIES="greenhouse:stripe,ashby:linear" into company rows. */
function parseEnvCompanies(raw) {
    const out = [];
    for (const chunk of raw.split(/[,\s]+/)) {
        const [ats, slug] = chunk.split(":").map((s) => s?.trim());
        if (!ats || !slug)
            continue;
        out.push({ ats: ats, slug });
    }
    return out;
}
export function loadAtsCompanies() {
    const fromEnv = process.env.ATS_COMPANIES?.trim();
    if (fromEnv)
        return parseEnvCompanies(fromEnv);
    try {
        const raw = JSON.parse(readFileSync(join(mcpRoot(), "ats-companies.json"), "utf8"));
        return (raw.companies || []).filter((c) => c?.ats && c?.slug);
    }
    catch {
        return [];
    }
}
const JSON_HEADERS = {
    Accept: "application/json",
    "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
};
async function fetchOne(co) {
    const jobs = [];
    if (co.ats === "greenhouse") {
        const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(co.slug)}/jobs`;
        const { data, error, status } = await fetchJson(url, { headers: JSON_HEADERS, proxy: false });
        if (error || !data?.jobs) {
            return { jobs, error: error || `greenhouse:${co.slug} HTTP ${status}` };
        }
        for (const j of data.jobs) {
            if (!j.title || !j.absolute_url)
                continue;
            push(jobs, co, {
                key: String(j.id || j.absolute_url),
                title: j.title,
                link: j.absolute_url,
                date: j.updated_at,
                raw: {
                    location: j.location?.name,
                    departments: j.departments?.map((d) => d.name),
                },
            });
        }
        return { jobs };
    }
    if (co.ats === "ashby") {
        const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(co.slug)}`;
        const { data, error, status } = await fetchJson(url, {
            headers: JSON_HEADERS,
            proxy: false,
        });
        if (error || !data?.jobs) {
            return { jobs, error: error || `ashby:${co.slug} HTTP ${status}` };
        }
        for (const j of data.jobs) {
            const link = j.jobUrl || j.applyUrl;
            if (!j.title || !link || j.isListed === false)
                continue;
            push(jobs, co, {
                key: j.id || link,
                title: j.title.trim(),
                link,
                date: j.publishedAt,
                description: j.descriptionPlain,
                raw: {
                    location: j.location,
                    department: j.department,
                    team: j.team,
                    employmentType: j.employmentType,
                    remote: j.isRemote,
                    workplaceType: j.workplaceType,
                },
            });
        }
        return { jobs };
    }
    if (co.ats === "lever") {
        const url = `https://api.lever.co/v0/postings/${encodeURIComponent(co.slug)}?mode=json`;
        const { data, error, status } = await fetchJson(url, {
            headers: JSON_HEADERS,
            proxy: false,
        });
        if (error || !Array.isArray(data)) {
            return { jobs, error: error || `lever:${co.slug} HTTP ${status}` };
        }
        for (const j of data) {
            const link = j.hostedUrl || j.applyUrl;
            if (!j.text || !link)
                continue;
            push(jobs, co, {
                key: j.id || link,
                title: j.text,
                link,
                date: j.createdAt,
                description: j.descriptionPlain,
                raw: {
                    location: j.categories?.location,
                    commitment: j.categories?.commitment,
                    team: j.categories?.team,
                    department: j.categories?.department,
                },
            });
        }
        return { jobs };
    }
    if (co.ats === "smartrecruiters") {
        const url = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(co.slug)}/postings?limit=100`;
        const { data, error, status } = await fetchJson(url, { headers: JSON_HEADERS, proxy: false });
        if (error || !data?.content) {
            return {
                jobs,
                error: error || `smartrecruiters:${co.slug} HTTP ${status}`,
            };
        }
        for (const j of data.content) {
            if (!j.name || !j.id)
                continue;
            const identifier = j.company?.identifier || co.slug;
            push(jobs, co, {
                key: j.id,
                title: j.name,
                link: `https://jobs.smartrecruiters.com/${identifier}/${j.id}`,
                date: j.releasedDate,
                raw: {
                    location: [j.location?.city, j.location?.region, j.location?.country]
                        .filter(Boolean)
                        .join(", "),
                    remote: j.location?.remote,
                    employment: j.typeOfEmployment?.label,
                },
            });
        }
        return { jobs };
    }
    // Workable: POST-only search endpoint, so it bypasses fetchJson.
    const url = `https://apply.workable.com/api/v3/accounts/${encodeURIComponent(co.slug)}/jobs`;
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { ...JSON_HEADERS, "Content-Type": "application/json" },
            body: JSON.stringify({ query: "", location: [], department: [] }),
        });
        if (!res.ok)
            return { jobs, error: `workable:${co.slug} HTTP ${res.status}` };
        const data = (await res.json());
        for (const j of data.results || []) {
            const link = j.url ||
                (j.shortcode
                    ? `https://apply.workable.com/${co.slug}/j/${j.shortcode}/`
                    : "");
            if (!j.title || !link)
                continue;
            push(jobs, co, {
                key: j.id || j.shortcode || link,
                title: j.title,
                link,
                date: j.published,
                raw: {
                    location: [j.location?.city, j.location?.country]
                        .filter(Boolean)
                        .join(", "),
                    workplaceType: j.location?.workplaceType,
                    department: j.department,
                },
            });
        }
        return { jobs };
    }
    catch (e) {
        return {
            jobs,
            error: `workable:${co.slug} ${e instanceof Error ? e.message : String(e)}`,
        };
    }
}
export async function fetchAtsJobs(opts) {
    const companies = opts?.companies?.length
        ? opts.companies
        : loadAtsCompanies();
    if (!companies.length) {
        return { jobs: [], error: "ats: no companies configured (optional)" };
    }
    const limit = Math.min(Math.max(opts?.concurrency ?? 4, 1), 8);
    const queue = [...companies];
    const jobs = [];
    const errors = [];
    async function worker() {
        for (;;) {
            const co = queue.shift();
            if (!co)
                return;
            const r = await fetchOne(co);
            jobs.push(...r.jobs);
            if (r.error)
                errors.push(r.error);
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, companies.length) }, () => worker()));
    const kw = (opts?.keywords || [])
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean);
    // Match the body too, not just the title. Employer titles are role-shaped
    // ("Security Engineer, Cloud"), never stack-shaped, so a title-only filter
    // silently deleted the largest source in the set on any technology keyword —
    // measured 2026-08-10: "python" hit 0 of 3 590 titles and 201 descriptions.
    const filtered = kw.length
        ? jobs.filter((j) => {
            const hay = `${j.title}\n${j.description || ""}`.toLowerCase();
            return kw.some((k) => hay.includes(k));
        })
        : jobs;
    // A dead slug in a long list is noise, not a failure — only report when the
    // whole fan-out came back empty.
    if (!filtered.length && errors.length) {
        return { jobs: [], error: `ats: ${errors.slice(0, 3).join("; ")}` };
    }
    return { jobs: filtered };
}
