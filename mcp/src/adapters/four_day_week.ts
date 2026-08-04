import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
import type { Job } from "../types.js";

interface FdwJob {
  id?: string;
  title?: string;
  slug?: string;
  company_name?: string;
  work_arrangement?: string;
  locations?: Array<{ city?: string; country?: string }>;
  posted?: number;
  schedule_type?: string;
  category?: string;
  level?: string;
  is_expired?: boolean;
  stack?: Array<{ name?: string }>;
}

interface FdwResponse {
  jobs?: FdwJob[];
  total?: number;
  page?: number;
  has_more?: boolean;
}

export async function fetchFourDayWeekJobs(opts?: {
  pages?: number;
  remoteOnly?: boolean;
}): Promise<{ jobs: Job[]; error?: string }> {
  const maxPages = Math.min(Math.max(opts?.pages ?? 2, 1), 5);
  const remoteOnly =
    opts?.remoteOnly ??
    (process.env.FOUR_DAY_WEEK_REMOTE_ONLY === "1" ||
      process.env.FOUR_DAY_WEEK_REMOTE_ONLY === "true");

  const jobs: Job[] = [];
  let lastError = "";

  for (let page = 1; page <= maxPages; page++) {
    const url = `https://4dayweek.io/api/jobs?page=${page}`;
    const { data, error, status } = await fetchJson<FdwResponse>(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
      },
      proxy: false,
    });
    if (error || !data?.jobs || !Array.isArray(data.jobs)) {
      lastError = error || `4 Day Week HTTP ${status}`;
      break;
    }
    for (const row of data.jobs) {
      if (!row.title || !row.slug || row.is_expired) continue;
      if (
        remoteOnly &&
        row.work_arrangement &&
        !/remote/i.test(row.work_arrangement)
      ) {
        continue;
      }
      const link = `https://4dayweek.io/jobs/${row.slug}`;
      const company = row.company_name ? ` @ ${row.company_name}` : "";
      const loc = (row.locations || [])
        .map((l) => [l.city, l.country].filter(Boolean).join(", "))
        .filter(Boolean)
        .join("; ");
      jobs.push({
        id: jobId("four_day_week", row.id || row.slug),
        platform: "four_day_week",
        kind: "job",
        title: `${row.title}${company}`,
        description: [
          row.schedule_type,
          row.work_arrangement,
          row.category,
          row.level,
          loc,
          row.stack?.map((s) => s.name).filter(Boolean).join(", "),
        ]
          .filter(Boolean)
          .join(" · ")
          .slice(0, 4000),
        link,
        date: row.posted
          ? new Date(row.posted * 1000).toISOString()
          : new Date().toISOString(),
        fetchedAt: new Date().toISOString(),
        raw: {
          schedule_type: row.schedule_type,
          work_arrangement: row.work_arrangement,
          category: row.category,
          level: row.level,
        },
      });
    }
    if (!data.has_more) break;
  }

  if (!jobs.length && lastError) return { jobs: [], error: lastError };
  return { jobs, error: lastError || undefined };
}
