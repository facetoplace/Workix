import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
import type { Job } from "../types.js";

/**
 * Habr Career — the JSON the site's own frontend calls.
 *
 * We already read `/vacancies/rss?remote=true`, but RSS gives a title and a
 * link and nothing else. This endpoint carries salary, grade, skills, company
 * rating and the remote flag, which is what the digest actually ranks on.
 * RSS stays as the fallback in `rss.ts` when this shape changes.
 */

interface HabrVacancy {
  id?: number;
  href?: string;
  title?: string;
  remoteWork?: boolean;
  archived?: boolean;
  employment?: string;
  salaryQualification?: { title?: string };
  publishedDate?: { date?: string; title?: string };
  company?: { title?: string; accredited?: boolean; rating?: { value?: string } };
  salary?: {
    from?: number | null;
    to?: number | null;
    currency?: string | null;
    formatted?: string;
  };
  divisions?: Array<{ title?: string }>;
  skills?: Array<{ title?: string }>;
  locations?: Array<{ title?: string }>;
}

interface HabrResponse {
  list?: HabrVacancy[];
  meta?: { totalResults?: number; perPage?: number; currentPage?: number };
}

export async function fetchHabrCareerJobs(opts?: {
  pages?: number;
  remoteOnly?: boolean;
  keywords?: string[];
}): Promise<{ jobs: Job[]; error?: string; totalCount?: number }> {
  const maxPages = Math.min(Math.max(opts?.pages ?? 2, 1), 5);
  const remoteOnly =
    opts?.remoteOnly ?? process.env.HABR_CAREER_REMOTE_ONLY !== "0";

  const kw = (opts?.keywords || [])
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);

  const jobs: Job[] = [];
  let lastError = "";
  let total: number | undefined;

  for (let page = 1; page <= maxPages; page++) {
    const qs = new URLSearchParams({
      sort: "date",
      type: "all",
      page: String(page),
    });
    if (remoteOnly) qs.set("remote", "true");
    const url = `https://career.habr.com/api/frontend/vacancies?${qs}`;

    const { data, error, status } = await fetchJson<HabrResponse>(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
        Referer: "https://career.habr.com/vacancies",
      },
      proxy: false,
    });

    if (error || !data?.list) {
      lastError = error || `Habr Career HTTP ${status}`;
      break;
    }
    total = data.meta?.totalResults ?? total;

    for (const v of data.list) {
      if (!v.title || !v.href || v.archived) continue;
      const company = v.company?.title ? ` @ ${v.company.title}` : "";
      const title = `${v.title}${company}`;
      if (kw.length && !kw.some((k) => title.toLowerCase().includes(k))) {
        continue;
      }
      const link = `https://career.habr.com${v.href}`;
      jobs.push({
        id: jobId("habr_career", link),
        platform: "habr_career",
        kind: "job",
        title,
        description: [
          v.salaryQualification?.title
            ? `Грейд: ${v.salaryQualification.title}`
            : "",
          v.skills?.length
            ? `Навыки: ${v.skills.map((s) => s.title).filter(Boolean).join(", ")}`
            : "",
          v.divisions?.length
            ? `Направление: ${v.divisions.map((d) => d.title).filter(Boolean).join(", ")}`
            : "",
          v.locations?.length
            ? `Локация: ${v.locations.map((l) => l.title).filter(Boolean).join(", ")}`
            : "",
          v.remoteWork ? "Можно удалённо" : "",
        ]
          .filter(Boolean)
          .join("\n"),
        link,
        date: v.publishedDate?.date
          ? new Date(v.publishedDate.date).toISOString()
          : new Date().toISOString(),
        budget: v.salary?.formatted?.trim() || undefined,
        fetchedAt: new Date().toISOString(),
        raw: {
          remote: v.remoteWork,
          employment: v.employment,
          qualification: v.salaryQualification?.title,
          company_accredited: v.company?.accredited,
          company_rating: v.company?.rating?.value,
          skills: v.skills?.map((s) => s.title),
        },
      });
    }

    if (!data.list.length) break;
  }

  if (!jobs.length && lastError) return { jobs: [], error: lastError };
  return { jobs, error: lastError || undefined, totalCount: total };
}
