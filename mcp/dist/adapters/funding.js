import Parser from "rss-parser";
import { fetchText } from "../http.js";
import { jobId } from "../store.js";
/**
 * Funding news → lead cards.
 *
 * "Just raised" is the strongest outbound signal there is: the money is new, the
 * team is about to grow, and contract work is usually the first thing bought.
 * These are general tech-news feeds, so most items are NOT rounds — every title
 * runs through FUNDING_RE and anything that is not a funding story is dropped.
 * Cards carry `kind: "lead"` and the source is opt-in (`platforms: ["funding"]`),
 * so news never reaches the vacancy digest. See docs/14-work-sources-matrix.md §C3.
 */
const parser = new Parser();
/**
 * Verified 2026-08-11: all five return live RSS and carry round announcements.
 * vc.ru and rb.ru are deliberately absent — their feeds are general business
 * news ("каждый десятый россиянин…"), so the funding filter drops ~everything.
 * Add them back through FUNDING_FEEDS if you want to pay for that yield.
 */
const DEFAULT_FEEDS = [
    { id: "crunchbase_news", url: "https://news.crunchbase.com/feed/", region: "global" },
    {
        id: "techcrunch_venture",
        url: "https://techcrunch.com/category/venture/feed/",
        region: "global",
    },
    { id: "tech_eu", url: "https://tech.eu/feed/", region: "eu" },
    { id: "eu_startups", url: "https://www.eu-startups.com/feed/", region: "eu" },
    { id: "sifted", url: "https://sifted.eu/feed", region: "eu" },
];
const KNOWN = new Map(DEFAULT_FEEDS.map((f) => [f.id, f]));
/** A headline is a lead only if it announces money moving into a company. */
const FUNDING_RE = /\b(raise[sd]?|raising|secure[sd]?|land[sd]?|nab[sd]?|clos(?:es|ed)\s+(?:a\s+)?(?:\$|€|£|round)|bag[sd]?|fundrais\w*|funding\s+round|series\s+[a-h]\b|seed\s+round|pre-seed|valuation)\b|привлек\w*|подня\w+\s+раунд/i;
const AMOUNT_RE = /([$€£]\s?\d[\d.,]*\s*(?:m|bn|k|million|billion)?|\d[\d.,]*\s*(?:млн|млрд)\s*(?:\$|₽|руб\w*|евро)?)/i;
const STAGE_RE = /\b(pre-seed|seed|series\s+[a-h]|angel|bridge|grant|ipo)\b/i;
/** Everything before the funding verb is, in practice, the company name. */
const COMPANY_RE = /^(.{2,80}?)\s+(?:raise[sd]?|raising|secure[sd]?|land[sd]?|nab[sd]?|clos(?:es|ed)|bag[sd]?|hits?|snaps?)\b/i;
function feedsFromEnv() {
    const raw = process.env.FUNDING_FEEDS?.trim();
    if (!raw)
        return DEFAULT_FEEDS;
    const out = [];
    for (const part of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
        const known = KNOWN.get(part);
        if (known) {
            out.push(known);
            continue;
        }
        if (/^https?:\/\//i.test(part)) {
            out.push({
                id: new URL(part).hostname.replace(/^www\./, "").replace(/\W+/g, "_"),
                url: part,
                region: "custom",
            });
        }
    }
    return out.length ? out : DEFAULT_FEEDS;
}
function envLimit() {
    const raw = Number(process.env.FUNDING_LIMIT);
    if (!Number.isFinite(raw) || raw <= 0)
        return 40;
    return Math.min(Math.floor(raw), 200);
}
function clean(s) {
    return s
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#8217;|&#8216;/g, "'")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
export function looksLikeFunding(title) {
    return FUNDING_RE.test(title);
}
/**
 * Headlines wrap the name in scene-setting: "Oslo-based Visoid", "London's
 * Safehire.ai", "UK air defence company Cambridge Aerospace". Peel those off
 * until the name is left, otherwise the same company reads as three different
 * leads across three feeds.
 */
const LEAD_INS = [
    // "Exclusive: …", "Breaking: …"
    /^[\p{L} ]{2,20}:\s+/u,
    /^[\p{Lu}][\w.'’-]*(?:[\s-][\p{Lu}][\w.'’-]*)?\s*-\s*based\s+/u,
    /^[\w.'’-]+[’']s\s+/u,
    /^.*?\b(?:company|startup|start-up|firm|scale-?up|maker|provider|group|business|giant|unicorn)\s+/iu,
];
/** What is left is a phrase, not a name — a round-up or a sector sentence. */
const NOT_A_COMPANY = /\b(startups?|spinouts?|funding|rounds?|investors?|looking|deals?|week|month|europe|european)\b/i;
/**
 * A VC closing its own fund is not an outbound lead — nobody there is buying
 * contract work off the back of it. Drop those before they become cards.
 */
const FUND_NEWS = /\bfund\s+(?:[ivx]+|\d+)\b|\b(?:closes|raises)\b.*\bfund\b/i;
function stripLeadIn(name) {
    let out = name.trim();
    for (let i = 0; i < 3; i++) {
        const before = out;
        for (const re of LEAD_INS)
            out = out.replace(re, "").trim();
        if (out === before)
            break;
    }
    return out;
}
export function parseHeadline(title) {
    const raw = COMPANY_RE.exec(title)?.[1]?.trim();
    const company = raw ? stripLeadIn(raw) : undefined;
    return {
        // Round-up posts ("The Week's 10 Biggest Funding Rounds") have no single
        // company — leaving it undefined is better than inventing one. Same for a
        // leftover that is really a sentence fragment.
        company: company &&
            company.length >= 2 &&
            company.split(/\s+/).length <= 5 &&
            !/^(the|this|these|why|how|meet|its|his|her|their)\b/i.test(company) &&
            !NOT_A_COMPANY.test(company)
            ? company
            : undefined,
        amount: AMOUNT_RE.exec(title)?.[1]?.trim(),
        stage: STAGE_RE.exec(title)?.[1]?.trim(),
    };
}
/** Same round covered by three outlets is one lead — keep the earliest report. */
function dedupeByCompany(jobs) {
    const seen = new Map();
    const out = [];
    for (const j of jobs) {
        const company = j.raw.company;
        if (!company) {
            out.push(j);
            continue;
        }
        const key = company.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
        const prev = seen.get(key);
        if (!prev) {
            seen.set(key, j);
            out.push(j);
            continue;
        }
        const alsoIn = prev.raw.alsoReportedBy || [];
        prev.raw.alsoReportedBy = [
            ...alsoIn,
            j.raw.feed || "?",
        ];
    }
    return out;
}
function toJob(feed, item) {
    const link = item.link?.trim();
    const title = clean(item.title || "");
    if (!link || !link.startsWith("http") || !title)
        return null;
    if (!looksLikeFunding(title) || FUND_NEWS.test(title))
        return null;
    const { company, amount, stage } = parseHeadline(title);
    const summary = clean(item.contentSnippet || item.content || item.summary || "");
    const description = [
        summary.slice(0, 1200),
        company ? `Компания: ${company}` : "",
        [amount ? `Сумма: ${amount}` : "", stage ? `Стадия: ${stage}` : ""]
            .filter(Boolean)
            .join(" · "),
        `Источник: ${feed.id}`,
    ]
        .filter(Boolean)
        .join("\n\n");
    return {
        id: jobId("funding", link),
        platform: "funding",
        kind: "lead",
        title: title.slice(0, 200),
        description,
        link,
        date: new Date(item.isoDate || item.pubDate || new Date().toISOString()).toISOString(),
        fetchedAt: new Date().toISOString(),
        raw: { feed: feed.id, region: feed.region, company, amount, stage },
    };
}
/** Funding announcements from the news feeds, as lead cards. */
export async function fetchFundingLeads(opts) {
    const feeds = feedsFromEnv();
    const limit = opts?.limit ?? envLimit();
    const byLink = new Map();
    const errors = [];
    await Promise.all(feeds.map(async (feed) => {
        const res = await fetchText(feed.url, {
            headers: {
                Accept: "application/rss+xml, application/xml, text/xml, */*",
            },
            maxProxies: 4,
        });
        if (!res.ok) {
            errors.push(`${feed.id}: ${res.error || `HTTP ${res.status}`}`);
            return;
        }
        try {
            const parsed = await parser.parseString(res.text);
            for (const item of parsed.items || []) {
                const job = toJob(feed, item);
                if (job)
                    byLink.set(job.link, job);
            }
        }
        catch (e) {
            errors.push(`${feed.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
    }));
    let jobs = dedupeByCompany([...byLink.values()].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    if (opts?.keywords?.length) {
        const words = opts.keywords
            .map((k) => k.trim().toLowerCase())
            .filter(Boolean);
        if (words.length) {
            jobs = jobs.filter((j) => {
                const hay = `${j.title} ${j.description}`.toLowerCase();
                return words.some((w) => hay.includes(w));
            });
        }
    }
    jobs = jobs.slice(0, limit);
    return {
        jobs,
        feeds: feeds.length,
        error: jobs.length
            ? errors.length
                ? `funding: partial — ${errors.join("; ")}`
                : undefined
            : `funding: no rounds matched${errors.length ? ` — ${errors.join("; ")}` : ""}`,
    };
}
export async function pingFunding() {
    const started = Date.now();
    const r = await fetchFundingLeads({ limit: 5 });
    return {
        platform: "funding",
        ok: r.jobs.length > 0,
        status: r.jobs.length ? 200 : 0,
        ms: Date.now() - started,
        viaProxy: false,
        items: r.jobs.length,
        error: r.error,
        source: `${r.feeds ?? 0} feeds`,
    };
}
