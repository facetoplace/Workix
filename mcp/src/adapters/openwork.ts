import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
import type { Job } from "../types.js";

interface OwMission {
  id?: string;
  title?: string;
  description?: string;
  requirements?: string[];
  required_specialties?: string[];
  reward?: number;
  status?: string;
  claimer_id?: string | null;
  created_at?: string;
  tags?: string[];
  type?: string;
}

interface OwResponse {
  missions?: OwMission[];
  total?: number;
}

export async function fetchOpenworkJobs(opts?: {
  openOnly?: boolean;
}): Promise<{ jobs: Job[]; error?: string }> {
  const openOnly =
    opts?.openOnly ??
    process.env.OPENWORK_OPEN_ONLY?.trim() !== "0";

  const url = "https://openwork.bot/api/missions";
  const { data, error, status } = await fetchJson<OwResponse>(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
    },
    proxy: false,
  });

  if (error || !data?.missions || !Array.isArray(data.missions)) {
    return { jobs: [], error: error || `Openwork HTTP ${status}` };
  }

  const jobs: Job[] = [];
  for (const row of data.missions) {
    if (!row.title || !row.id) continue;
    if (openOnly) {
      if (row.status && row.status !== "open") continue;
      if (row.claimer_id) continue;
    }
    const link = `https://openwork.bot/missions/${row.id}`;
    const reward =
      row.reward != null && Number(row.reward) > 0
        ? `${row.reward} $OPENWORK`
        : undefined;
    jobs.push({
      id: jobId("openwork", row.id),
      platform: "openwork",
      kind: "gig",
      title: row.title,
      description: [
        row.description || "",
        row.required_specialties?.length
          ? `specialties: ${row.required_specialties.join(", ")}`
          : "",
        row.requirements?.length
          ? `requirements: ${row.requirements.join("; ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 4000),
      link,
      date: row.created_at
        ? new Date(row.created_at).toISOString()
        : new Date().toISOString(),
      budget: reward,
      fetchedAt: new Date().toISOString(),
      raw: {
        status: row.status,
        type: row.type,
        tags: row.tags,
        reward: row.reward,
      },
    });
  }
  return { jobs };
}
