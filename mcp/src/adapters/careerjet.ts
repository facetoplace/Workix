import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
import type { Job } from "../types.js";

/**
 * Careerjet — aggregator across ~90 country sites, including ru/ua/kz.
 * Free affiliate id from https://www.careerjet.com/partners/ → `CAREERJET_AFFID`.
 *
 * Probed 2026-08-09: without a Referer header the API answers
 * `{"error":"Undeclared referrer"}` even with a valid affid, so the header is
 * sent unconditionally.
 */

interface CareerjetJob {
  title?: string;
  description?: string;
  company?: string;
  site?: string;
  url?: string;
  date?: string;
  locations?: string;
  salary?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency_code?: string;
}

interface CareerjetResponse {
  type?: string;
  hits?: number;
  pages?: number;
  jobs?: CareerjetJob[];
  error?: string;
}

export function careerjetConfigured(): boolean {
  return Boolean(process.env.CAREERJET_AFFID?.trim());
}

export async function fetchCareerjetJobs(opts?: {
  keywords?: string;
  location?: string;
  locale?: string;
  pageSize?: number;
}): Promise<{ jobs: Job[]; error?: string; totalCount?: number }> {
  const affid = process.env.CAREERJET_AFFID?.trim();
  if (!affid) {
    return { jobs: [], error: "careerjet: CAREERJET_AFFID missing (optional)" };
  }

  const keywords =
    opts?.keywords?.trim() ||
    process.env.CAREERJET_KEYWORDS?.trim() ||
    "developer";
  const location =
    opts?.location?.trim() || process.env.CAREERJET_LOCATION?.trim() || "";
  const locale =
    opts?.locale?.trim() || process.env.CAREERJET_LOCALE?.trim() || "en_GB";
  const pageSize = Math.min(Math.max(opts?.pageSize ?? 50, 1), 99);
  const referer =
    process.env.CAREERJET_REFERER?.trim() || "https://workix.co/";

  const qs = new URLSearchParams({
    locale_code: locale,
    keywords,
    affid,
    pagesize: String(pageSize),
    sort: "date",
    user_ip: process.env.CAREERJET_USER_IP?.trim() || "1.1.1.1",
    user_agent: "WorkixMCP/0.1",
  });
  if (location) qs.set("location", location);

  const { data, error, status } = await fetchJson<CareerjetResponse>(
    `https://public.api.careerjet.net/search?${qs}`,
    {
      headers: {
        Accept: "application/json",
        Referer: referer,
        "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
      },
      proxy: false,
    },
  );

  if (error || !data) {
    return { jobs: [], error: error || `Careerjet HTTP ${status}` };
  }
  if (data.error) return { jobs: [], error: `careerjet: ${data.error}` };

  const jobs: Job[] = [];
  for (const j of data.jobs || []) {
    if (!j.title || !j.url) continue;
    jobs.push({
      id: jobId("careerjet", j.url),
      platform: "careerjet",
      kind: "job",
      title: `${j.title}${j.company ? ` @ ${j.company}` : ""}`,
      description: (j.description || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 4000),
      link: j.url,
      date: j.date ? new Date(j.date).toISOString() : new Date().toISOString(),
      budget: j.salary || undefined,
      fetchedAt: new Date().toISOString(),
      raw: { locations: j.locations, site: j.site, locale },
    });
  }

  return { jobs, totalCount: data.hits };
}
