import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
import type { Job } from "../types.js";

interface StListing {
  id?: string;
  title?: string;
  slug?: string;
  type?: string;
  status?: string;
  token?: string;
  rewardAmount?: number | null;
  minRewardAsk?: number | null;
  maxRewardAsk?: number | null;
  compensationType?: string;
  deadline?: string;
  agentAccess?: string;
  isWinnersAnnounced?: boolean;
  sponsor?: { name?: string | null; slug?: string | null };
}

function apiKey(): string {
  return (
    process.env.SUPERTEAM_EARN_API_KEY?.trim() ||
    process.env.SUPERTEAM_EARN_AGENT_KEY?.trim() ||
    ""
  );
}

function baseUrl(): string {
  return (
    process.env.SUPERTEAM_EARN_BASE?.trim().replace(/\/$/, "") ||
    "https://superteam.fun"
  );
}

export function superteamEarnConfigured(): boolean {
  return Boolean(apiKey());
}

function formatReward(row: StListing): string | undefined {
  const token = row.token || "USDC";
  if (row.rewardAmount != null) return `${row.rewardAmount} ${token}`;
  if (row.minRewardAsk != null || row.maxRewardAsk != null) {
    const a = row.minRewardAsk ?? "?";
    const b = row.maxRewardAsk ?? "?";
    return `${a}–${b} ${token}`;
  }
  return undefined;
}

export async function fetchSuperteamEarnJobs(opts?: {
  take?: number;
  type?: string;
}): Promise<{ jobs: Job[]; error?: string }> {
  const key = apiKey();
  if (!key) {
    return {
      jobs: [],
      error:
        "optional: missing SUPERTEAM_EARN_API_KEY (POST /api/agents → apiKey)",
    };
  }

  const take = Math.min(Math.max(opts?.take ?? 40, 1), 100);
  const qs = new URLSearchParams({ take: String(take) });
  const type =
    opts?.type?.trim() || process.env.SUPERTEAM_EARN_TYPE?.trim() || "";
  if (type) qs.set("type", type);
  const url = `${baseUrl()}/api/agents/listings/live?${qs}`;

  const { data, error, status } = await fetchJson<StListing[] | { error?: string }>(
    url,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${key}`,
        "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
      },
      proxy: false,
    },
  );

  if (error || !Array.isArray(data)) {
    const msg =
      error ||
      (data && typeof data === "object" && "error" in data
        ? String((data as { error?: string }).error)
        : `Superteam Earn HTTP ${status}`);
    return { jobs: [], error: msg };
  }

  const jobs: Job[] = [];
  for (const row of data) {
    if (!row.title || !row.id) continue;
    const slug = row.slug || row.id;
    const link = `https://earn.superteam.fun/listings/${slug}`;
    const sponsor = row.sponsor?.name ? ` @ ${row.sponsor.name}` : "";
    jobs.push({
      id: jobId("superteam_earn", row.id),
      platform: "superteam_earn",
      kind: "gig",
      title: `${row.title}${sponsor}`,
      description: [
        row.type,
        row.agentAccess,
        row.compensationType,
        row.deadline ? `deadline ${row.deadline}` : "",
        row.isWinnersAnnounced ? "winners announced" : "",
      ]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 4000),
      link,
      date: row.deadline
        ? new Date(row.deadline).toISOString()
        : new Date().toISOString(),
      budget: formatReward(row),
      fetchedAt: new Date().toISOString(),
      raw: {
        type: row.type,
        status: row.status,
        agentAccess: row.agentAccess,
        slug: row.slug,
        isWinnersAnnounced: row.isWinnersAnnounced,
      },
    });
  }
  return { jobs };
}
