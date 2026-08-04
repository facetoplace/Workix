/**
 * Map local MCP store jobs → hub POST /api/v1/orders/share.
 * Tracks what was already pushed in local store (job.hubShare + hubShares[]).
 */
import {
  getJob,
  isHubShared,
  logOutreach,
  markHubShared,
  listHubShares,
  listUnsharedJobs,
} from "../store.js";
import type { Job } from "../types.js";
import { hubShareOrders } from "./hub.js";

const HUB_BASE = (process.env.WORKIX_API || process.env.WORKIX_HUB_API || "https://workix.co").replace(
  /\/$/,
  "",
);

function jobToShareItem(job: Job) {
  return {
    title: job.title,
    description: job.description || "",
    platform: String(job.platform),
    url: job.link,
    externalId: job.id,
    kind: job.kind,
    originalPublishedAt: job.date,
    date: job.date,
    budget: job.budget,
  };
}

function hubPublicUrl(sid: string, path?: string): string {
  // created rows use path `/order/{sid}`; skipped rows put external URL in `url` — always prefer sid.
  if (path?.startsWith("/order/")) return `${HUB_BASE}${path}`;
  return `${HUB_BASE}/order/${sid}`;
}

function recordShareResult(
  jobs: Job[],
  rows: Array<{
    status?: string;
    index?: number;
    id?: string;
    sid?: string;
    url?: string;
    externalUrl?: string;
  }>,
  status: "created" | "exists",
): void {
  const at = new Date().toISOString();
  for (const row of rows) {
    const idx = typeof row.index === "number" ? row.index : -1;
    const job =
      (idx >= 0 && jobs[idx]) ||
      jobs.find(
        (j) =>
          j.link.replace(/\/$/, "") === String(row.externalUrl || row.url || "").replace(/\/$/, ""),
      );
    if (!job || !row.sid) continue;
    const hubUrl = hubPublicUrl(String(row.sid), row.url);
    markHubShared(job.id, {
      at,
      sid: String(row.sid),
      hubUrl,
      hubId: row.id ? String(row.id) : undefined,
      status,
    });
    logOutreach({
      id: `hub-${job.id}`,
      status: "ok",
      channel: "hub",
      contact: `workix.co/order/${row.sid}`,
      project: job.title,
      url: hubUrl,
      jobId: job.id,
      text: `Shared to Workix hub (${status}): ${hubUrl} ← ${job.link}`,
      note: `platform=${job.platform}; externalId=${job.id}`,
      at,
    });
  }
}

export async function runShareJobs(args: {
  job_ids?: string[];
  jobs?: Job[];
  /** Re-POST even if local store already marked hubShare (hub may still skip as exists). */
  force?: boolean;
}): Promise<unknown> {
  const fromIds: Job[] = [];
  for (const id of args.job_ids || []) {
    const j = getJob(String(id));
    if (j) fromIds.push(j);
  }
  const jobs = [...(args.jobs || []), ...fromIds];
  if (!jobs.length) {
    return { ok: false, error: "No jobs to share (pass job_ids from digest/search or jobs[])" };
  }

  const already: Array<{ jobId: string; sid: string; hubUrl: string }> = [];
  const toSend: Job[] = [];
  const seen = new Set<string>();
  for (const j of jobs) {
    if (!j?.id || seen.has(j.id)) continue;
    seen.add(j.id);
    if (!args.force && isHubShared(j.id)) {
      const hs = getJob(j.id)?.hubShare;
      if (hs) already.push({ jobId: j.id, sid: hs.sid, hubUrl: hs.hubUrl });
      continue;
    }
    toSend.push(j);
    if (toSend.length >= 20) break;
  }

  if (!toSend.length) {
    return {
      ok: true,
      shared: 0,
      skipped_local: already,
      created: [],
      skipped: [],
      errors: [],
      count: { created: 0, skipped: already.length, errors: 0 },
      hint: "All candidates already marked hubShare locally. Use force:true to re-check hub.",
    };
  }

  const items = toSend.map(jobToShareItem);
  const res = await hubShareOrders(items);
  if (!res.ok) {
    return {
      ok: false,
      shared: items.length,
      skipped_local: already,
      error: res.error,
      status: res.status,
      data: res.data,
    };
  }

  const data = (res.data || {}) as {
    created?: Array<{ status?: string; index?: number; id?: string; sid?: string; url?: string; externalUrl?: string }>;
    skipped?: Array<{ status?: string; index?: number; id?: string; sid?: string; url?: string }>;
    errors?: unknown[];
    count?: unknown;
  };

  recordShareResult(toSend, data.created || [], "created");
  recordShareResult(
    toSend,
    (data.skipped || []).map((s) => ({
      ...s,
      externalUrl: s.url,
    })),
    "exists",
  );

  return {
    ok: true,
    shared: items.length,
    skipped_local: already,
    created: data.created || [],
    skipped: data.skipped || [],
    errors: data.errors || [],
    count: data.count,
    hint: "Local store updated: job.hubShare + hubShares[] + outreach channel=hub. Check workix_history / workix_hub_share_status.",
  };
}

export async function runHubShareStatus(args: {
  limit?: number;
  platform?: string;
}): Promise<unknown> {
  const shared = listHubShares({ limit: args.limit ?? 50, platform: args.platform });
  const unshared = listUnsharedJobs({ limit: args.limit ?? 30 });
  return {
    shared_count: shared.length,
    unshared_count: unshared.length,
    shared,
    unshared: unshared.map((j) => ({
      id: j.id,
      platform: j.platform,
      title: j.title,
      link: j.link,
      fetchedAt: j.fetchedAt,
    })),
    hint: "Share pending with workix_share_jobs / digest share_to_hub:true. Already shared are skipped unless force:true.",
  };
}
