import { fetchText } from "../http.js";
import { jobId } from "../store.js";
const FEED_URL = "https://aquent.com/feeds/jobs.xml";
function decodeCdata(s) {
    return s
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
        .trim();
}
function tag(block, name) {
    const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i");
    const m = block.match(re);
    return m ? decodeCdata(m[1]) : "";
}
function stripHtml(html) {
    return decodeCdata(html)
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function isRemote(remotetype) {
    const t = remotetype.toLowerCase();
    if (!t)
        return false;
    if (/\bonsite\b/.test(t) && !/remote/.test(t))
        return false;
    return /remote|hybrid/.test(t);
}
export async function fetchAquentJobs(opts) {
    const count = Math.min(Math.max(opts?.count ?? 80, 1), 200);
    const remoteEnv = process.env.AQUENT_REMOTE_ONLY?.trim();
    const remoteOnly = opts?.remoteOnly ??
        (remoteEnv === undefined || remoteEnv === ""
            ? true
            : !["0", "false", "no"].includes(remoteEnv.toLowerCase()));
    const res = await fetchText(FEED_URL, {
        headers: {
            Accept: "application/rss+xml, application/xml, text/xml, */*",
            "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
        },
        proxy: false,
        timeoutMs: 60000,
    });
    if (!res.ok || !res.text) {
        return {
            jobs: [],
            error: res.error || `Aquent feed HTTP ${res.status}`,
        };
    }
    const items = res.text.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
    const jobs = [];
    for (const block of items) {
        const jobIdRaw = tag(block, "job_id");
        const title = tag(block, "title");
        if (!jobIdRaw || !title)
            continue;
        const remotetype = tag(block, "remotetype");
        if (remoteOnly && !isRemote(remotetype))
            continue;
        const city = tag(block, "city");
        const state = tag(block, "state");
        const country = tag(block, "country");
        const company = tag(block, "company") || "Aquent";
        const placement = tag(block, "placement_type");
        const description = stripHtml(tag(block, "description")).slice(0, 4000);
        const pubDate = tag(block, "pubDate") || tag(block, "pubdate");
        const link = `https://aquent.com/find-work/${jobIdRaw}`;
        jobs.push({
            id: jobId("aquent", jobIdRaw),
            platform: "aquent",
            kind: "job",
            title: `${title} @ ${company}`,
            description,
            link,
            date: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
            fetchedAt: new Date().toISOString(),
            raw: {
                job_id: jobIdRaw,
                remotetype,
                placement_type: placement,
                location: [city, state, country].filter(Boolean).join(", "),
                credit: "Aquent job feed — credit Aquent when redistributing",
            },
        });
        if (jobs.length >= count)
            break;
    }
    if (!jobs.length) {
        return {
            jobs: [],
            error: items.length
                ? "Aquent: no items after remote filter"
                : "Aquent: empty feed",
        };
    }
    return { jobs };
}
