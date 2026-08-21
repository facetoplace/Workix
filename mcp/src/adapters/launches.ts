import Parser from "rss-parser";
import { fetchJson, fetchText } from "../http.js";
import { jobId } from "../store.js";
import type { Job } from "../types.js";

/**
 * Product Hunt alternatives — the same lead: something shipped days ago, by
 * someone reachable, usually still short-handed.
 *
 * Two sources survived the 2026-08-11 probe of the launch-board landscape:
 *
 * - **Show HN** via the HN Algolia API. Keyless, 568k historical items, and the
 *   author handle is right there. Same API the `hn_hiring` adapter already uses.
 * - **r/SideProject** Atom. Keyless, high volume, noisier.
 *
 * What did not survive: BetaList (`/rss` → 404 and the redirect target 404s too),
 * Uneed (`/feed` → 404), Fazier (no feed, no API), DevHunt and Startup Fame
 * (`/rss` answers HTML, not a feed), MicroLaunch (no public API), TinyLaunch
 * (feed behind a login), Peerlist (`/feed` → 404). Product Hunt itself keeps its
 * own adapter — it has a real API plus a public Atom feed.
 *
 * Cards are `kind: "lead"`, opt-in only: `platforms: ["launches"]`.
 */

const parser = new Parser();

const HN_SHOW =
  "https://hn.algolia.com/api/v1/search_by_date?tags=show_hn&hitsPerPage=";
const REDDIT_SIDEPROJECT =
  "https://www.reddit.com/r/SideProject/new/.rss?limit=50";

interface HnHit {
  objectID?: string;
  title?: string;
  url?: string;
  author?: string;
  points?: number;
  num_comments?: number;
  created_at?: string;
  story_text?: string;
}

function stripShowPrefix(title: string): string {
  return title.replace(/^show\s+hn:\s*/i, "").trim();
}

async function fetchShowHn(
  limit: number,
): Promise<{ jobs: Job[]; error?: string }> {
  const { data, error, status } = await fetchJson<{ hits?: HnHit[] }>(
    `${HN_SHOW}${limit}`,
    { headers: { Accept: "application/json" }, proxy: false },
  );
  if (error || !data?.hits) {
    return { jobs: [], error: `show_hn: ${error || `HTTP ${status}`}` };
  }

  const jobs: Job[] = [];
  for (const hit of data.hits) {
    const title = stripShowPrefix(hit.title || "");
    if (!title) continue;
    // Prefer the maker's own site; fall back to the HN thread when a Show HN
    // post carries only text.
    const external = hit.url?.trim();
    const thread = hit.objectID
      ? `https://news.ycombinator.com/item?id=${hit.objectID}`
      : undefined;
    const link = external || thread;
    if (!link) continue;

    jobs.push({
      id: jobId("launches", link),
      platform: "launches",
      kind: "lead",
      title: title.slice(0, 200),
      description: [
        (hit.story_text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1200),
        hit.author ? `Автор: @${hit.author} (HN)` : "",
        thread && external ? `Обсуждение: ${thread}` : "",
        `Источник: Show HN · ${hit.points ?? 0} pts, ${hit.num_comments ?? 0} комм.`,
      ]
        .filter(Boolean)
        .join("\n\n"),
      link,
      date: new Date(hit.created_at || new Date().toISOString()).toISOString(),
      fetchedAt: new Date().toISOString(),
      raw: {
        source: "show_hn",
        author: hit.author,
        points: hit.points,
        comments: hit.num_comments,
        thread,
      },
    });
  }
  return { jobs };
}

async function fetchSideProject(
  limit: number,
): Promise<{ jobs: Job[]; error?: string }> {
  const res = await fetchText(REDDIT_SIDEPROJECT, {
    headers: { Accept: "application/atom+xml, application/xml, text/xml, */*" },
    maxProxies: 4,
  });
  if (!res.ok) {
    // Reddit rate-limits hard from datacenter ranges; a 429 is not a dead source.
    return {
      jobs: [],
      error: `r_sideproject: ${res.error || `HTTP ${res.status}`}`,
    };
  }

  let items: Parser.Item[] = [];
  try {
    items = (await parser.parseString(res.text)).items || [];
  } catch (e) {
    return {
      jobs: [],
      error: `r_sideproject: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const jobs: Job[] = [];
  for (const item of items.slice(0, limit)) {
    const link = item.link?.trim();
    const title = (item.title || "").trim();
    if (!link || !title) continue;
    const body = (item.contentSnippet || item.content || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    jobs.push({
      id: jobId("launches", link),
      platform: "launches",
      kind: "lead",
      title: title.slice(0, 200),
      description: [body.slice(0, 1200), "Источник: r/SideProject"]
        .filter(Boolean)
        .join("\n\n"),
      link,
      date: new Date(
        item.isoDate || item.pubDate || new Date().toISOString(),
      ).toISOString(),
      fetchedAt: new Date().toISOString(),
      raw: { source: "r_sideproject", author: item.creator },
    });
  }
  return { jobs };
}

function envLimit(): number {
  const raw = Number(process.env.LAUNCHES_LIMIT);
  if (!Number.isFinite(raw) || raw <= 0) return 30;
  return Math.min(Math.floor(raw), 100);
}

/** Show HN + r/SideProject launches as lead cards. */
export async function fetchLaunchLeads(opts?: {
  limit?: number;
  keywords?: string[];
}): Promise<{ jobs: Job[]; error?: string }> {
  const limit = opts?.limit ?? envLimit();
  const perSource = Math.max(Math.ceil(limit / 2), 5);

  const [hn, reddit] = await Promise.all([
    fetchShowHn(perSource),
    fetchSideProject(perSource),
  ]);

  const errors = [hn.error, reddit.error].filter(Boolean) as string[];
  const byLink = new Map<string, Job>();
  for (const j of [...hn.jobs, ...reddit.jobs]) byLink.set(j.link, j);

  let jobs = [...byLink.values()].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const words = (opts?.keywords || [])
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  if (words.length) {
    jobs = jobs.filter((j) => {
      const hay = `${j.title} ${j.description}`.toLowerCase();
      return words.some((w) => hay.includes(w));
    });
  }

  jobs = jobs.slice(0, limit);

  return {
    jobs,
    error: jobs.length
      ? errors.length
        ? `launches: partial — ${errors.join("; ")}`
        : undefined
      : `launches: nothing${errors.length ? ` — ${errors.join("; ")}` : ""}`,
  };
}

export async function pingLaunches(): Promise<{
  platform: string;
  ok: boolean;
  status: number;
  ms: number;
  viaProxy: boolean;
  items?: number;
  error?: string;
  source?: string;
}> {
  const started = Date.now();
  const r = await fetchLaunchLeads({ limit: 6 });
  return {
    platform: "launches",
    ok: r.jobs.length > 0,
    status: r.jobs.length ? 200 : 0,
    ms: Date.now() - started,
    viaProxy: false,
    items: r.jobs.length,
    error: r.error,
    source: "Show HN + r/SideProject",
  };
}
