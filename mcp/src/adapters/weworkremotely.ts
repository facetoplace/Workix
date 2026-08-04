import Parser from "rss-parser";
import { fetchText } from "../http.js";
import { jobId } from "../store.js";
import type { Job } from "../types.js";

const parser = new Parser({
  customFields: {
    item: ["region", "category"],
  },
});

/** Category RSS slug → path under weworkremotely.com/categories/ */
const CATEGORY_FEEDS: Record<string, string> = {
  programming: "remote-programming-jobs",
  "full-stack": "remote-full-stack-programming-jobs",
  "back-end": "remote-back-end-programming-jobs",
  "front-end": "remote-front-end-programming-jobs",
  devops: "remote-devops-sysadmin-jobs",
  design: "remote-design-jobs",
  product: "remote-product-jobs",
  all: "remote-jobs",
};

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchWeWorkRemotelyJobs(opts?: {
  category?: string;
}): Promise<{ jobs: Job[]; error?: string }> {
  const catKey = (
    opts?.category?.trim() ||
    process.env.WWR_CATEGORY?.trim() ||
    "programming"
  ).toLowerCase();
  const slug = CATEGORY_FEEDS[catKey] || CATEGORY_FEEDS.programming;
  const url =
    catKey === "all" || slug === "remote-jobs"
      ? "https://weworkremotely.com/remote-jobs.rss"
      : `https://weworkremotely.com/categories/${slug}.rss`;

  const res = await fetchText(url, {
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml, */*",
      "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
    },
    proxy: false,
    timeoutMs: 25000,
  });

  if (!res.ok) {
    return {
      jobs: [],
      error: res.error || `We Work Remotely HTTP ${res.status}`,
    };
  }

  let feed: Parser.Output<{ region?: string; category?: string }>;
  try {
    feed = await parser.parseString(res.text);
  } catch (e) {
    return {
      jobs: [],
      error: e instanceof Error ? e.message : "WWR RSS parse error",
    };
  }

  const jobs: Job[] = [];
  for (const item of feed.items || []) {
    const link = item.link?.trim();
    const title = item.title?.trim();
    if (!link || !title) continue;
    const date = item.isoDate || item.pubDate || new Date().toISOString();
    const region = (item as { region?: string }).region;
    const category = (item as { category?: string }).category;
    jobs.push({
      id: jobId("weworkremotely", link),
      platform: "weworkremotely",
      kind: "job",
      title,
      description: stripHtml(
        item.contentSnippet || item.content || item.summary || "",
      ).slice(0, 4000),
      link,
      date: new Date(date).toISOString(),
      fetchedAt: new Date().toISOString(),
      raw: { region, category, guid: item.guid },
    });
  }
  return { jobs };
}
