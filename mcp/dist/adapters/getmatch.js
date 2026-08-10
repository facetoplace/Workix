import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
/**
 * getmatch.ru — RU/relocate IT board. Public JSON, no key.
 *
 * Two quirks worth knowing before reading the code:
 *
 *  - There is no server-side search. Verified 2026-08-10: `q`, `search`,
 *    `text`, `query` and `sq` all leave `meta.total` at 750, so the parameter
 *    is silently dropped rather than rejected. Keyword filtering therefore has
 *    to happen here, over a page we pulled in full.
 *  - `limit=N` returns N+4. The extra four are pinned "one day offer" hiring
 *    events prepended outside the count, so paging by `meta.limit` would
 *    re-read them on every page. We page by the requested size instead.
 *
 * The board publishes salary on most cards — rare enough among RU sources that
 * it is the main reason to have it.
 */
const BASE = "https://getmatch.ru";
function skillNames(raw) {
    if (!Array.isArray(raw))
        return [];
    return raw
        .map((s) => (typeof s === "string" ? s : s?.name))
        .filter((s) => Boolean(s));
}
function plain(html) {
    return (html || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function salaryOf(o) {
    if (o.salary_hidden)
        return undefined;
    // The board already formats this the way it shows on the card
    // ("5 000 — 8 000 $/мес на руки"), so prefer it over recomposing.
    if (o.salary_description)
        return o.salary_description.replace(/​/g, "").trim();
    const { salary_display_from: lo, salary_display_to: hi, salary_currency: cur } = o;
    if (lo == null && hi == null)
        return undefined;
    const range = lo != null && hi != null ? `${lo}–${hi}` : String(lo ?? hi);
    const taxes = o.salary_taxes === "net" ? " на руки" : "";
    return `${range} ${cur || ""}${taxes}`.trim();
}
/** published_at comes back without a zone; the board serves Moscow-based UTC. */
function isoDate(raw) {
    if (!raw)
        return new Date().toISOString();
    const d = new Date(/[Z+]/.test(raw) ? raw : `${raw}Z`);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
export async function fetchGetmatchJobs(opts) {
    const want = Math.min(Math.max(opts?.limit ?? (Number(process.env.GETMATCH_LIMIT) || 100), 1), 750);
    const url = `${BASE}/api/offers?limit=${want}&offset=0`;
    const { data, error, status } = await fetchJson(url, {
        headers: { Accept: "application/json" },
        proxy: false,
    });
    if (error || !data?.offers) {
        return { jobs: [], error: error || `getmatch HTTP ${status}` };
    }
    const needles = (opts?.keywords || [])
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean);
    const jobs = [];
    for (const o of data.offers) {
        if (o.is_active === false)
            continue;
        if (!o.position || !o.url)
            continue;
        const skills = skillNames(o.skills_objects);
        const body = plain(o.description_html || o.offer_description);
        if (needles.length) {
            const hay = `${o.position} ${skills.join(" ")} ${body}`.toLowerCase();
            if (!needles.some((n) => hay.includes(n)))
                continue;
        }
        const locations = (o.location_items || [])
            .map((l) => l.label)
            .filter((l) => Boolean(l));
        jobs.push({
            id: jobId("getmatch", String(o.id ?? o.url)),
            platform: "getmatch",
            kind: "job",
            title: o.position,
            description: body.slice(0, 4000),
            link: `${BASE}${o.url}`,
            date: isoDate(o.published_at),
            budget: salaryOf(o),
            fetchedAt: new Date().toISOString(),
            raw: {
                company: o.company?.name,
                skills,
                locations,
                english_level: o.english_level,
                // "one_day_offer_*" cards are hiring events, not open roles — the
                // apply flow is a scheduled interview day, so flag rather than drop.
                offer_type: o.offer_type,
            },
        });
    }
    return { jobs, totalCount: data.meta?.total };
}
