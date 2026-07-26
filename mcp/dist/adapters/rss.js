import Parser from "rss-parser";
import { fetchText } from "../http.js";
import { rssPlatforms } from "../platforms.js";
import { jobId } from "../store.js";
const parser = new Parser();
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
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim());
}
function normalizeItem(platform, item) {
    const link = item.link?.trim();
    const title = decodeEntities(item.title?.trim() || "");
    if (!link || !link.startsWith("http") || !title)
        return null;
    const description = stripHtml(item.contentSnippet || item.content || item.summary || "").replace(/Показать полностью/gi, "Подробности дальше");
    const date = item.isoDate || item.pubDate || new Date().toISOString();
    return {
        id: jobId(platform, link),
        platform,
        kind: "gig",
        title,
        description,
        link,
        date: new Date(date).toISOString(),
        fetchedAt: new Date().toISOString(),
        raw: { guid: item.guid, categories: item.categories },
    };
}
const ALT_URLS = {
    weblancer_net: [
        "https://www.weblancer.net/rss/jobs.rss",
        "http://www.weblancer.net/rss/jobs.rss",
    ],
    freelance_ru: [
        "https://freelance.ru/rss/projects.xml",
        "https://www.freelance.ru/rss/projects.xml",
    ],
    fl_ru: ["https://www.fl.ru/rss/all.xml"],
};
export async function fetchRssJobs(platformIds) {
    const platforms = rssPlatforms(platformIds);
    const jobs = [];
    const errors = [];
    await Promise.all(platforms.map(async (p) => {
        const urls = ALT_URLS[p.id] || (p.rss ? [p.rss] : []);
        let lastError = "";
        for (const url of urls) {
            const res = await fetchText(url, {
                headers: {
                    Accept: "application/rss+xml, application/xml, text/xml, */*",
                },
                retries: 2,
            });
            if (!res.ok) {
                lastError = res.error || `HTTP ${res.status}`;
                continue;
            }
            try {
                const feed = await parser.parseString(res.text);
                for (const item of feed.items || []) {
                    const job = normalizeItem(p.id, item);
                    if (job)
                        jobs.push(job);
                }
                lastError = "";
                break;
            }
            catch (e) {
                lastError = e instanceof Error ? e.message : String(e);
            }
        }
        if (lastError)
            errors.push({ platform: p.id, error: lastError });
    }));
    return { jobs, errors };
}
export async function pingRssPlatform(platformId) {
    const p = rssPlatforms([platformId])[0];
    if (!p?.rss) {
        return {
            platform: platformId,
            ok: false,
            status: 0,
            ms: 0,
            viaProxy: false,
            error: "not an RSS platform",
        };
    }
    const url = (ALT_URLS[platformId] || [p.rss])[0];
    const res = await fetchText(url, { retries: 1 });
    if (!res.ok) {
        return {
            platform: platformId,
            ok: false,
            status: res.status,
            ms: res.ms,
            viaProxy: res.viaProxy,
            error: res.error,
        };
    }
    try {
        const feed = await parser.parseString(res.text);
        return {
            platform: platformId,
            ok: true,
            status: res.status,
            ms: res.ms,
            viaProxy: res.viaProxy,
            items: feed.items?.length || 0,
        };
    }
    catch (e) {
        return {
            platform: platformId,
            ok: false,
            status: res.status,
            ms: res.ms,
            viaProxy: res.viaProxy,
            error: e instanceof Error ? e.message : String(e),
        };
    }
}
