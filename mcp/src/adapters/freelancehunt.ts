import { loadEnv } from "../env.js";
import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
import type { Job } from "../types.js";

export function freelancehuntConfigured(): boolean {
  loadEnv();
  return Boolean(process.env.FREELANCEHUNT_TOKEN?.trim());
}

interface FhProject {
  id: number;
  name?: string;
  links?: { self?: { web?: string } };
  attributes?: {
    name?: string;
    description?: string;
    budget?: { amount?: number; currency?: string };
    published_at?: string;
  };
}

export async function fetchFreelancehuntJobs(): Promise<{
  jobs: Job[];
  error?: string;
}> {
  loadEnv();
  const token = process.env.FREELANCEHUNT_TOKEN?.trim();
  if (!token) {
    return { jobs: [], error: "FREELANCEHUNT_TOKEN missing (optional)" };
  }

  const url = "https://api.freelancehunt.com/v2/projects?page[size]=50";
  const { data, error, status } = await fetchJson<{
    data?: FhProject[];
  }>(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    proxy: false,
  });

  if (error || !data?.data) {
    return {
      jobs: [],
      error: error || `Freelancehunt HTTP ${status}`,
    };
  }

  const jobs: Job[] = [];
  for (const p of data.data) {
    const title = p.attributes?.name || p.name || "";
    const link =
      p.links?.self?.web || `https://freelancehunt.com/project/${p.id}.html`;
    if (!title || !link) continue;
    const budget = p.attributes?.budget;
    jobs.push({
      id: jobId("freelancehunt", link),
      platform: "freelancehunt",
      kind: "gig",
      title,
      description: (p.attributes?.description || "").slice(0, 4000),
      link,
      date: p.attributes?.published_at || new Date().toISOString(),
      budget: budget?.amount
        ? `${budget.amount} ${budget.currency || ""}`.trim()
        : undefined,
      fetchedAt: new Date().toISOString(),
      raw: p,
    });
  }
  return { jobs };
}

/** Best-effort bid; API may require extra fields — fallback to browser on failure. */
export async function freelancehuntBid(opts: {
  projectId: number;
  days: number;
  amount: number;
  currency: string;
  comment: string;
}): Promise<{ ok: boolean; error?: string; raw?: unknown }> {
  loadEnv();
  const token = process.env.FREELANCEHUNT_TOKEN?.trim();
  if (!token) return { ok: false, error: "FREELANCEHUNT_TOKEN missing" };

  const url = `https://api.freelancehunt.com/v2/projects/${opts.projectId}/bids`;
  // Use native fetch for POST (proxy usually not needed for API)
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        days: opts.days,
        amount: opts.amount,
        currency: opts.currency,
        comment: opts.comment,
      }),
    });
    const text = await res.text();
    let raw: unknown = text;
    try {
      raw = JSON.parse(text);
    } catch {
      /* keep text */
    }
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 300)}`, raw };
    }
    return { ok: true, raw };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
