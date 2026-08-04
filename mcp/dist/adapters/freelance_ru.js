import { fetchText } from "../http.js";
import { jobId } from "../store.js";
const LIST_URLS = [
    "https://freelance.ru/task",
    "https://freelance.ru/projects/",
];
function decodeEntities(s) {
    return s
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#8381;/g, "₽");
}
function stripHtml(html) {
    return decodeEntities(html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim());
}
function parseTaskCards(html) {
    const jobs = [];
    const re = /<article class="task-card[^"]*"[\s\S]*?<\/article>/gi;
    const cards = html.match(re) || [];
    for (const card of cards) {
        const linkM = card.match(/<a[^>]*class="[^"]*task-card__title-link[^"]*"[^>]*href="(\/task\/view\/\d+)"[^>]*>([\s\S]*?)<\/a>/i) || card.match(/<a[^>]*href="(\/task\/view\/\d+)"[^>]*class="[^"]*task-card__title-link[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
        if (!linkM)
            continue;
        const path = linkM[1];
        const title = stripHtml(linkM[2]);
        if (!title)
            continue;
        const descM = card.match(/<p class="task-card__desc">([\s\S]*?)<\/p>/i);
        const budgetM = card.match(/<div class="task-card__budget(?:\s[^"]*)?">([\s\S]*?)<\/div>/i);
        const dateM = card.match(/task-card__foot-item"[^>]*title="([^"]+)"/i);
        const catM = card.match(/task-chip--cat"[^>]*>([\s\S]*?)<\/span>/i);
        const link = `https://freelance.ru${path}`;
        const budget = budgetM ? stripHtml(budgetM[1]) : "";
        const description = [
            descM ? stripHtml(descM[1]) : "",
            budget ? `Гонорар: ${budget}` : "",
            catM ? `Категория: ${stripHtml(catM[1])}` : "",
        ]
            .filter(Boolean)
            .join("\n");
        const date = dateM?.[1]
            ? new Date(dateM[1].replace(/(\d{2})\.(\d{2})\.(\d{4})/, "$3-$2-$1")).toISOString()
            : new Date().toISOString();
        jobs.push({
            id: jobId("freelance_ru", link),
            platform: "freelance_ru",
            kind: "gig",
            title,
            description,
            link,
            date: Number.isNaN(Date.parse(date)) ? new Date().toISOString() : date,
            fetchedAt: new Date().toISOString(),
            budget: budget || undefined,
            raw: { source: "html_task_feed" },
        });
    }
    return jobs;
}
async function fetchViaProxy(url) {
    return fetchText(url, {
        headers: {
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            Referer: "https://freelance.ru/",
        },
        maxProxies: 12,
        directFallback: false,
        timeoutMs: 25000,
    });
}
/** Freelance.ru: RSS often 404; HTML /task works via RU SOCKS5 (PROXY_1). */
export async function fetchFreelanceRuJobs() {
    // Prefer HTML feed (current site). RSS kept as best-effort.
    for (const url of LIST_URLS) {
        const res = await fetchViaProxy(url);
        if (!res.ok)
            continue;
        const jobs = parseTaskCards(res.text);
        if (jobs.length) {
            return {
                jobs,
                viaProxy: res.viaProxy,
                source: url,
            };
        }
    }
    return {
        jobs: [],
        error: "Freelance.ru: HTML /task empty (нужен PROXY_1 с RU SOCKS5; RSS /rss/projects.xml обычно 404)",
    };
}
export async function pingFreelanceRu() {
    for (const url of LIST_URLS) {
        const res = await fetchViaProxy(url);
        if (!res.ok) {
            continue;
        }
        const jobs = parseTaskCards(res.text);
        return {
            platform: "freelance_ru",
            ok: jobs.length > 0,
            status: res.status,
            ms: res.ms,
            viaProxy: res.viaProxy,
            items: jobs.length,
            source: url,
            error: jobs.length ? undefined : "no task-card in HTML",
        };
    }
    const last = await fetchViaProxy(LIST_URLS[0]);
    return {
        platform: "freelance_ru",
        ok: false,
        status: last.status,
        ms: last.ms,
        viaProxy: last.viaProxy,
        error: last.error || "Status code " + last.status,
        source: LIST_URLS[0],
    };
}
