/**
 * Liveness checks for job links.
 *
 * Boards keep serving a URL long after the posting is gone: 4dayweek.io
 * redirects a removed job to its homepage with HTTP 200, so status codes alone
 * say nothing. These checks look at where the request actually landed and what
 * the page says.
 */
import { fetchText } from "./http.js";
/**
 * A posting that lands on one of its own ancestor paths is gone: 4dayweek
 * bounces a removed job from /jobs/<slug> to /jobs, others go to the site root.
 * Redirects deeper or sideways are normal (slug renames, ATS hand-offs).
 */
function redirectedUpwards(requested, finalUrl) {
    if (!finalUrl)
        return false;
    try {
        const a = new URL(requested);
        const b = new URL(finalUrl);
        if (a.hostname.replace(/^www\./, "") !== b.hostname.replace(/^www\./, "")) {
            return false; // cross-host redirect is normal for ATS links
        }
        const aPath = a.pathname.replace(/\/+$/, "");
        const bPath = b.pathname.replace(/\/+$/, "");
        if (aPath === bPath || aPath.length <= 1)
            return false;
        return bPath.length <= 1 || aPath.startsWith(`${bPath}/`);
    }
    catch {
        return false;
    }
}
const GONE_MARKERS = [
    /вакансия в архиве/i,
    /вакансия закрыта/i,
    /this job (?:posting )?(?:is no longer|has expired|is closed)/i,
    /no longer accepting applications/i,
    /position has been filled/i,
    /job not found/i,
    /такой страницы не существует/i,
];
/**
 * Markers are only trusted in rendered content. hh ships every UI string in
 * its JS bundle *and* in a <template> SSR payload, so testing the raw HTML
 * reports live vacancies as archived — both have to be stripped first.
 */
function goneMarker(html) {
    const body = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<template[\s\S]*?<\/template>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
    for (const rx of GONE_MARKERS) {
        if (rx.test(body))
            return rx.source;
    }
    return undefined;
}
function pageTitle(html) {
    const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return m?.[1].replace(/\s+/g, " ").trim().toLowerCase() || undefined;
}
/** Root <title> per host, so the soft-404 comparison costs one fetch per site. */
const rootTitles = new Map();
async function rootTitle(origin) {
    if (rootTitles.has(origin))
        return rootTitles.get(origin);
    let title;
    try {
        const res = await fetchText(origin, { proxy: false, timeoutMs: 15000 });
        if (res.ok)
            title = pageTitle(res.text);
    }
    catch {
        /* leave undefined — comparison is then skipped */
    }
    rootTitles.set(origin, title);
    return title;
}
export async function checkLink(url) {
    let res;
    try {
        res = await fetchText(url, { proxy: false, timeoutMs: 15000 });
    }
    catch (e) {
        return { url, state: "unknown", reason: e?.message };
    }
    if (res.status === 404 || res.status === 410) {
        return { url, state: "gone", reason: `HTTP ${res.status}` };
    }
    if (!res.ok) {
        // 403 from anti-bot says nothing about whether the posting exists.
        return { url, state: "unknown", reason: res.error || `HTTP ${res.status}` };
    }
    if (redirectedUpwards(url, res.finalUrl)) {
        return { url, state: "gone", reason: `редирект на ${res.finalUrl} — пост удалён` };
    }
    const marker = goneMarker(res.text);
    if (marker)
        return { url, state: "gone", reason: `маркер: ${marker}` };
    // Soft 404: SPA boards answer a removed posting with the homepage under the
    // original URL and HTTP 200. Same <title> as the site root gives it away.
    try {
        const origin = new URL(url).origin;
        const pageT = pageTitle(res.text);
        if (pageT) {
            const rootT = await rootTitle(origin);
            if (rootT && pageT === rootT) {
                return { url, state: "gone", reason: "страница отдаёт контент главной (soft-404)" };
            }
        }
    }
    catch {
        /* origin unparseable — fall through to alive */
    }
    return { url, state: "alive" };
}
/** Check a batch with bounded concurrency; unknown is never treated as dead. */
export async function checkJobsAlive(jobs, opts) {
    const out = new Map();
    const list = jobs.slice(0, opts?.limit ?? 25);
    const concurrency = Math.max(1, opts?.concurrency ?? 5);
    let cursor = 0;
    async function worker() {
        for (;;) {
            const i = cursor++;
            if (i >= list.length)
                return;
            const job = list[i];
            out.set(job.id, await checkLink(job.link));
        }
    }
    await Promise.all(Array.from({ length: concurrency }, worker));
    return out;
}
