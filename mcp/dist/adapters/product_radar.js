import { fetchText } from "../http.js";
import { jobId } from "../store.js";
const BASE = "https://productradar.ru/category/hiring/";
function decodeEntities(s) {
    return s
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
}
function stripHtml(html) {
    return decodeEntities(html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<img[^>]*>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim());
}
function parseCards(html) {
    const jobs = [];
    const cards = html.match(/<article class="products__item[\s\S]*?<\/article>/gi) || [];
    for (const card of cards) {
        const linkM = card.match(/class="card__title"[^>]*>[\s\S]*?href="(https?:\/\/productradar\.ru\/product\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/i) ||
            card.match(/href="(https?:\/\/productradar\.ru\/product\/[^"#?]+)"[^>]*>\s*([^<]{2,120})\s*<\/a>/i);
        if (!linkM)
            continue;
        let link = linkM[1].replace(/\/?$/, "/");
        const name = stripHtml(linkM[2]);
        if (!name || /#comments/i.test(link))
            continue;
        const descM = card.match(/class="card__description"[^>]*>([\s\S]*?)<\/p>/i);
        const hireM = card.match(/class="card__status-text"[^>]*>([\s\S]*?)<\/p>/i);
        const desc = descM ? stripHtml(descM[1]) : "";
        const hiring = hireM ? stripHtml(hireM[1]) : "";
        if (!hiring && !desc)
            continue;
        const title = hiring
            ? `${name}: ${hiring}`.slice(0, 200)
            : name;
        const description = [desc, hiring ? `Вакансия/запрос: ${hiring}` : ""]
            .filter(Boolean)
            .join("\n\n");
        jobs.push({
            id: jobId("product_radar", link),
            platform: "product_radar",
            kind: "job",
            title,
            description,
            link,
            date: new Date().toISOString(),
            fetchedAt: new Date().toISOString(),
            raw: {
                source: "html_hiring",
                product: name,
                hiring: hiring || undefined,
            },
        });
    }
    return jobs;
}
async function fetchPage(page) {
    const url = page <= 1 ? BASE : `${BASE}?page=${page}`;
    // Radar is OK from datacenter IP; PROXY_1 SOCKS often hangs on this host.
    return fetchText(url, {
        proxy: false,
        timeoutMs: 20000,
        headers: {
            Accept: "text/html,application/xhtml+xml",
            "Accept-Language": "ru-RU,ru;q=0.9",
            Referer: "https://productradar.ru/",
        },
    });
}
/** Product Radar «Набираю людей в команду» — HTML pages with pagination. */
export async function fetchProductRadarJobs(opts) {
    const maxPages = Math.min(Math.max(opts?.maxPages ?? 3, 1), 10);
    const byLink = new Map();
    let lastError = "";
    let pagesOk = 0;
    let viaProxy = false;
    for (let page = 1; page <= maxPages; page++) {
        const res = await fetchPage(page);
        viaProxy = res.viaProxy;
        if (!res.ok) {
            lastError = res.error || `HTTP ${res.status}`;
            break;
        }
        const batch = parseCards(res.text);
        if (!batch.length) {
            if (page === 1)
                lastError = "no product cards in HTML";
            break;
        }
        pagesOk += 1;
        for (const j of batch)
            byLink.set(j.link, j);
    }
    const jobs = [...byLink.values()];
    if (!jobs.length) {
        return {
            jobs: [],
            error: lastError ||
                "Product Radar hiring empty (check https://productradar.ru/category/hiring/)",
            viaProxy,
            pages: pagesOk,
        };
    }
    return { jobs, viaProxy, pages: pagesOk };
}
export async function pingProductRadar() {
    const res = await fetchPage(1);
    if (!res.ok) {
        return {
            platform: "product_radar",
            ok: false,
            status: res.status,
            ms: res.ms,
            viaProxy: res.viaProxy,
            error: res.error,
            source: BASE,
        };
    }
    const jobs = parseCards(res.text);
    return {
        platform: "product_radar",
        ok: jobs.length > 0,
        status: res.status,
        ms: res.ms,
        viaProxy: res.viaProxy,
        items: jobs.length,
        source: BASE,
        error: jobs.length ? undefined : "no product cards",
    };
}
