import { createHash } from "node:crypto";
import { db, nullable, resolveDataDir } from "./db.js";
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

/**
 * Same API as the old JSON-file store — every call is now a single indexed
 * query instead of parsing the whole store. See db.ts for why.
 */

interface JobRow {
  id: string;
  platform: string;
  kind: string | null;
  title: string;
  description: string;
  link: string;
  date: string;
  budget: string | null;
  raw: string | null;
  fetched_at: string;
  seen_at: string;
  shown_in_digest: number;
  hub_share: string | null;
}

function parseJson<T>(s: string | null): T | undefined {
  if (!s) return undefined;
  try {
    return JSON.parse(s) as T;
  } catch {
    return undefined;
  }
}

function toJob(r: JobRow): StoredJob {
  const hubShare = parseJson<HubShareInfo>(r.hub_share);
  return {
    id: r.id,
    platform: r.platform,
    ...(r.kind ? { kind: r.kind as StoredJob["kind"] } : {}),
    title: r.title,
    description: r.description,
    link: r.link,
    date: r.date,
    ...(r.budget ? { budget: r.budget } : {}),
    ...(r.raw ? { raw: parseJson(r.raw) } : {}),
    fetchedAt: r.fetched_at,
    seenAt: r.seen_at,
    ...(r.shown_in_digest ? { shownInDigest: true } : {}),
    ...(hubShare ? { hubShare } : {}),
  };
}

export function jobId(platform: string, link: string): string {
  return createHash("sha1").update(`${platform}|${link}`).digest("hex").slice(0, 16);
}

export function upsertJobs(jobs: Job[]): StoredJob[] {
  const conn = db();
  const now = new Date().toISOString();
  const out: StoredJob[] = [];

  const get = conn.prepare("SELECT * FROM jobs WHERE id = ?");
  // Refreshing a card must not lose the work attached to it: seen_at marks when
  // we first saw it, and hub_share / shown_in_digest record what we already did.
  const ins = conn.prepare(
    `INSERT INTO jobs
       (id, platform, kind, title, description, link, date, budget, raw, fetched_at, seen_at, shown_in_digest, hub_share)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       platform    = excluded.platform,
       kind        = excluded.kind,
       title       = excluded.title,
       description = excluded.description,
       link        = excluded.link,
       date        = excluded.date,
       budget      = excluded.budget,
       raw         = excluded.raw,
       fetched_at  = excluded.fetched_at`,
  );

  conn.exec("BEGIN");
  try {
    for (const job of jobs) {
      const existing = get.get(job.id) as JobRow | undefined;
      ins.run(
        job.id,
        String(job.platform),
        nullable(job.kind),
        job.title,
        job.description || "",
        job.link,
        job.date,
        nullable(job.budget),
        job.raw === undefined ? null : JSON.stringify(job.raw),
        job.fetchedAt || now,
        existing?.seen_at || now,
        existing?.shown_in_digest || 0,
        existing?.hub_share ?? null,
      );
      out.push({
        ...job,
        seenAt: existing?.seen_at || now,
        ...(existing?.shown_in_digest ? { shownInDigest: true } : {}),
        ...(existing?.hub_share
          ? { hubShare: parseJson<HubShareInfo>(existing.hub_share) }
          : {}),
      } as StoredJob);
    }
    conn.exec("COMMIT");
  } catch (e) {
    conn.exec("ROLLBACK");
    throw e;
  }
  return out;
}

export function getJob(idOrUrl: string): StoredJob | undefined {
  const conn = db();
  const byId = conn.prepare("SELECT * FROM jobs WHERE id = ?").get(idOrUrl) as
    | JobRow
    | undefined;
  if (byId) return toJob(byId);

  const trimmed = idOrUrl.replace(/\/$/, "");
  const byLink = conn
    .prepare("SELECT * FROM jobs WHERE link = ? OR link = ? LIMIT 1")
    .get(idOrUrl, trimmed) as JobRow | undefined;
  if (byLink) return toJob(byLink);

  const withSlash = conn
    .prepare("SELECT * FROM jobs WHERE link = ? LIMIT 1")
    .get(`${trimmed}/`) as JobRow | undefined;
  return withSlash ? toJob(withSlash) : undefined;
}

export function listJobs(): StoredJob[] {
  const rows = db()
    .prepare("SELECT * FROM jobs ORDER BY date DESC")
    .all() as unknown as JobRow[];
  return rows.map(toJob);
}

export function markDigestShown(ids: string[]): void {
  if (!ids.length) return;
  const conn = db();
  const now = new Date().toISOString();
  const insShown = conn.prepare(
    "INSERT INTO shown_digest (id, at) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET at = excluded.at",
  );
  const mark = conn.prepare("UPDATE jobs SET shown_in_digest = 1 WHERE id = ?");
  conn.exec("BEGIN");
  try {
    for (const id of ids) {
      insShown.run(id, now);
      mark.run(id);
    }
    conn.exec("COMMIT");
  } catch (e) {
    conn.exec("ROLLBACK");
    throw e;
  }
  // Keep the seen-set bounded, oldest first.
  conn.exec(
    "DELETE FROM shown_digest WHERE id NOT IN (SELECT id FROM shown_digest ORDER BY at DESC LIMIT 20000)",
  );
}

export function wasShownInDigest(id: string): boolean {
  const row = db()
    .prepare(
      `SELECT 1 AS hit FROM shown_digest WHERE id = ?
       UNION ALL
       SELECT 1 FROM jobs WHERE id = ? AND shown_in_digest = 1
       LIMIT 1`,
    )
    .get(id, id) as { hit: number } | undefined;
  return Boolean(row);
}

export function saveDraft(jobIdValue: string, text: string): DraftRecord {
  const conn = db();
  const rec: DraftRecord = {
    jobId: jobIdValue,
    text,
    createdAt: new Date().toISOString(),
  };
  conn
    .prepare("INSERT INTO drafts (job_id, text, created_at) VALUES (?, ?, ?)")
    .run(rec.jobId, rec.text, rec.createdAt);
  conn.exec(
    "DELETE FROM drafts WHERE rowid_alias NOT IN (SELECT rowid_alias FROM drafts ORDER BY created_at DESC LIMIT 500)",
  );
  return rec;
}

export function getLatestDraft(jobIdValue: string): DraftRecord | undefined {
  const row = db()
    .prepare(
      "SELECT job_id, text, created_at FROM drafts WHERE job_id = ? ORDER BY created_at DESC LIMIT 1",
    )
    .get(jobIdValue) as
    | { job_id: string; text: string; created_at: string }
    | undefined;
  return row
    ? { jobId: row.job_id, text: row.text, createdAt: row.created_at }
    : undefined;
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
  db()
    .prepare(
      `INSERT INTO outreach (id, at, status, channel, contact, text, project, url, job_id, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         at = excluded.at, status = excluded.status, channel = excluded.channel,
         contact = excluded.contact, text = excluded.text, project = excluded.project,
         url = excluded.url, job_id = excluded.job_id, note = excluded.note`,
    )
    .run(
      rec.id,
      rec.at,
      rec.status,
      rec.channel,
      rec.contact,
      rec.text,
      nullable(rec.project),
      nullable(rec.url),
      nullable(rec.jobId),
      nullable(rec.note),
    );
  return rec;
}

interface OutreachRow {
  id: string;
  at: string;
  status: string;
  channel: string;
  contact: string;
  text: string;
  project: string | null;
  url: string | null;
  job_id: string | null;
  note: string | null;
}

function toOutreach(r: OutreachRow): OutreachRecord {
  return {
    id: r.id,
    at: r.at,
    status: r.status as OutreachStatus,
    channel: r.channel,
    contact: r.contact,
    text: r.text,
    ...(r.project ? { project: r.project } : {}),
    ...(r.url ? { url: r.url } : {}),
    ...(r.job_id ? { jobId: r.job_id } : {}),
    ...(r.note ? { note: r.note } : {}),
  };
}

/**
 * Drop outreach rows by id. Used when an application is deleted on the hub, so
 * the local mirror does not keep claiming the job was answered.
 * Returns how many rows were actually removed.
 */
export function deleteOutreach(ids: string[]): number {
  const clean = ids.map((i) => i.trim()).filter(Boolean);
  if (!clean.length) return 0;
  const stmt = db().prepare("DELETE FROM outreach WHERE id = ?");
  let removed = 0;
  for (const id of clean) {
    removed += stmt.run(id).changes as number;
  }
  return removed;
}

export function listOutreach(opts?: {
  status?: OutreachStatus;
  contact?: string;
  channel?: string;
  jobId?: string;
  limit?: number;
}): OutreachRecord[] {
  const where: string[] = [];
  const params: string[] = [];
  if (opts?.status) {
    where.push("status = ?");
    params.push(opts.status);
  }
  if (opts?.jobId) {
    where.push("job_id = ?");
    params.push(opts.jobId.trim());
  }
  if (opts?.channel) {
    where.push("channel = ?");
    params.push(opts.channel.trim().toLowerCase());
  }
  if (opts?.contact) {
    where.push("LOWER(contact) LIKE ?");
    params.push(`%${opts.contact.trim().toLowerCase()}%`);
  }
  const limit = Math.min(Math.max(opts?.limit ?? 30, 1), 100);
  const sql = `SELECT * FROM outreach ${
    where.length ? `WHERE ${where.join(" AND ")}` : ""
  } ORDER BY at DESC LIMIT ${limit}`;
  return (db().prepare(sql).all(...params) as unknown as OutreachRow[]).map(toOutreach);
}

/** Normalize a link so the same posting matches across trackers/mirrors. */
export function normalizeLink(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url.trim());
    // LinkedIn/Indeed serve one posting under many country subdomains
    // (fr./ca./mx.linkedin.com) — same job, so collapse them.
    const host = u.hostname
      .toLowerCase()
      .replace(/^www\./, "")
      .replace(/^[a-z]{2}\.(linkedin|indeed)\./, "$1.");
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    return `${host}${path}`;
  } catch {
    return url.trim().toLowerCase() || undefined;
  }
}

/**
 * Every job already touched in any way — url or job_id, any status.
 *
 * The digest subtracts this so cards the user already wrote to never resurface.
 * Unbounded on purpose: listOutreach caps at 100 rows, which is a UI limit, not
 * a dedupe one.
 */
export function contactedKeys(): Set<string> {
  const rows = db()
    .prepare("SELECT url, job_id, contact FROM outreach")
    .all() as Array<{ url: string | null; job_id: string | null; contact: string | null }>;

  const keys = new Set<string>();
  for (const r of rows) {
    const link = normalizeLink(r.url || undefined);
    if (link) keys.add(link);
    if (r.job_id) keys.add(r.job_id.trim());
  }
  return keys;
}

interface CheckpointRow {
  id: string;
  at: string;
  summary: string;
  next: string | null;
  surfaces: string | null;
  batch: string | null;
  blocked: string | null;
  note: string | null;
}

function toCheckpoint(r: CheckpointRow): CheckpointRecord {
  const surfaces = parseJson<string[]>(r.surfaces);
  const blocked = parseJson<string[]>(r.blocked);
  return {
    id: r.id,
    at: r.at,
    summary: r.summary,
    ...(r.next ? { next: r.next } : {}),
    ...(surfaces?.length ? { surfaces } : {}),
    ...(r.batch ? { batch: r.batch } : {}),
    ...(blocked?.length ? { blocked } : {}),
    ...(r.note ? { note: r.note } : {}),
  };
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
  const at = input.at?.trim() || new Date().toISOString();
  const summary = input.summary.trim();
  const id =
    input.id?.trim() ||
    createHash("sha1").update(`${at}|${summary}`).digest("hex").slice(0, 12);
  const surfaces = input.surfaces?.map((s) => s.trim()).filter(Boolean) || [];
  const blocked = input.blocked?.map((s) => s.trim()).filter(Boolean) || [];
  const rec: CheckpointRecord = {
    id,
    at,
    summary,
    ...(input.next?.trim() ? { next: input.next.trim() } : {}),
    ...(surfaces.length ? { surfaces } : {}),
    ...(input.batch?.trim() ? { batch: input.batch.trim() } : {}),
    ...(blocked.length ? { blocked } : {}),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
  };
  const conn = db();
  conn
    .prepare(
      `INSERT INTO checkpoints (id, at, summary, next, surfaces, batch, blocked, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         at = excluded.at, summary = excluded.summary, next = excluded.next,
         surfaces = excluded.surfaces, batch = excluded.batch,
         blocked = excluded.blocked, note = excluded.note`,
    )
    .run(
      rec.id,
      rec.at,
      rec.summary,
      nullable(rec.next),
      surfaces.length ? JSON.stringify(surfaces) : null,
      nullable(rec.batch),
      blocked.length ? JSON.stringify(blocked) : null,
      nullable(rec.note),
    );
  conn.exec(
    "DELETE FROM checkpoints WHERE id NOT IN (SELECT id FROM checkpoints ORDER BY at DESC LIMIT 200)",
  );
  return rec;
}

export function getLatestCheckpoint(): CheckpointRecord | undefined {
  const row = db()
    .prepare("SELECT * FROM checkpoints ORDER BY at DESC LIMIT 1")
    .get() as CheckpointRow | undefined;
  return row ? toCheckpoint(row) : undefined;
}

export function listCheckpoints(limit = 10): CheckpointRecord[] {
  const n = Math.min(Math.max(limit, 1), 50);
  const rows = db()
    .prepare(`SELECT * FROM checkpoints ORDER BY at DESC LIMIT ${n}`)
    .all() as unknown as CheckpointRow[];
  return rows.map(toCheckpoint);
}

export function isHubShared(jobIdValue: string): boolean {
  const job = getJob(jobIdValue);
  return Boolean(job?.hubShare?.sid);
}

export function markHubShared(
  jobIdValue: string,
  info: HubShareInfo,
): HubShareRecord | undefined {
  const conn = db();
  const job = conn.prepare("SELECT * FROM jobs WHERE id = ?").get(jobIdValue) as
    | JobRow
    | undefined;
  if (!job) return undefined;

  conn
    .prepare("UPDATE jobs SET hub_share = ? WHERE id = ?")
    .run(JSON.stringify(info), jobIdValue);

  const rec: HubShareRecord = {
    id: createHash("sha1")
      .update(`${jobIdValue}|${info.sid}|${info.at}`)
      .digest("hex")
      .slice(0, 12),
    at: info.at,
    jobId: jobIdValue,
    platform: job.platform,
    title: job.title,
    externalUrl: job.link,
    sid: info.sid,
    hubUrl: info.hubUrl,
    ...(info.hubId ? { hubId: info.hubId } : {}),
    status: info.status,
  };
  // One row per job/sid pair: re-sharing updates rather than piling up.
  conn
    .prepare("DELETE FROM hub_shares WHERE job_id = ? OR sid = ?")
    .run(jobIdValue, info.sid);
  conn
    .prepare(
      `INSERT INTO hub_shares (id, at, job_id, platform, title, external_url, sid, hub_url, hub_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      rec.id,
      rec.at,
      rec.jobId,
      rec.platform,
      rec.title,
      rec.externalUrl,
      rec.sid,
      rec.hubUrl,
      nullable(rec.hubId),
      rec.status,
    );
  return rec;
}

interface ShareRow {
  id: string;
  at: string;
  job_id: string;
  platform: string;
  title: string;
  external_url: string;
  sid: string;
  hub_url: string;
  hub_id: string | null;
  status: string;
}

function toShare(r: ShareRow): HubShareRecord {
  return {
    id: r.id,
    at: r.at,
    jobId: r.job_id,
    platform: r.platform,
    title: r.title,
    externalUrl: r.external_url,
    sid: r.sid,
    hubUrl: r.hub_url,
    ...(r.hub_id ? { hubId: r.hub_id } : {}),
    status: r.status as HubShareRecord["status"],
  };
}

export function listHubShares(opts?: {
  limit?: number;
  platform?: string;
}): HubShareRecord[] {
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
  const rows = opts?.platform
    ? (db()
        .prepare(
          `SELECT * FROM hub_shares WHERE LOWER(platform) = ? ORDER BY at DESC LIMIT ${limit}`,
        )
        .all(opts.platform.trim().toLowerCase()) as unknown as ShareRow[])
    : (db()
        .prepare(`SELECT * FROM hub_shares ORDER BY at DESC LIMIT ${limit}`)
        .all() as unknown as ShareRow[]);
  return rows.map(toShare);
}

export function listUnsharedJobs(opts?: { limit?: number }): StoredJob[] {
  const limit = Math.min(Math.max(opts?.limit ?? 30, 1), 100);
  const rows = db()
    .prepare(
      `SELECT * FROM jobs WHERE hub_share IS NULL
       ORDER BY COALESCE(fetched_at, seen_at) DESC LIMIT ${limit}`,
    )
    .all() as unknown as JobRow[];
  return rows.map(toJob);
}

/** Unified local history: hub shares + outreach + checkpoints. */
export function listHistory(limit = 40): {
  hubShares: HubShareRecord[];
  outreach: OutreachRecord[];
  checkpoints: CheckpointRecord[];
  counts: { hubShared: number; hubUnshared: number; outreach: number };
} {
  const conn = db();
  const n = Math.min(Math.max(limit, 1), 100);
  const shared = (
    conn
      .prepare("SELECT COUNT(*) AS c FROM jobs WHERE hub_share IS NOT NULL")
      .get() as { c: number }
  ).c;
  const total = (
    conn.prepare("SELECT COUNT(*) AS c FROM jobs").get() as { c: number }
  ).c;
  const outreachCount = (
    conn.prepare("SELECT COUNT(*) AS c FROM outreach").get() as { c: number }
  ).c;
  return {
    hubShares: listHubShares({ limit: n }),
    outreach: listOutreach({ limit: n }),
    checkpoints: listCheckpoints(Math.min(n, 10)),
    counts: {
      hubShared: shared,
      hubUnshared: total - shared,
      outreach: outreachCount,
    },
  };
}

/**
 * Everything the local store knows about one card, in a single lookup.
 *
 * The agent otherwise has to stitch this together from four separate list
 * tools and still cannot see whether a card was already shown in a digest —
 * which is exactly the question that decides "do I act on this or skip it".
 */
export function jobState(idOrUrl: string):
  | {
      found: false;
      id: string;
    }
  | {
      found: true;
      job: StoredJob;
      shownInDigest: boolean;
      shownAt?: string;
      hubShare?: HubShareInfo;
      hubShareRecord?: HubShareRecord;
      draft?: DraftRecord;
      outreach: OutreachRecord[];
      lastOutreachStatus?: OutreachStatus;
    } {
  const job = getJob(idOrUrl);
  if (!job) return { found: false, id: idOrUrl };

  const shown = db()
    .prepare("SELECT at FROM shown_digest WHERE id = ?")
    .get(job.id) as { at: string } | undefined;
  const shareRow = db()
    .prepare("SELECT * FROM hub_shares WHERE job_id = ? ORDER BY at DESC LIMIT 1")
    .get(job.id) as ShareRow | undefined;
  const outreach = listOutreach({ jobId: job.id, limit: 100 });

  return {
    found: true,
    job,
    shownInDigest: Boolean(shown) || Boolean(job.shownInDigest),
    ...(shown ? { shownAt: shown.at } : {}),
    ...(job.hubShare ? { hubShare: job.hubShare } : {}),
    ...(shareRow ? { hubShareRecord: toShare(shareRow) } : {}),
    ...(getLatestDraft(job.id) ? { draft: getLatestDraft(job.id) } : {}),
    outreach,
    ...(outreach[0] ? { lastOutreachStatus: outreach[0].status } : {}),
  };
}

/**
 * Drop stale cards, but never one that carries work: anything shared to the hub,
 * drafted, or referenced by an outreach entry stays regardless of age.
 */
export function pruneJobs(opts?: { days?: number }): {
  removed: number;
  kept: number;
} {
  const days = Math.max(opts?.days ?? Number(process.env.WORKIX_JOB_TTL_DAYS || 30), 1);
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
  const conn = db();
  const res = conn
    .prepare(
      `DELETE FROM jobs
       WHERE COALESCE(fetched_at, seen_at) < ?
         AND hub_share IS NULL
         AND id NOT IN (SELECT job_id FROM drafts)
         AND id NOT IN (SELECT job_id FROM outreach WHERE job_id IS NOT NULL)`,
    )
    .run(cutoff);
  const kept = (
    conn.prepare("SELECT COUNT(*) AS c FROM jobs").get() as { c: number }
  ).c;
  return { removed: Number(res.changes), kept };
}

export function storeStats(): Record<string, number | string> {
  const conn = db();
  const count = (t: string) =>
    (conn.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get() as { c: number }).c;
  return {
    jobs: count("jobs"),
    shown_digest: count("shown_digest"),
    drafts: count("drafts"),
    outreach: count("outreach"),
    checkpoints: count("checkpoints"),
    hub_shares: count("hub_shares"),
    fetch_cache: count("fetch_cache"),
  };
}

export function dataDir(): string {
  db(); // creates the directory and schema on first use
  return resolveDataDir();
}
