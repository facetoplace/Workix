import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
import type { Job } from "../types.js";

interface HimalayasJob {
  title?: string;
  excerpt?: string;
  description?: string;
  companyName?: string;
  companySlug?: string;
  employmentType?: string;
  minSalary?: number | null;
  maxSalary?: number | null;
  salaryPeriod?: string;
  currency?: string;
  categories?: string[];
  pubDate?: number;
  applicationLink?: string;
  guid?: string;
  locationRestrictions?: string[];
}

interface HimalayasResponse {
  jobs?: HimalayasJob[];
  offset?: number;
  limit?: number;
  totalCount?: number;
}

function formatSalary(row: HimalayasJob): string | undefined {
  const cur = row.currency || "USD";
  const period = row.salaryPeriod ? `/${row.salaryPeriod}` : "";
  if (row.minSalary != null && row.maxSalary != null) {
    if (row.minSalary === row.maxSalary) return `${row.minSalary} ${cur}${period}`;
    return `${row.minSalary}–${row.maxSalary} ${cur}${period}`;
  }
  if (row.minSalary != null) return `from ${row.minSalary} ${cur}${period}`;
  if (row.maxSalary != null) return `up to ${row.maxSalary} ${cur}${period}`;
  return undefined;
}

export async function fetchHimalayasJobs(opts?: {
  limit?: number;
  pages?: number;
}): Promise<{ jobs: Job[]; error?: string }> {
  const pageSize = Math.min(Math.max(opts?.limit ?? 40, 1), 100);
  const maxPages = Math.min(Math.max(opts?.pages ?? 2, 1), 5);
  const jobs: Job[] = [];
  let lastError = "";

  for (let page = 0; page < maxPages; page++) {
    const offset = page * pageSize;
    const url = `https://himalayas.app/jobs/api?limit=${pageSize}&offset=${offset}`;
    const { data, error, status } = await fetchJson<HimalayasResponse>(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
      },
      proxy: false,
    });
    if (error || !data?.jobs || !Array.isArray(data.jobs)) {
      lastError = error || `Himalayas HTTP ${status}`;
      break;
    }
    for (const row of data.jobs) {
      const link = row.applicationLink || row.guid;
      if (!row.title || !link) continue;
      const company = row.companyName ? ` @ ${row.companyName}` : "";
      const desc = (row.excerpt || row.description || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 4000);
      jobs.push({
        id: jobId("himalayas", link),
        platform: "himalayas",
        kind: "job",
        title: `${row.title}${company}`,
        description: desc,
        link,
        date: row.pubDate
          ? new Date(row.pubDate * 1000).toISOString()
          : new Date().toISOString(),
        budget: formatSalary(row),
        fetchedAt: new Date().toISOString(),
        raw: {
          employmentType: row.employmentType,
          categories: row.categories,
          locationRestrictions: row.locationRestrictions,
          companySlug: row.companySlug,
        },
      });
    }
    if (data.jobs.length < pageSize) break;
    const total = data.totalCount ?? 0;
    if (total && offset + data.jobs.length >= total) break;
  }

  if (!jobs.length && lastError) return { jobs: [], error: lastError };
  return { jobs, error: lastError || undefined };
}
