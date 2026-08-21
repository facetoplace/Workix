import { fetchText } from "../http.js";
import { jobId } from "../store.js";
import type { Job } from "../types.js";

/**
 * StartupRanking — startups ordered by SR Score (web traffic + social signal).
 * Lead source, not a board: the card is a company to write to, so it emits
 * `kind: "lead"` and runs opt-in only (`platforms: ["startupranking"]`).
 *
 * Cloudflare guards the host: a direct datacenter request answers 403 with
 * `Cf-Mitigated: challenge`, and `api.startupranking.com` no longer resolves.
 * What does work is the SOCKS pool — some exits clear the challenge, so every
 * read retries across proxies until one lands. Verified 2026-08-11: the ranking
 * root returns 200 that way; `/top/country/*` did not clear on any exit tried,
 * which is why the path is configurable rather than hardcoded to a country.
 */

const BASE = "https://www.startupranking.com";
const DEFAULT_PATH = "/";

interface Row {
  slug: string;
  name: string;
  rank?: number;
  score?: string;
  description?: string;
  country?: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#039;/g, "'");
}

function text(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim();
}

export function parseRankingRows(html: string): Row[] {
  const rows: Row[] = [];
  const chunks = html.match(/<tr id="startup_[\s\S]*?<\/tr>/gi) || [];
  for (const chunk of chunks) {
    const linkM = chunk.match(
      /<div class="name">\s*<a href="\/startup\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/i,
    );
    if (!linkM) continue;
    const slug = linkM[1];
    const name = text(linkM[2]);
    if (!slug || !name) continue;

    const rankM = chunk.match(/<td>\s*(\d+)\s*<\/td>/i);
    const scoreM = chunk.match(/class="[^"]*sr-score[^"]*"[^>]*>\s*([\d.,]+)/i);
    const descM = chunk.match(
      /<td class="tleft description">([\s\S]*?)<\/td>/i,
    );
    const countryM = chunk.match(/class="flag [a-z]{2}" title="([^"]+)"/i);

    rows.push({
      slug,
      name,
      rank: rankM ? Number(rankM[1]) : undefined,
      score: scoreM?.[1],
      description: descM ? text(descM[1]) : undefined,
      country: countryM?.[1],
    });
  }
  return rows;
}

/**
 * Cloudflare answers most exits with a challenge, so a single miss says nothing
 * about the site — only an exhausted rotation does. Attempts stay bounded so a
 * blocked run cannot stall a digest.
 */
async function getRanking(
  path: string,
  attempts: number,
): Promise<{ html: string; status: number; tries: number }> {
  let status = 0;
  for (let i = 0; i < attempts; i++) {
    const r = await fetchText(BASE + path, {
      timeoutMs: 12000,
      maxProxies: 8,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    status = r.status;
    if (r.ok && /<tr id="startup_/i.test(r.text)) {
      return { html: r.text, status: r.status, tries: i + 1 };
    }
  }
  return { html: "", status, tries: attempts };
}

export async function fetchStartupRankingLeads(opts?: {
  limit?: number;
  keywords?: string[];
  path?: string;
  attempts?: number;
}): Promise<{ jobs: Job[]; error?: string; tries?: number }> {
  const path = opts?.path || process.env.STARTUPRANKING_PATH?.trim() || DEFAULT_PATH;
  const limitRaw = opts?.limit ?? Number(process.env.STARTUPRANKING_LIMIT);
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50;
  const attempts = Math.min(Math.max(opts?.attempts ?? 3, 1), 6);

  const res = await getRanking(path, attempts);
  if (!res.html) {
    return {
      jobs: [],
      tries: res.tries,
      error: `startupranking: Cloudflare challenge not cleared in ${res.tries} attempts (last HTTP ${res.status}) — needs a better exit in PROXY_1`,
    };
  }

  const words = (opts?.keywords || [])
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);

  const jobs: Job[] = [];
  const now = new Date().toISOString();
  for (const row of parseRankingRows(res.html)) {
    if (words.length) {
      const hay = `${row.name} ${row.description || ""}`.toLowerCase();
      if (!words.some((w) => hay.includes(w))) continue;
    }
    const link = `${BASE}/startup/${row.slug}`;
    jobs.push({
      id: jobId("startupranking", link),
      platform: "startupranking",
      kind: "lead",
      title: [
        row.name,
        row.rank ? `#${row.rank}` : "",
        row.country ? `· ${row.country}` : "",
      ]
        .filter(Boolean)
        .join(" ")
        .slice(0, 200),
      description: [
        row.description || "",
        row.score ? `SR Score: ${row.score}` : "",
        row.country ? `Страна: ${row.country}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      link,
      // The ranking carries no publish date — it is a standing list, not a feed.
      date: now,
      fetchedAt: now,
      raw: {
        source: "ranking_html",
        slug: row.slug,
        rank: row.rank,
        score: row.score,
        country: row.country,
        path,
      },
    });
    if (jobs.length >= limit) break;
  }

  return {
    jobs,
    tries: res.tries,
    error: jobs.length
      ? undefined
      : words.length
        ? "startupranking: no rows matched keywords"
        : "startupranking: ranking table parsed empty (layout drift?)",
  };
}

export async function pingStartupRanking(): Promise<{
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
  const r = await fetchStartupRankingLeads({ limit: 5, attempts: 2 });
  return {
    platform: "startupranking",
    ok: r.jobs.length > 0,
    status: r.jobs.length ? 200 : 403,
    ms: Date.now() - started,
    viaProxy: true,
    items: r.jobs.length,
    error: r.error,
    source: BASE + (process.env.STARTUPRANKING_PATH?.trim() || DEFAULT_PATH),
  };
}
