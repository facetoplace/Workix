import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
import type { Job } from "../types.js";

/**
 * «Работа России» (trudvsem.ru) open data — the state job registry.
 * Public JSON, no key, ~514k live vacancies as of 2026-08-09.
 *
 * The catalogue is nationwide and mostly non-IT, so we never pull it bare:
 * a text filter is always applied (opts → TRUDVSEM_TEXT → "разработчик").
 */

interface TrudvsemVacancy {
  id?: string;
  source?: string;
  region?: { region_code?: string; name?: string };
  company?: { name?: string; url?: string; inn?: string };
  "creation-date"?: string;
  date_modify?: string;
  salary?: string;
  salary_min?: number;
  salary_max?: number;
  currency?: string;
  "job-name"?: string;
  vac_url?: string;
  employment?: string;
  schedule?: string;
  /** String on employer-sourced rows, {education, experience} on portal rows. */
  requirement?: { education?: string; experience?: number };
  requirements?: string;
  duty?: string;
  category?: { specialisation?: string };
}

interface TrudvsemResponse {
  status?: string;
  meta?: { total?: number; limit?: number };
  results?: { vacancies?: Array<{ vacancy?: TrudvsemVacancy }> };
}

const BASE = "https://opendata.trudvsem.ru/api/v1/vacancies";

function textOf(v: TrudvsemVacancy): string {
  const parts: string[] = [];
  if (v.duty) parts.push(v.duty);
  if (typeof v.requirements === "string") parts.push(v.requirements);
  if (v.requirement?.education) {
    const exp = v.requirement.experience;
    parts.push(
      `Требования: ${v.requirement.education}${exp ? `, опыт ${exp} г.` : ""}`,
    );
  }
  if (v.schedule) parts.push(`График: ${v.schedule}`);
  return parts.join("\n").replace(/\s+/g, " ").trim().slice(0, 4000);
}

function budgetOf(v: TrudvsemVacancy): string | undefined {
  const cur = v.currency || "RUB";
  if (v.salary_min && v.salary_max && v.salary_min !== v.salary_max) {
    return `${v.salary_min}–${v.salary_max} ${cur}`;
  }
  if (v.salary_min) return `от ${v.salary_min} ${cur}`;
  return v.salary || undefined;
}

async function searchOnce(
  text: string,
  region: string | undefined,
  limit: number,
): Promise<{ jobs: Job[]; error?: string; totalCount?: number }> {
  const qs = new URLSearchParams({ offset: "0", limit: String(limit), text });
  const url = region
    ? `${BASE}/region/${encodeURIComponent(region)}?${qs}`
    : `${BASE}?${qs}`;

  const { data, error, status } = await fetchJson<TrudvsemResponse>(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
    },
    proxy: false,
  });

  if (error || !data?.results) {
    return { jobs: [], error: error || `Trudvsem HTTP ${status}` };
  }

  // A filter that matches nothing returns results:{} — an empty page, not a fault.
  const rows = data.results.vacancies || [];
  const jobs: Job[] = [];
  for (const row of rows) {
    const v = row.vacancy;
    const link = v?.vac_url;
    if (!v || !link || !v["job-name"]) continue;
    const company = v.company?.name ? ` @ ${v.company.name}` : "";
    const date = v.date_modify || v["creation-date"];
    jobs.push({
      id: jobId("trudvsem", link),
      platform: "trudvsem",
      kind: "job",
      title: `${v["job-name"]}${company}`,
      description: textOf(v),
      link,
      date: date ? new Date(date).toISOString() : new Date().toISOString(),
      budget: budgetOf(v),
      fetchedAt: new Date().toISOString(),
      raw: {
        region: v.region?.name,
        region_code: v.region?.region_code,
        employment: v.employment,
        schedule: v.schedule,
        source: v.source,
        specialisation: v.category?.specialisation,
      },
    });
  }

  return { jobs, totalCount: data.meta?.total };
}

export async function fetchTrudvsemJobs(opts?: {
  text?: string;
  keywords?: string[];
  region?: string;
  limit?: number;
}): Promise<{ jobs: Job[]; error?: string; totalCount?: number }> {
  const region = opts?.region?.trim() || process.env.TRUDVSEM_REGION?.trim();
  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 100);

  // `text` is matched as one phrase, so a joined keyword list ("flutter mobile
  // react") matches nothing. Each keyword is its own query instead, capped
  // because every query is a separate round trip against a slow origin.
  const maxQueries = Math.max(
    Number(process.env.TRUDVSEM_MAX_QUERIES || 3) || 3,
    1,
  );
  const terms = (
    opts?.text?.trim()
      ? [opts.text.trim()]
      : (opts?.keywords || []).map((k) => k.trim()).filter(Boolean)
  ).slice(0, maxQueries);
  if (!terms.length) {
    terms.push(process.env.TRUDVSEM_TEXT?.trim() || "разработчик");
  }

  const results = await Promise.all(
    terms.map((t) => searchOnce(t, region, limit)),
  );

  const seen = new Set<string>();
  const jobs: Job[] = [];
  for (const r of results) {
    for (const j of r.jobs) {
      if (seen.has(j.id)) continue;
      seen.add(j.id);
      jobs.push(j);
    }
  }

  const firstError = results.find((r) => r.error)?.error;
  if (!jobs.length && firstError) return { jobs: [], error: firstError };
  return { jobs, totalCount: results[0]?.totalCount };
}
