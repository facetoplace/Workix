import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
import type { Job } from "../types.js";

interface JobicyJob {
  id?: number | string;
  url?: string;
  jobSlug?: string;
  jobTitle?: string;
  companyName?: string;
  jobIndustry?: string[];
  jobType?: string[];
  jobGeo?: string;
  jobLevel?: string;
  jobExcerpt?: string;
  jobDescription?: string;
  pubDate?: string;
  jobPubDate?: string;
}

interface JobicyResponse {
  jobs?: JobicyJob[];
  jobCount?: number;
}

export async function fetchJobicyJobs(opts?: {
  count?: number;
  tag?: string;
  geo?: string;
}): Promise<{ jobs: Job[]; error?: string }> {
  const count = Math.min(Math.max(opts?.count ?? 50, 1), 100);
  const tag =
    opts?.tag?.trim() ||
    process.env.JOBICY_TAG?.trim() ||
    "dev";
  const geo = opts?.geo?.trim() || process.env.JOBICY_GEO?.trim() || "";

  const qs = new URLSearchParams({ count: String(count) });
  if (tag && tag !== "all") qs.set("tag", tag);
  if (geo) qs.set("geo", geo);

  const url = `https://jobicy.com/api/v2/remote-jobs?${qs}`;
  const { data, error, status } = await fetchJson<JobicyResponse>(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
    },
    proxy: false,
  });

  if (error || !data?.jobs || !Array.isArray(data.jobs)) {
    return { jobs: [], error: error || `Jobicy HTTP ${status}` };
  }

  const jobs: Job[] = [];
  for (const row of data.jobs) {
    if (!row.jobTitle || !row.url) continue;
    const company = row.companyName ? ` @ ${row.companyName}` : "";
    const dateRaw = row.pubDate || row.jobPubDate;
    jobs.push({
      id: jobId("jobicy", String(row.id || row.url)),
      platform: "jobicy",
      kind: "job",
      title: `${row.jobTitle}${company}`,
      description: (row.jobExcerpt || row.jobDescription || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 4000),
      link: row.url,
      date: dateRaw
        ? new Date(dateRaw).toISOString()
        : new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      raw: {
        jobType: row.jobType,
        jobGeo: row.jobGeo,
        jobLevel: row.jobLevel,
        jobIndustry: row.jobIndustry,
        tag,
      },
    });
  }
  return { jobs };
}
