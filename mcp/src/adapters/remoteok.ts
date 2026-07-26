import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
import type { Job } from "../types.js";

interface RokItem {
  id?: string | number;
  date?: string | number;
  company?: string;
  position?: string;
  description?: string;
  url?: string;
  apply_url?: string;
  salary_min?: number;
  salary_max?: number;
  tags?: string[];
}

export async function fetchRemoteOkJobs(): Promise<{
  jobs: Job[];
  error?: string;
}> {
  const { data, error, status } = await fetchJson<RokItem[]>(
    "https://remoteok.com/api",
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
      },
      proxy: false,
    },
  );

  if (error || !Array.isArray(data)) {
    return { jobs: [], error: error || `RemoteOK HTTP ${status}` };
  }

  const jobs: Job[] = [];
  for (const row of data) {
    // first element is often metadata
    if (!row.position || !row.id) continue;
    const link =
      row.apply_url ||
      row.url ||
      `https://remoteok.com/remote-jobs/${row.id}`;
    const budget =
      row.salary_min || row.salary_max
        ? `${row.salary_min || "?"}–${row.salary_max || "?"} USD`
        : undefined;
    const date =
      typeof row.date === "number"
        ? new Date(row.date * 1000).toISOString()
        : row.date
          ? new Date(row.date).toISOString()
          : new Date().toISOString();

    jobs.push({
      id: jobId("remoteok", link),
      platform: "remoteok",
      kind: "job",
      title: `${row.position}${row.company ? " @ " + row.company : ""}`,
      description: (row.description || "").replace(/<[^>]+>/g, " ").slice(0, 4000),
      link,
      date,
      budget,
      fetchedAt: new Date().toISOString(),
      raw: { tags: row.tags },
    });
  }
  return { jobs };
}
