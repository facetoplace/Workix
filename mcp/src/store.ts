import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DraftRecord, Job, StoredJob } from "./types.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = process.env.WORKIX_MCP_DATA || join(ROOT, "data");
const STORE_PATH = join(DATA_DIR, "store.json");

interface StoreData {
  jobs: Record<string, StoredJob>;
  drafts: DraftRecord[];
  shownDigestIds: string[];
}

function empty(): StoreData {
  return { jobs: {}, drafts: [], shownDigestIds: [] };
}

function ensure(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, JSON.stringify(empty(), null, 2), "utf8");
  }
}

function load(): StoreData {
  ensure();
  try {
    return JSON.parse(readFileSync(STORE_PATH, "utf8")) as StoreData;
  } catch {
    return empty();
  }
}

function save(data: StoreData): void {
  ensure();
  writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
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
    const stored: StoredJob = existing
      ? { ...existing, ...job, seenAt: existing.seenAt }
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

export function dataDir(): string {
  ensure();
  return DATA_DIR;
}
