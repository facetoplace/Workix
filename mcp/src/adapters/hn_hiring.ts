import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
import type { Job } from "../types.js";

/**
 * Hacker News "Ask HN: Who is hiring?" — the monthly thread, read through the
 * public Algolia index (no key, no scraping of news.ycombinator.com).
 *
 * Shape of the source: the `whoishiring` bot posts two threads on the first of
 * every month — "Who is hiring?" (companies) and "Who wants to be hired?"
 * (candidates). We want the first. Each *top-level* comment is one job post;
 * replies underneath are discussion ("is this role real?"), so the parent check
 * is what separates postings from noise — without it roughly a third of the
 * cards are conversation.
 *
 * HN's own rule for the thread is that posters must be hiring directly, which
 * makes this one of the few feeds with no recruiter spam and a live apply
 * contact in the body.
 */

const ALGOLIA = "https://hn.algolia.com/api/v1";
const ITEM_URL = "https://news.ycombinator.com/item?id=";

interface AlgoliaStory {
  objectID?: string;
  title?: string;
  created_at?: string;
}

interface AlgoliaComment {
  objectID?: string;
  author?: string;
  created_at?: string;
  parent_id?: number;
  story_id?: number;
  comment_text?: string;
}

function plain(html?: string): string {
  return (html || "")
    .replace(/<p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/g, "/")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Posts follow the thread's convention "Company | Role | Location | REMOTE",
 * so the first line is the whole card summary. Fall back to a prefix of the
 * body when someone ignores the format.
 */
function titleOf(body: string): string {
  const first = body.split("\n").map((l) => l.trim()).find(Boolean) || "";
  const line = first.length >= 12 ? first : body.replace(/\s+/g, " ");
  return line.slice(0, 200).trim();
}

async function latestThread(): Promise<{
  id?: string;
  title?: string;
  error?: string;
}> {
  const { data, error, status } = await fetchJson<{ hits?: AlgoliaStory[] }>(
    `${ALGOLIA}/search_by_date?tags=story,author_whoishiring&hitsPerPage=20`,
    { headers: { Accept: "application/json" }, proxy: false },
  );
  if (error || !data?.hits) {
    return { error: error || `hn algolia HTTP ${status}` };
  }
  // Both monthly threads are posted in the same second, so "newest" alone can
  // land on "Who wants to be hired?" — match the title, do not trust order.
  const hit = data.hits.find((h) => /who is hiring/i.test(h.title || ""));
  if (!hit?.objectID) {
    return { error: "hn: no 'Who is hiring' thread in the latest 20 posts" };
  }
  return { id: hit.objectID, title: hit.title || "Ask HN: Who is hiring?" };
}

export async function fetchHnHiringJobs(opts?: {
  keywords?: string[];
  /** Postings to keep after filtering. */
  limit?: number;
  /** Read this thread instead of the current month, e.g. "48747976". */
  storyId?: string;
}): Promise<{ jobs: Job[]; error?: string; totalCount?: number }> {
  const limit = Math.min(Math.max(opts?.limit ?? 60, 1), 500);

  const pinned = opts?.storyId || process.env.HN_HIRING_STORY?.trim();
  let storyId: string;
  let threadTitle = "Ask HN: Who is hiring?";
  if (pinned) {
    storyId = pinned;
  } else {
    const found = await latestThread();
    if (!found.id) {
      return { jobs: [], error: found.error || "hn: no thread found" };
    }
    storyId = found.id;
    threadTitle = found.title || threadTitle;
  }

  const needles = (opts?.keywords || [])
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);

  const jobs: Job[] = [];
  let total = 0;
  // Threads run 300–500 comments; Algolia caps a page at 1000 but slows down
  // well before that, so walk pages of 100 and stop once we have enough.
  for (let page = 0; page < 6 && jobs.length < limit; page++) {
    const { data, error, status } = await fetchJson<{
      hits?: AlgoliaComment[];
      nbHits?: number;
      nbPages?: number;
    }>(
      `${ALGOLIA}/search?tags=comment,story_${storyId}&hitsPerPage=100&page=${page}`,
      { headers: { Accept: "application/json" }, proxy: false },
    );
    if (error || !data?.hits) {
      // A first-page failure is the whole source; later pages just cap depth.
      if (page === 0) return { jobs: [], error: error || `hn algolia HTTP ${status}` };
      break;
    }
    total = data.nbHits ?? total;

    for (const c of data.hits) {
      if (jobs.length >= limit) break;
      if (!c.objectID || !c.comment_text) continue;
      // Top-level only: a reply's parent is another comment, not the thread.
      if (String(c.parent_id) !== String(storyId)) continue;

      const body = plain(c.comment_text);
      if (body.length < 40) continue;
      if (needles.length) {
        const hay = body.toLowerCase();
        if (!needles.some((n) => hay.includes(n))) continue;
      }

      jobs.push({
        id: jobId("hn_hiring", c.objectID),
        platform: "hn_hiring",
        kind: "job",
        title: titleOf(body),
        description: body.slice(0, 4000),
        link: `${ITEM_URL}${c.objectID}`,
        date: c.created_at || new Date().toISOString(),
        fetchedAt: new Date().toISOString(),
        raw: {
          author: c.author,
          thread: threadTitle,
          threadUrl: `${ITEM_URL}${storyId}`,
        },
      });
    }
    if (data.nbPages != null && page + 1 >= data.nbPages) break;
  }

  return { jobs, totalCount: total };
}
