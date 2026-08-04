import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
import type { Job } from "../types.js";

interface RemotiveJob {
  id?: number | string;
  url?: string;
  title?: string;
  company_name?: string;
  category?: string;
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
}

interface RemotiveResponse {
  jobs?: RemotiveJob[];
  "job-count"?: number;
}

export async function fetchRemotiveJobs(opts?: {
  category?: string;
}): Promise<{ jobs: Job[]; error?: string }> {
  const category =
    opts?.category?.trim() ||
    process.env.REMOTIVE_CATEGORY?.trim() ||
    "software-dev";
  const qs = new URLSearchParams();
  if (category && category !== "all") qs.set("category", category);
  const url = `https://remotive.com/api/remote-jobs${qs.toString() ? `?${qs}` : ""}`;

  const { data, error, status } = await fetchJson<RemotiveResponse>(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
    },
    proxy: false,
  });

  if (error || !data?.jobs || !Array.isArray(data.jobs)) {
    return { jobs: [], error: error || `Remotive HTTP ${status}` };
  }

  const jobs: Job[] = [];
  for (const row of data.jobs) {
    if (!row.title || !row.id) continue;
    const link = row.url || `https://remotive.com/remote-jobs/${row.id}`;
    const date = row.publication_date
      ? new Date(row.publication_date).toISOString()
      : new Date().toISOString();
    jobs.push({
      id: jobId("remotive", link),
      platform: "remotive",
      kind: "job",
      title: `${row.title}${row.company_name ? " @ " + row.company_name : ""}`,
      description: (row.description || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 4000),
      link,
      date,
      budget: row.salary || undefined,
      fetchedAt: new Date().toISOString(),
      raw: {
        category: row.category,
        job_type: row.job_type,
        location: row.candidate_required_location,
      },
    });
  }
  return { jobs };
}
