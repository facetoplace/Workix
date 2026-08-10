/**
 * Apply tracking against the hub — "the user applied to this job".
 *
 * One call does four things: publishes the board job into the workix.co catalog
 * if it is not there yet, records the application (status + date + the text that
 * was sent) on the backend, mirrors it into the local store so offline lookups
 * and digest filtering keep working, and makes the whole thing readable from any
 * other device with the same agent key.
 *
 * Catalog mirroring stays a separate, broader channel (workix_share_jobs /
 * digest share_to_hub) — this one only covers jobs a human actually engaged with.
 */
import {
  deleteOutreach,
  getJob,
  getLatestDraft,
  logOutreach,
  markHubShared,
} from "../store.js";
import type { OutreachStatus, StoredJob } from "../types.js";
import {
  hubDeleteApplication,
  hubListApplications,
  hubRecordApplication,
  hubUpdateApplication,
} from "./hub.js";

const HUB_BASE = (process.env.WORKIX_API || process.env.WORKIX_HUB_API || "https://workix.co")
  .replace(/\/$/, "");

/** Funnel statuses accepted by the hub (lib/hub-applications.js). */
const HUB_STATUSES = [
  "draft",
  "sent",
  "viewed",
  "reply",
  "interview",
  "offer",
  "hired",
  "rejected",
  "closed",
] as const;
type HubStatus = (typeof HUB_STATUSES)[number];

/** Local outreach vocabulary → hub funnel. */
const TO_HUB: Record<string, HubStatus> = {
  draft: "draft",
  sent: "sent",
  ok: "sent",
  reply: "reply",
  skip: "closed",
  blocked: "rejected",
};

/** Hub funnel → local outreach vocabulary (store.ts OutreachStatus). */
const TO_LOCAL: Record<HubStatus, OutreachStatus> = {
  draft: "draft",
  sent: "sent",
  viewed: "sent",
  reply: "reply",
  interview: "reply",
  offer: "reply",
  hired: "ok",
  rejected: "blocked",
  closed: "skip",
};

function toHubStatus(raw: string | undefined, fallback: HubStatus = "sent"): HubStatus {
  const s = String(raw || "").trim().toLowerCase();
  if ((HUB_STATUSES as readonly string[]).includes(s)) return s as HubStatus;
  return TO_HUB[s] || fallback;
}

function jobPayload(job: StoredJob) {
  return {
    url: job.link,
    platform: String(job.platform),
    externalId: job.id,
    title: job.title,
    description: job.description || "",
    kind: job.kind,
    budget: job.budget,
    originalPublishedAt: job.date,
  };
}

type HubResponse = {
  ok: boolean;
  status?: number;
  error?: string;
  data?: unknown;
};

export async function runTrackApply(args: {
  job_id?: string;
  url?: string;
  /** Hub listing ids — use when applying to something already on workix.co. */
  order_id?: string;
  role_id?: string;
  status?: string;
  /** tg | hh | email | board | browser | api — how it was sent. */
  channel?: string;
  /** agent = the agent sent it itself; user = the human applied by hand. */
  via?: "agent" | "user";
  /** The proposal / cover letter that was actually sent. */
  text?: string;
  note?: string;
  applied_at?: string;
  /** Only needed when the job is not in the local store. */
  platform?: string;
  title?: string;
  description?: string;
  budget?: string;
}): Promise<unknown> {
  const key = args.job_id?.trim() || args.url?.trim();
  const job = key ? getJob(key) : undefined;

  if (!job && !args.order_id && !args.role_id) {
    if (!args.url?.trim() || !args.platform?.trim() || !args.title?.trim()) {
      return {
        ok: false,
        error:
          "Job not in the local store — pass url + platform + title (or order_id / role_id), or capture it first with workix_get_job.",
      };
    }
  }

  const status = toHubStatus(args.status, "sent");
  const via: "agent" | "user" = args.via === "user" ? "user" : "agent";
  // The agent's own draft is the text it sent, unless the caller overrides it.
  const text =
    args.text?.trim() || (job && via === "agent" ? getLatestDraft(job.id)?.text : "") || "";

  const body = {
    ...(args.order_id ? { orderId: args.order_id } : {}),
    ...(args.role_id ? { roleId: args.role_id } : {}),
    ...(job ? jobPayload(job) : {}),
    ...(args.url && !job ? { url: args.url } : {}),
    ...(args.platform && !job ? { platform: args.platform } : {}),
    ...(args.title && !job ? { title: args.title } : {}),
    ...(args.description && !job ? { description: args.description } : {}),
    ...(args.budget && !job ? { budget: args.budget } : {}),
    status,
    channel: args.channel || (job ? String(job.platform) : "board"),
    via,
    ...(text ? { text, textSource: via } : {}),
    ...(args.note ? { note: args.note } : {}),
    ...(args.applied_at ? { appliedAt: args.applied_at } : {}),
  };

  const res = (await hubRecordApplication(body)) as HubResponse;
  const data = (res.data || {}) as {
    created?: boolean;
    application?: { id?: string; status?: string; appliedAt?: string };
    order?: { id?: string; sid?: string; url?: string } | null;
    share?: string;
  };

  // Local mirror — job_state / digest filtering must keep working without network.
  let localOutreachId: string | undefined;
  if (job) {
    const rec = logOutreach({
      id: `apply-${job.id}`,
      status: TO_LOCAL[status],
      channel: args.channel || String(job.platform),
      contact: job.link,
      project: job.title,
      url: job.link,
      jobId: job.id,
      text: text || `Applied (${status})`,
      note: res.ok
        ? `hub application ${data.application?.id || ""} (${status}, via ${via})`
        : `hub sync failed: ${res.error || "unknown"} — retry workix_track_apply`,
      at: args.applied_at,
    });
    localOutreachId = rec.id;
    if (res.ok && data.order?.sid) {
      markHubShared(job.id, {
        at: new Date().toISOString(),
        sid: String(data.order.sid),
        hubUrl: `${HUB_BASE}/order/${data.order.sid}`,
        hubId: data.order.id ? String(data.order.id) : undefined,
        status: data.share === "created" ? "created" : "exists",
      });
    }
  }

  if (!res.ok) {
    return {
      ok: false,
      error: res.error,
      status: res.status,
      logged_locally: !!localOutreachId,
      hint:
        res.status === 401
          ? "WORKIX_AGENT_KEY missing or revoked — workix_hub_register / rotate, then retry."
          : "Recorded locally only. Re-run workix_track_apply to push it to the hub.",
    };
  }

  return {
    ok: true,
    created: !!data.created,
    application: data.application,
    order: data.order,
    // created = the job was new to workix.co and is now published there
    catalog: data.share || null,
    local_outreach_id: localOutreachId,
    hint:
      "Recorded on workix.co (private) + local store. The listing shows an anonymous counter only. Move the funnel with workix_update_apply.",
  };
}

export async function runListApplies(args: {
  status?: string;
  q?: string;
  url?: string;
  since?: string;
  limit?: number;
  with_text?: boolean;
} = {}): Promise<unknown> {
  const res = (await hubListApplications(args)) as HubResponse;
  if (!res.ok) return res;
  const data = (res.data || {}) as {
    items?: Array<Record<string, unknown>>;
    hasMore?: boolean;
    statuses?: string[];
  };
  const items = data.items || [];
  return {
    ok: true,
    count: items.length,
    hasMore: !!data.hasMore,
    statuses: data.statuses || HUB_STATUSES,
    items,
    hint:
      "Cross-device apply history. Past texts (textSource=user are the human's own words) are the best base for a new proposal on a similar job — reuse the wording, not the wording of a generic template.",
  };
}

export async function runUpdateApply(args: {
  id: string;
  status?: string;
  text?: string;
  text_source?: "agent" | "user";
  note?: string;
}): Promise<unknown> {
  if (!args.id?.trim()) return { ok: false, error: "id required (from workix_list_applies)" };
  const res = (await hubUpdateApplication({
    id: args.id,
    ...(args.status ? { status: toHubStatus(args.status) } : {}),
    ...(args.text != null ? { text: args.text } : {}),
    ...(args.text_source ? { textSource: args.text_source } : {}),
    ...(args.note != null ? { note: args.note } : {}),
  })) as HubResponse;
  if (!res.ok) return res;
  return { ok: true, application: (res.data as { application?: unknown })?.application };
}

/**
 * Remove an application record — a mistracked apply, or a test row.
 * Deletes the hub row and the local mirror; the job stays in the catalog, since
 * that listing is a contribution to the board, not part of this private log.
 */
export async function runDeleteApply(args: {
  id: string;
  confirm?: boolean;
}): Promise<unknown> {
  if (!args.id?.trim()) return { ok: false, error: "id required (from workix_list_applies)" };
  if (args.confirm !== true) {
    return {
      ok: false,
      error:
        "Refused: set confirm:true. This permanently deletes the application record (status history and the sent text) on workix.co.",
    };
  }

  // Read it first: the URL is what links the hub row to the local mirror.
  const before = (await hubListApplications({ limit: 200 })) as HubResponse;
  const row = (((before.data || {}) as { items?: Array<Record<string, unknown>> }).items || []).find(
    (r) => String(r.id) === args.id.trim(),
  );

  const res = (await hubDeleteApplication({ id: args.id.trim() })) as HubResponse;
  if (!res.ok) return res;

  const localIds = [`hubapply-${args.id.trim()}`];
  const url = String((row?.external as { url?: string } | undefined)?.url || "");
  if (url) {
    const job = getJob(url);
    if (job) localIds.push(`apply-${job.id}`);
  }
  const removedLocally = deleteOutreach(localIds);

  return {
    ok: true,
    deleted: (res.data as { deleted?: unknown })?.deleted ?? { id: args.id.trim() },
    removed_local_outreach: removedLocally,
    note: "The mirrored job stays in the workix.co catalog — only the private application record is gone.",
  };
}

/**
 * Pull the hub history into the local store, so a fresh machine (or a wiped
 * mcp/data) still knows what was already applied to — digest `only_new` and the
 * contacted filter read the local outreach table.
 */
export async function runSyncApplies(args: {
  since?: string;
  limit?: number;
} = {}): Promise<unknown> {
  const res = (await hubListApplications({
    since: args.since,
    limit: args.limit ?? 100,
  })) as HubResponse;
  if (!res.ok) return res;
  const items = ((res.data || {}) as { items?: Array<Record<string, unknown>> }).items || [];
  let synced = 0;
  const rows: Array<{ id: string; title: string; status: string; url: string }> = [];
  for (const raw of items) {
    const id = String(raw.id || "");
    if (!id) continue;
    const external = (raw.external || null) as { url?: string; platform?: string } | null;
    const url = String(external?.url || raw.orderUrl || "");
    const status = toHubStatus(String(raw.status || "sent"));
    // Stable id → re-running the sync updates rows instead of duplicating them.
    logOutreach({
      id: `hubapply-${id}`,
      status: TO_LOCAL[status],
      channel: String(raw.channel || external?.platform || "hub-apply"),
      contact: url || String(raw.title || id),
      project: String(raw.title || ""),
      url: url || undefined,
      text: String(raw.text || `Applied (${status})`),
      note: `synced from workix.co application ${id}`,
      at: raw.appliedAt ? String(raw.appliedAt) : undefined,
    });
    synced += 1;
    rows.push({ id, title: String(raw.title || ""), status, url });
  }
  return {
    ok: true,
    fetched: items.length,
    synced,
    items: rows,
    hint:
      "Hub applications mirrored into the local outreach log. Jobs applied to on another device are now filtered out of digests here too.",
  };
}
