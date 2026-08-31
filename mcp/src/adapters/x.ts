import { jobId } from "../store.js";
import { withProfilePage } from "../browserFetch.js";
import type { Job } from "../types.js";

interface RawX {
  text: string;
  handle: string;
  author: string;
  link: string;
  time: string;
}

/**
 * Runs INSIDE the page — no external refs. X renders every result as
 * `<article data-testid="tweet">` with the body in `[data-testid="tweetText"]`
 * and the canonical permalink as the anchor that wraps the `<time>` element
 * (`/<handle>/status/<id>`). Those data-testid hooks and the /status/ href shape
 * are far more stable than X's churning hashed class names, so we anchor on them
 * and never on classes. The handle is recovered from the status href, which also
 * gives the deduplication key.
 */
function extractX(): { url: string; items: RawX[] } {
  const seen = new Set<string>();
  const items: RawX[] = [];
  const cards = document.querySelectorAll("article[data-testid='tweet']");
  cards.forEach((card) => {
    const timeA = card.querySelector(
      "a[href*='/status/'] time",
    )?.parentElement as HTMLAnchorElement | null;
    const href = timeA?.getAttribute("href") || "";
    const m = href.match(/^\/([^/]+)\/status\/(\d+)/);
    if (!m) return;
    const handle = m[1];
    const link = `https://x.com/${handle}/status/${m[2]}`;
    if (seen.has(link)) return;
    seen.add(link);
    const text = (
      (card.querySelector("[data-testid='tweetText']") as HTMLElement | null)?.textContent || ""
    )
      .replace(/\s+/g, " ")
      .trim();
    if (!text || text.length < 8) return;
    const nameBlock = (
      (card.querySelector("[data-testid='User-Name']") as HTMLElement | null)?.textContent || ""
    )
      .replace(/\s+/g, " ")
      .trim();
    const author = nameBlock.split("@")[0].trim() || handle;
    const time = timeA?.querySelector("time")?.getAttribute("datetime") || "";
    items.push({
      text: text.slice(0, 400),
      handle,
      author: author.slice(0, 80),
      link,
      time,
    });
  });
  return { url: location.href, items: items.slice(0, 60) };
}

/** Default live-search queries — one hiring lane, one founder lane. Override the
 *  whole set with X_QUERIES (each entry '<label>::<query>', separated by ';'). */
const DEFAULT_QUERIES: Array<{ category: string; query: string }> = [
  {
    category: "hiring",
    query: '(#hiring OR "we\'re hiring" OR "we are hiring") (developer OR engineer OR remote) -is:retweet',
  },
  {
    category: "founder",
    query: '(cofounder OR "co-founder" OR "technical cofounder") (looking OR seeking OR building) -is:retweet',
  },
];

function parseQueries(): Array<{ category: string; query: string }> {
  const raw = (process.env.X_QUERIES || "").trim();
  if (!raw) {
    // X_QUERY is a single-lane shorthand for a one-off search.
    const single = (process.env.X_QUERY || "").trim();
    return single ? [{ category: "custom", query: single }] : DEFAULT_QUERIES;
  }
  const out: Array<{ category: string; query: string }> = [];
  for (const part of raw.split(";")) {
    const seg = part.trim();
    if (!seg) continue;
    const [label, ...rest] = seg.split("::");
    if (rest.length) out.push({ category: label.trim() || "custom", query: rest.join("::").trim() });
    else out.push({ category: "custom", query: seg });
  }
  return out.length ? out : DEFAULT_QUERIES;
}

function searchUrl(query: string): string {
  return `https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=live`;
}

/**
 * X (Twitter) — hiring tweets and founder/co-founder posts as outbound leads.
 * X killed cheap API access and its search is login-walled, so — like Avito — the
 * adapter is double-gated: it runs solely when the caller names `x` AND sets
 * X_ENABLE=1, and it never applies (DM / reply stays manual in the browser). It
 * reads the live-search timeline from the logged-in `x` browser profile (log in
 * once via scripts/board-open.mjs x https://x.com/home + board-save.mjs x),
 * emits kind:"lead", and filters locally by keyword.
 *
 * X_QUERIES overrides the search set ('<label>::<query>' entries, ';'-separated);
 * X_QUERY is a single-lane shorthand; X_URL pins one search page verbatim.
 */
export async function fetchXLeads(opts?: {
  keywords?: string[];
  limit?: number;
}): Promise<{ jobs: Job[]; error?: string }> {
  if (process.env.X_ENABLE !== "1") {
    return {
      jobs: [],
      error:
        "x: ToS forbids automated collection — set X_ENABLE=1 to opt in to browser ingest (optional)",
    };
  }

  const lanes = process.env.X_URL
    ? [{ category: "custom", url: process.env.X_URL }]
    : parseQueries().map((q) => ({ category: q.category, url: searchUrl(q.query) }));

  const words = (opts?.keywords || []).map((w) => w.trim().toLowerCase()).filter(Boolean);
  const limit = Math.min(Math.max(Number(opts?.limit) || 60, 1), 100);
  const now = new Date().toISOString();
  const jobs: Job[] = [];
  const seen = new Set<string>();
  const errors: string[] = [];

  for (const lane of lanes) {
    if (jobs.length >= limit) break;
    const { data, error } = await withProfilePage<{ url: string; items: RawX[] }>(
      "x",
      lane.url,
      extractX,
      { waitMs: 7000, scrolls: 4, headful: true },
    );
    if (error) {
      errors.push(error);
      continue;
    }
    for (const r of data?.items || []) {
      if (seen.has(r.link)) continue;
      const hay = `${r.author} @${r.handle} ${r.text}`.toLowerCase();
      if (words.length && !words.some((w) => hay.includes(w))) continue;
      seen.add(r.link);
      jobs.push({
        id: jobId("x", r.link),
        platform: "x",
        kind: "lead",
        title: `${r.author} (@${r.handle}) — ${lane.category}`,
        description: r.text,
        link: r.link,
        date: r.time || now,
        fetchedAt: now,
        raw: { handle: r.handle, category: lane.category, source: "x_browser" },
      });
      if (jobs.length >= limit) break;
    }
  }

  if (!jobs.length && !errors.length) {
    return {
      jobs: [],
      error:
        "x: no posts rendered — session may be logged out or blocked (re-run board-open.mjs x https://x.com/home)",
    };
  }
  return { jobs, error: errors.length ? `x: ${errors.join("; ")}` : undefined };
}
