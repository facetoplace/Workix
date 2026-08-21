import Parser from "rss-parser";
import { fetchText } from "../http.js";
import { jobId } from "../store.js";
/**
 * Product Hunt — startup leads, not vacancies.
 *
 * A product in its first weeks is the lead: the maker is reachable, the site is
 * new, and contract work is usually still open. Cards are emitted with
 * `kind: "lead"` and the source runs only when the caller names `producthunt`
 * outright, so a plain `include_jobs` digest never mixes launches into
 * vacancies (see docs/14-work-sources-matrix.md §C3).
 *
 * Two ways in, and the cheap one needs nothing:
 *
 * 1. `PRODUCTHUNT_TOKEN` → GraphQL v2. Richer (website, topics, makers) but the
 *    endpoint bills by *complexity* — 6250 points per 15 minutes, cost derived
 *    from the fields requested — hence the short field list and the cap on
 *    `first`.
 * 2. No token → the public Atom feed. Verified 2026-08-11: 50 entries, name,
 *    tagline and permalink, no auth at all. Less data per card, but the source
 *    works out of the box instead of sitting dark waiting for a key.
 */
const ENDPOINT = "https://api.producthunt.com/v2/api/graphql";
const FEED = "https://www.producthunt.com/feed";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const QUERY = `query WorkixLaunches($first: Int!) {
  posts(order: NEWEST, first: $first) {
    edges {
      node {
        id
        name
        tagline
        description
        url
        website
        votesCount
        createdAt
        topics(first: 3) { edges { node { name } } }
        makers { name username }
      }
    }
  }
}`;
export function productHuntConfigured() {
    return Boolean(process.env.PRODUCTHUNT_TOKEN?.trim());
}
function envLimit() {
    const raw = Number(process.env.PRODUCTHUNT_LIMIT);
    if (!Number.isFinite(raw) || raw <= 0)
        return DEFAULT_LIMIT;
    return Math.min(Math.floor(raw), MAX_LIMIT);
}
function matches(post, keywords) {
    if (!keywords?.length)
        return true;
    const hay = [
        post.name,
        post.tagline,
        post.description,
        ...(post.topics?.edges || []).map((e) => e.node?.name),
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    return keywords.some((k) => k.trim() && hay.includes(k.trim().toLowerCase()));
}
function toJob(post) {
    if (!post.name || !post.url)
        return undefined;
    const topics = (post.topics?.edges || [])
        .map((e) => e.node?.name)
        .filter((n) => Boolean(n));
    const makers = (post.makers || [])
        .map((m) => (m.username ? `${m.name || m.username} (@${m.username})` : m.name))
        .filter((n) => Boolean(n));
    const description = [
        post.description?.trim() || post.tagline?.trim() || "",
        post.website ? `Сайт: ${post.website}` : "",
        topics.length ? `Темы: ${topics.join(", ")}` : "",
        makers.length ? `Мейкеры: ${makers.join(", ")}` : "",
    ]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 4000);
    return {
        id: jobId("producthunt", post.id || post.url),
        platform: "producthunt",
        kind: "lead",
        title: post.tagline
            ? `${post.name}: ${post.tagline}`.slice(0, 200)
            : post.name,
        description,
        link: post.url,
        date: post.createdAt
            ? new Date(post.createdAt).toISOString()
            : new Date().toISOString(),
        fetchedAt: new Date().toISOString(),
        raw: {
            source: "graphql_v2",
            website: post.website,
            topics,
            makers,
            votes: post.votesCount,
        },
    };
}
async function query(first) {
    const token = process.env.PRODUCTHUNT_TOKEN?.trim();
    if (!token) {
        return {
            posts: [],
            status: 0,
            error: "producthunt: PRODUCTHUNT_TOKEN missing (optional)",
        };
    }
    try {
        const res = await fetch(ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${token}`,
                "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
            },
            body: JSON.stringify({ query: QUERY, variables: { first } }),
            signal: AbortSignal.timeout(20000),
        });
        if (res.status === 429) {
            // Complexity budget spent. The reset header says when it refills, which is
            // the only actionable part of a 429 here — surface it instead of retrying.
            const reset = res.headers.get("x-rate-limit-reset");
            return {
                posts: [],
                status: 429,
                error: `producthunt: rate limit (complexity), resets in ${reset || "?"}s`,
            };
        }
        if (!res.ok) {
            return {
                posts: [],
                status: res.status,
                error: `producthunt: HTTP ${res.status}${res.status === 401 ? " — token rejected" : ""}`,
            };
        }
        const body = (await res.json());
        // GraphQL reports field drift as 200 + errors[]; pass the message through so
        // a renamed field is diagnosable without re-reading the schema.
        if (body.errors?.length) {
            return {
                posts: [],
                status: res.status,
                error: `producthunt: ${body.errors
                    .map((e) => e.message)
                    .filter(Boolean)
                    .join("; ")}`,
            };
        }
        const posts = (body.data?.posts?.edges || [])
            .map((e) => e.node)
            .filter((n) => Boolean(n));
        return { posts, status: res.status };
    }
    catch (e) {
        return {
            posts: [],
            status: 0,
            error: `producthunt: ${e instanceof Error ? e.message : String(e)}`,
        };
    }
}
const parser = new Parser();
/** PH double-escapes the entry body, so the markup arrives as `&lt;p&gt;`. */
function decodeXml(s) {
    return s
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .replace(/&amp;/g, "&");
}
function plain(html) {
    return html
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
/**
 * Keyless path. The Atom entry carries the product name as the title and the
 * tagline as the first paragraph of the content — enough for a lead card.
 */
async function fetchFeed(limit, keywords) {
    const res = await fetchText(FEED, {
        headers: { Accept: "application/atom+xml, application/xml, text/xml, */*" },
        maxProxies: 4,
    });
    if (!res.ok) {
        return {
            jobs: [],
            error: `producthunt: feed ${res.error || `HTTP ${res.status}`}`,
        };
    }
    let items = [];
    try {
        items = (await parser.parseString(res.text)).items || [];
    }
    catch (e) {
        return {
            jobs: [],
            error: `producthunt: feed parse — ${e instanceof Error ? e.message : String(e)}`,
        };
    }
    const words = (keywords || []).map((k) => k.trim().toLowerCase()).filter(Boolean);
    const jobs = [];
    for (const item of items) {
        const link = item.link?.trim();
        const name = (item.title || "").trim();
        if (!link || !name)
            continue;
        // The entry body is `<p>tagline</p><p><a>Discussion</a> | <a>Link</a></p>`,
        // and contentSnippet flattens both into one line — so the tagline comes from
        // the first paragraph, not from splitting the flattened text.
        const rawContent = decodeXml(item.content || item.summary || "");
        const firstP = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(rawContent)?.[1] || "";
        const tagline = plain(firstP).slice(0, 160);
        const body = plain(rawContent.replace(/<p[^>]*>\s*<a[\s\S]*?<\/p>/gi, " "));
        if (words.length) {
            const hay = `${name} ${body}`.toLowerCase();
            if (!words.some((w) => hay.includes(w)))
                continue;
        }
        jobs.push({
            id: jobId("producthunt", link),
            platform: "producthunt",
            kind: "lead",
            title: tagline ? `${name}: ${tagline}`.slice(0, 200) : name,
            description: body.slice(0, 2000),
            link,
            date: new Date(item.isoDate || item.pubDate || new Date().toISOString()).toISOString(),
            fetchedAt: new Date().toISOString(),
            raw: { source: "atom_feed" },
        });
        if (jobs.length >= limit)
            break;
    }
    return {
        jobs,
        error: jobs.length
            ? undefined
            : items.length
                ? "producthunt: no launches matched keywords"
                : "producthunt: feed empty",
    };
}
/** Newest Product Hunt launches as lead cards. */
export async function fetchProductHuntLeads(opts) {
    const first = Math.min(Math.max(opts?.limit ?? envLimit(), 1), MAX_LIMIT);
    // No key is not a failure here — the public feed covers the same launches.
    if (!productHuntConfigured())
        return fetchFeed(first, opts?.keywords);
    const r = await query(first);
    if (r.error) {
        // A rejected or throttled token should not take the source down when a
        // keyless path exists; fall back and say what happened.
        const fb = await fetchFeed(first, opts?.keywords);
        if (fb.jobs.length) {
            return { jobs: fb.jobs, error: `${r.error}; fell back to the public feed` };
        }
        return { jobs: [], error: r.error };
    }
    const jobs = [];
    for (const post of r.posts) {
        if (!matches(post, opts?.keywords))
            continue;
        const job = toJob(post);
        if (job)
            jobs.push(job);
    }
    return {
        jobs,
        error: jobs.length
            ? undefined
            : r.posts.length
                ? "producthunt: no launches matched keywords"
                : "producthunt: empty response",
    };
}
export async function pingProductHunt() {
    const started = Date.now();
    if (!productHuntConfigured()) {
        const fb = await fetchFeed(5);
        return {
            platform: "producthunt",
            ok: fb.jobs.length > 0,
            status: fb.jobs.length ? 200 : 0,
            ms: Date.now() - started,
            viaProxy: false,
            items: fb.jobs.length,
            error: fb.error || "no PRODUCTHUNT_TOKEN — using the public Atom feed",
            source: FEED,
        };
    }
    const r = await query(1);
    return {
        platform: "producthunt",
        ok: !r.error && r.posts.length > 0,
        status: r.status,
        ms: Date.now() - started,
        viaProxy: false,
        items: r.posts.length,
        error: r.error,
        source: ENDPOINT,
    };
}
