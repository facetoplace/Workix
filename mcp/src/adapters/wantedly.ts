import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
import type { Job } from "../types.js";

/**
 * Wantedly (JP) — the main startup hiring platform in Japan. Public JSON on
 * `GET /api/v1/projects` (verified 2026-08-11: 200, 10 projects per page, no key).
 *
 * Wantedly posts are "projects", not classic vacancies: the card sells the team
 * and the problem, and `looking_for` carries the role. Most of it is Japanese —
 * that is the point of having it, but keyword filtering runs against the raw
 * text, so Latin-script keywords only match the roles written in English.
 */

const BASE = "https://www.wantedly.com";

interface WantedlyCompany {
  name?: string;
  url?: string;
  founded_on?: string;
  payroll_number?: number;
  address_prefix?: string;
}

interface WantedlyProject {
  id?: number;
  title?: string;
  description?: string;
  looking_for?: string;
  location?: string;
  location_suffix?: string;
  published_at?: string | number;
  company?: WantedlyCompany;
  tags?: Array<{ name?: string } | string>;
}

interface WantedlyResponse {
  data?: WantedlyProject[];
  _metadata?: { total_count?: number };
}

function tagNames(tags?: WantedlyProject["tags"]): string[] {
  return (tags || [])
    .map((t) => (typeof t === "string" ? t : t?.name))
    .filter((t): t is string => Boolean(t));
}

function toDate(published?: string | number): string {
  if (typeof published === "number") {
    // Wantedly sends unix seconds on some payload versions.
    return new Date(published * 1000).toISOString();
  }
  const d = published ? new Date(published) : new Date();
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export async function fetchWantedlyJobs(opts?: {
  keywords?: string[];
  pages?: number;
}): Promise<{ jobs: Job[]; error?: string; totalCount?: number }> {
  const pages = Math.min(Math.max(opts?.pages ?? 2, 1), 5);
  const words = (opts?.keywords || [])
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);

  const jobs: Job[] = [];
  let total: number | undefined;
  let lastError = "";

  for (let page = 1; page <= pages; page++) {
    const { data, error, status } = await fetchJson<WantedlyResponse>(
      `${BASE}/api/v1/projects?page=${page}`,
      {
        headers: {
          Accept: "application/json",
          "Accept-Language": "ja,en;q=0.8",
        },
        proxy: false,
      },
    );
    if (error || !data?.data) {
      lastError = error || `Wantedly HTTP ${status}`;
      break;
    }
    total = data._metadata?.total_count ?? total;
    if (!data.data.length) break;

    for (const p of data.data) {
      if (!p.id || !p.title) continue;
      const link = `${BASE}/projects/${p.id}`;
      const company = p.company?.name;
      const tags = tagNames(p.tags);
      const body = [
        p.looking_for ? `Ищут: ${p.looking_for}` : "",
        (p.description || "").replace(/\s+/g, " ").trim().slice(0, 2500),
        [p.location, p.location_suffix].filter(Boolean).join(" "),
        p.company?.url ? `Сайт: ${p.company.url}` : "",
        tags.length ? `Теги: ${tags.slice(0, 8).join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      if (words.length) {
        const hay = `${p.title} ${body}`.toLowerCase();
        if (!words.some((w) => hay.includes(w))) continue;
      }

      jobs.push({
        id: jobId("wantedly", link),
        platform: "wantedly",
        kind: "job",
        title: `${p.title}${company ? ` @ ${company}` : ""}`.slice(0, 200),
        description: body,
        link,
        date: toDate(p.published_at),
        fetchedAt: new Date().toISOString(),
        raw: {
          company,
          companyUrl: p.company?.url,
          location: [p.location, p.location_suffix].filter(Boolean).join(" "),
          lookingFor: p.looking_for,
          tags,
          region: "jp",
        },
      });
    }
  }

  return {
    jobs,
    totalCount: total,
    error: jobs.length ? undefined : lastError || "wantedly: no projects",
  };
}

export async function pingWantedly(): Promise<{
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
  const r = await fetchWantedlyJobs({ pages: 1 });
  return {
    platform: "wantedly",
    ok: r.jobs.length > 0,
    status: r.jobs.length ? 200 : 0,
    ms: Date.now() - started,
    viaProxy: false,
    items: r.jobs.length,
    error: r.error,
    source: `${BASE}/api/v1/projects`,
  };
}
