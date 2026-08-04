import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  CheckpointRecord,
  DraftRecord,
  HubShareInfo,
  HubShareRecord,
  Job,
  OutreachRecord,
  OutreachStatus,
  StoredJob,
} from "./types.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function resolveDataDir(): string {
  if (process.env.WORKIX_MCP_DATA?.trim()) {
    return process.env.WORKIX_MCP_DATA.trim();
  }
  return join(ROOT, "data");
}

function storePath(): string {
  return join(resolveDataDir(), "store.json");
}

interface StoreData {
  jobs: Record<string, StoredJob>;
  drafts: DraftRecord[];
  shownDigestIds: string[];
  outreach: OutreachRecord[];
  checkpoints: CheckpointRecord[];
  hubShares: HubShareRecord[];
}

function empty(): StoreData {
  return {
    jobs: {},
    drafts: [],
    shownDigestIds: [],
    outreach: [],
    checkpoints: [],
    hubShares: [],
  };
}

function ensure(): void {
  const dir = resolveDataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const path = storePath();
  if (!existsSync(path)) {
    writeFileSync(path, JSON.stringify(empty(), null, 2), "utf8");
  }
}

function load(): StoreData {
  ensure();
  try {
    const raw = JSON.parse(readFileSync(storePath(), "utf8")) as Partial<StoreData>;
    return {
      jobs: raw.jobs ?? {},
      drafts: raw.drafts ?? [],
      shownDigestIds: raw.shownDigestIds ?? [],
      outreach: raw.outreach ?? [],
      checkpoints: raw.checkpoints ?? [],
      hubShares: raw.hubShares ?? [],
    };
  } catch {
    return empty();
  }
}

function save(data: StoreData): void {
  ensure();
  writeFileSync(storePath(), JSON.stringify(data, null, 2), "utf8");
}

export function jobId(platform: string, link: string): string {
  return createHash("sha1").update(`${platform}|${link}`).digest("hex").slice(0, 16);
}

export function upsertJobs(jobs: Job[]): StoredJob[] {
  const data = load();
  const out: StoredJob[] = [];
  const now = new Date().toISOString();
  for (const job of jobs) {
    const existing = data.jobs[job.id];
    // Preserve hubShare / seenAt when refreshing board cards
    const stored: StoredJob = existing
      ? {
          ...existing,
          ...job,
          seenAt: existing.seenAt,
          ...(existing.hubShare ? { hubShare: existing.hubShare } : {}),
          ...(existing.shownInDigest ? { shownInDigest: true } : {}),
        }
      : { ...job, seenAt: now };
    data.jobs[job.id] = stored;
    out.push(stored);
  }
  save(data);
  return out;
}

export function getJob(idOrUrl: string): StoredJob | undefined {
  const data = load();
  if (data.jobs[idOrUrl]) return data.jobs[idOrUrl];
  const byLink = Object.values(data.jobs).find(
    (j) => j.link === idOrUrl || j.link.replace(/\/$/, "") === idOrUrl.replace(/\/$/, ""),
  );
  return byLink;
}

export function listJobs(): StoredJob[] {
  return Object.values(load().jobs);
}

export function markDigestShown(ids: string[]): void {
  const data = load();
  const set = new Set(data.shownDigestIds);
  for (const id of ids) set.add(id);
  data.shownDigestIds = [...set].slice(-5000);
  for (const id of ids) {
    if (data.jobs[id]) data.jobs[id].shownInDigest = true;
  }
  save(data);
}

export function wasShownInDigest(id: string): boolean {
  const data = load();
  return data.shownDigestIds.includes(id) || Boolean(data.jobs[id]?.shownInDigest);
}

export function saveDraft(jobIdValue: string, text: string): DraftRecord {
  const data = load();
  const rec: DraftRecord = {
    jobId: jobIdValue,
    text,
    createdAt: new Date().toISOString(),
  };
  data.drafts.push(rec);
  data.drafts = data.drafts.slice(-200);
  save(data);
  return rec;
}

export function getLatestDraft(jobIdValue: string): DraftRecord | undefined {
  const data = load();
  return [...data.drafts].reverse().find((d) => d.jobId === jobIdValue);
}

export function logOutreach(input: {
  status: OutreachStatus;
  channel: string;
  contact: string;
  text: string;
  project?: string;
  url?: string;
  jobId?: string;
  note?: string;
  at?: string;
  id?: string;
}): OutreachRecord {
  const data = load();
  const at = input.at?.trim() || new Date().toISOString();
  const contact = input.contact.trim();
  const channel = input.channel.trim().toLowerCase();
  const id =
    input.id?.trim() ||
    createHash("sha1")
      .update(`${channel}|${contact}|${input.url || ""}|${at}|${input.text.slice(0, 80)}`)
      .digest("hex")
      .slice(0, 12);
  const rec: OutreachRecord = {
    id,
    at,
    status: input.status,
    channel,
    contact,
    text: input.text.trim(),
    ...(input.project?.trim() ? { project: input.project.trim() } : {}),
    ...(input.url?.trim() ? { url: input.url.trim() } : {}),
    ...(input.jobId?.trim() ? { jobId: input.jobId.trim() } : {}),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
  };
  const idx = data.outreach.findIndex((o) => o.id === id);
  if (idx >= 0) data.outreach[idx] = { ...data.outreach[idx], ...rec };
  else data.outreach.push(rec);
  data.outreach = data.outreach.slice(-500);
  save(data);
  return rec;
}

export function listOutreach(opts?: {
  status?: OutreachStatus;
  contact?: string;
  channel?: string;
  limit?: number;
}): OutreachRecord[] {
  const data = load();
  let rows = [...data.outreach].reverse();
  if (opts?.status) rows = rows.filter((r) => r.status === opts.status);
  if (opts?.channel) {
    const ch = opts.channel.trim().toLowerCase();
    rows = rows.filter((r) => r.channel === ch);
  }
  if (opts?.contact) {
    const q = opts.contact.trim().toLowerCase();
    rows = rows.filter((r) => r.contact.toLowerCase().includes(q));
  }
  const limit = Math.min(Math.max(opts?.limit ?? 30, 1), 100);
  return rows.slice(0, limit);
}

export function setCheckpoint(input: {
  summary: string;
  next?: string;
  surfaces?: string[];
  batch?: string;
  blocked?: string[];
  note?: string;
  at?: string;
  id?: string;
}): CheckpointRecord {
  const data = load();
  const at = input.at?.trim() || new Date().toISOString();
  const summary = input.summary.trim();
  const id =
    input.id?.trim() ||
    createHash("sha1").update(`${at}|${summary}`).digest("hex").slice(0, 12);
  const rec: CheckpointRecord = {
    id,
    at,
    summary,
    ...(input.next?.trim() ? { next: input.next.trim() } : {}),
    ...(input.surfaces?.length
      ? { surfaces: input.surfaces.map((s) => s.trim()).filter(Boolean) }
      : {}),
    ...(input.batch?.trim() ? { batch: input.batch.trim() } : {}),
    ...(input.blocked?.length
      ? { blocked: input.blocked.map((s) => s.trim()).filter(Boolean) }
      : {}),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
  };
  data.checkpoints.push(rec);
  data.checkpoints = data.checkpoints.slice(-100);
  save(data);
  return rec;
}

export function getLatestCheckpoint(): CheckpointRecord | undefined {
  const data = load();
  return data.checkpoints.length
    ? data.checkpoints[data.checkpoints.length - 1]
    : undefined;
}

export function listCheckpoints(limit = 10): CheckpointRecord[] {
  const data = load();
  const n = Math.min(Math.max(limit, 1), 50);
  return [...data.checkpoints].reverse().slice(0, n);
}

export function isHubShared(jobIdValue: string): boolean {
  const job = getJob(jobIdValue);
  return Boolean(job?.hubShare?.sid);
}

export function markHubShared(
  jobIdValue: string,
  info: HubShareInfo,
): HubShareRecord | undefined {
  const data = load();
  const job = data.jobs[jobIdValue];
  if (!job) return undefined;
  job.hubShare = info;
  data.jobs[jobIdValue] = job;
  const rec: HubShareRecord = {
    id: createHash("sha1")
      .update(`${jobIdValue}|${info.sid}|${info.at}`)
      .digest("hex")
      .slice(0, 12),
    at: info.at,
    jobId: jobIdValue,
    platform: String(job.platform),
    title: job.title,
    externalUrl: job.link,
    sid: info.sid,
    hubUrl: info.hubUrl,
    ...(info.hubId ? { hubId: info.hubId } : {}),
    status: info.status,
  };
  const prev = data.hubShares.findIndex(
    (h) => h.jobId === jobIdValue || h.sid === info.sid,
  );
  if (prev >= 0) data.hubShares[prev] = rec;
  else data.hubShares.push(rec);
  data.hubShares = data.hubShares.slice(-500);
  save(data);
  return rec;
}

export function listHubShares(opts?: {
  limit?: number;
  platform?: string;
}): HubShareRecord[] {
  const data = load();
  let rows = [...data.hubShares].reverse();
  if (opts?.platform) {
    const p = opts.platform.trim().toLowerCase();
    rows = rows.filter((r) => r.platform.toLowerCase() === p);
  }
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
  return rows.slice(0, limit);
}

export function listUnsharedJobs(opts?: { limit?: number }): StoredJob[] {
  const data = load();
  const rows = Object.values(data.jobs)
    .filter((j) => !j.hubShare?.sid)
    .sort((a, b) => (b.fetchedAt || b.seenAt).localeCompare(a.fetchedAt || a.seenAt));
  const limit = Math.min(Math.max(opts?.limit ?? 30, 1), 100);
  return rows.slice(0, limit);
}

/** Unified local history: hub shares + outreach + checkpoints. */
export function listHistory(limit = 40): {
  hubShares: HubShareRecord[];
  outreach: OutreachRecord[];
  checkpoints: CheckpointRecord[];
  counts: { hubShared: number; hubUnshared: number; outreach: number };
} {
  const data = load();
  const n = Math.min(Math.max(limit, 1), 100);
  const hubShared = Object.values(data.jobs).filter((j) => j.hubShare?.sid).length;
  const hubUnshared = Object.values(data.jobs).length - hubShared;
  return {
    hubShares: [...data.hubShares].reverse().slice(0, n),
    outreach: [...data.outreach].reverse().slice(0, n),
    checkpoints: [...data.checkpoints].reverse().slice(0, Math.min(n, 10)),
    counts: {
      hubShared,
      hubUnshared,
      outreach: data.outreach.length,
    },
  };
}

export function dataDir(): string {
  ensure();
  return resolveDataDir();
}
