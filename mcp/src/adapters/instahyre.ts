import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
import type { Job } from "../types.js";

/**
 * Instahyre (IN) — curated Indian tech hiring. Public JSON on
 * `GET /api/v1/job_search/` (verified 2026-08-11: 200, 35 rows per page,
 * `meta.total_count` ≈ 16k, no key).
 *
 * The row already carries an absolute `public_url`, so nothing is assembled.
 * There is no server-side text filter on this endpoint, hence local keyword
 * matching — same shape as the getmatch adapter.
 */

const BASE = "https://www.instahyre.com";
const SEARCH = `${BASE}/api/v1/job_search/`;

interface InstahyreEmployer {
  company_name?: string;
  company_tagline?: string;
  employee_count?: number;
}

interface InstahyreJob {
  id?: string | number;
  title?: string;
  candidate_title?: string;
  public_url?: string;
  locations?: string;
  keywords?: string | string[];
  employer?: InstahyreEmployer;
}

interface InstahyreResponse {
  objects?: InstahyreJob[];
  meta?: { total_count?: number };
}

function keywordList(k?: string | string[]): string[] {
  if (Array.isArray(k)) return k.filter(Boolean);
  if (!k) return [];
  // The API sends a Python-ish list literal in a string: "['Java', 'Spring']".
  return k
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((s) => s.replace(/^\s*['"]|['"]\s*$/g, "").trim())
    .filter(Boolean);
}

export async function fetchInstahyreJobs(opts?: {
  keywords?: string[];
  limit?: number;
}): Promise<{ jobs: Job[]; error?: string; totalCount?: number }> {
  const limitRaw = opts?.limit ?? Number(process.env.INSTAHYRE_LIMIT);
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50;

  const { data, error, status } = await fetchJson<InstahyreResponse>(
    `${SEARCH}?limit=${limit}`,
    {
      headers: { Accept: "application/json", "Accept-Language": "en-US,en;q=0.9" },
      proxy: false,
    },
  );
  if (error || !data?.objects) {
    return { jobs: [], error: error || `Instahyre HTTP ${status}` };
  }

  const words = (opts?.keywords || [])
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);

  const jobs: Job[] = [];
  for (const row of data.objects) {
    const link = row.public_url?.trim();
    const title = row.title || row.candidate_title;
    if (!link || !title) continue;

    const company = row.employer?.company_name;
    const skills = keywordList(row.keywords);
    const description = [
      row.employer?.company_tagline || "",
      row.locations ? `Локация: ${row.locations}` : "",
      skills.length ? `Стек: ${skills.slice(0, 12).join(", ")}` : "",
      row.employer?.employee_count
        ? `Размер компании: ~${row.employer.employee_count}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    if (words.length) {
      const hay = `${title} ${description}`.toLowerCase();
      if (!words.some((w) => hay.includes(w))) continue;
    }

    jobs.push({
      id: jobId("instahyre", link),
      platform: "instahyre",
      kind: "job",
      title: `${title}${company ? ` @ ${company}` : ""}`.slice(0, 200),
      description,
      link,
      // Rows carry no publish date — the board is a standing list of open roles.
      date: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      raw: {
        company,
        locations: row.locations,
        skills,
        region: "in",
      },
    });
  }

  return {
    jobs,
    totalCount: data.meta?.total_count,
    error: jobs.length
      ? undefined
      : words.length
        ? "instahyre: no rows matched keywords"
        : "instahyre: empty response",
  };
}

export async function pingInstahyre(): Promise<{
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
  const r = await fetchInstahyreJobs({ limit: 5 });
  return {
    platform: "instahyre",
    ok: r.jobs.length > 0,
    status: r.jobs.length ? 200 : 0,
    ms: Date.now() - started,
    viaProxy: false,
    items: r.jobs.length,
    error: r.error,
    source: SEARCH,
  };
}
