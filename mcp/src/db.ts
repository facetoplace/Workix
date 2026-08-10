import { existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Local SQLite store for jobs, drafts, outreach, checkpoints, hub shares and
 * the network fetch cache.
 *
 * Why not the old single `store.json`: every read parsed the whole file, so a
 * 13MB store cost ~126ms per call and `wasShownInDigest()` inside a filter loop
 * turned a digest into a minute of pure JSON parsing. Worse, each MCP session is
 * its own process doing read-modify-write on one file: concurrent sessions lost
 * each other's writes, and a torn write made `load()` fall back to an empty
 * store — silently discarding everything on the next save.
 *
 * `node:sqlite` ships with Node (>=22.5), so this adds no dependency and nothing
 * compiles at install time. WAL plus a busy timeout is what makes several
 * sessions on one machine safe.
 */

// Stability-1 module: the warning is noise on every start, not information.
const emitWarning = process.emitWarning.bind(process);
process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
  const text = typeof warning === "string" ? warning : warning?.message || "";
  if (text.includes("SQLite is an experimental feature")) return;
  return (emitWarning as (...a: unknown[]) => void)(warning, ...rest);
}) as typeof process.emitWarning;

const { DatabaseSync } = await import("node:sqlite");
type Db = InstanceType<typeof DatabaseSync>;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function resolveDataDir(): string {
  const fromEnv = process.env.WORKIX_MCP_DATA?.trim();
  return fromEnv || join(ROOT, "data");
}

let handle: { db: Db; dir: string } | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS jobs (
  id              TEXT PRIMARY KEY,
  platform        TEXT NOT NULL,
  kind            TEXT,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  link            TEXT NOT NULL,
  date            TEXT NOT NULL,
  budget          TEXT,
  raw             TEXT,
  fetched_at      TEXT NOT NULL,
  seen_at         TEXT NOT NULL,
  shown_in_digest INTEGER NOT NULL DEFAULT 0,
  hub_share       TEXT
);
CREATE INDEX IF NOT EXISTS jobs_platform ON jobs(platform);
CREATE INDEX IF NOT EXISTS jobs_date ON jobs(date DESC);
CREATE INDEX IF NOT EXISTS jobs_link ON jobs(link);
CREATE INDEX IF NOT EXISTS jobs_seen ON jobs(seen_at DESC);

CREATE TABLE IF NOT EXISTS shown_digest (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drafts (
  rowid_alias INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id      TEXT NOT NULL,
  text        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS drafts_job ON drafts(job_id, created_at DESC);

CREATE TABLE IF NOT EXISTS outreach (
  id      TEXT PRIMARY KEY,
  at      TEXT NOT NULL,
  status  TEXT NOT NULL,
  channel TEXT NOT NULL,
  contact TEXT NOT NULL,
  text    TEXT NOT NULL,
  project TEXT,
  url     TEXT,
  job_id  TEXT,
  note    TEXT
);
CREATE INDEX IF NOT EXISTS outreach_at ON outreach(at DESC);

CREATE TABLE IF NOT EXISTS checkpoints (
  id       TEXT PRIMARY KEY,
  at       TEXT NOT NULL,
  summary  TEXT NOT NULL,
  next     TEXT,
  surfaces TEXT,
  batch    TEXT,
  blocked  TEXT,
  note     TEXT
);
CREATE INDEX IF NOT EXISTS checkpoints_at ON checkpoints(at DESC);

CREATE TABLE IF NOT EXISTS hub_shares (
  id           TEXT PRIMARY KEY,
  at           TEXT NOT NULL,
  job_id       TEXT NOT NULL,
  platform     TEXT NOT NULL,
  title        TEXT NOT NULL,
  external_url TEXT NOT NULL,
  sid          TEXT NOT NULL,
  hub_url      TEXT NOT NULL,
  hub_id       TEXT,
  status       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS hub_shares_at ON hub_shares(at DESC);
CREATE INDEX IF NOT EXISTS hub_shares_job ON hub_shares(job_id);

CREATE TABLE IF NOT EXISTS fetch_cache (
  key        TEXT PRIMARY KEY,
  source     TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  items      INTEGER NOT NULL DEFAULT 0,
  payload    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS fetch_cache_source ON fetch_cache(source);
CREATE INDEX IF NOT EXISTS fetch_cache_expires ON fetch_cache(expires_at);

CREATE TABLE IF NOT EXISTS meta (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);
`;

export function db(): Db {
  const dir = resolveDataDir();
  if (handle && handle.dir === dir) return handle.db;
  if (handle) handle.db.close();

  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const conn = new DatabaseSync(join(dir, "workix.db"));
  // WAL lets one session read while another writes; the timeout turns a
  // momentary lock into a short wait instead of an immediate SQLITE_BUSY.
  conn.exec("PRAGMA journal_mode = WAL");
  conn.exec("PRAGMA busy_timeout = 5000");
  conn.exec("PRAGMA foreign_keys = ON");
  conn.exec(SCHEMA);

  handle = { db: conn, dir };
  migrateStoreJson(conn, dir);
  return conn;
}

export function metaGet(key: string): string | undefined {
  const row = db().prepare("SELECT v FROM meta WHERE k = ?").get(key) as
    | { v: string }
    | undefined;
  return row?.v;
}

export function metaSet(key: string, value: string): void {
  db()
    .prepare("INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v")
    .run(key, value);
}

/** SQLite takes null, not undefined, and has no boolean type. */
export function nullable(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  return typeof v === "string" ? v : JSON.stringify(v);
}

/**
 * One-time import of the legacy store.json. The file is renamed rather than
 * deleted: if this lands badly, the old data is still one `mv` away.
 */
function migrateStoreJson(conn: Db, dir: string): void {
  const already = conn
    .prepare("SELECT v FROM meta WHERE k = 'migrated_store_json'")
    .get() as { v: string } | undefined;
  if (already) return;

  const legacy = join(dir, "store.json");
  if (!existsSync(legacy)) {
    conn
      .prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('migrated_store_json', ?)")
      .run(new Date().toISOString());
    return;
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(readFileSync(legacy, "utf8")) as Record<string, unknown>;
  } catch {
    // Unreadable legacy file: leave it on disk untouched and start clean rather
    // than silently pretending the migration happened.
    return;
  }

  const jobs = Object.values(
    (data.jobs as Record<string, Record<string, unknown>>) || {},
  );
  const insJob = conn.prepare(
    `INSERT OR REPLACE INTO jobs
     (id, platform, kind, title, description, link, date, budget, raw, fetched_at, seen_at, shown_in_digest, hub_share)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insShown = conn.prepare(
    "INSERT OR IGNORE INTO shown_digest (id, at) VALUES (?, ?)",
  );
  const insDraft = conn.prepare(
    "INSERT INTO drafts (job_id, text, created_at) VALUES (?, ?, ?)",
  );
  const insOutreach = conn.prepare(
    `INSERT OR REPLACE INTO outreach (id, at, status, channel, contact, text, project, url, job_id, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insCheckpoint = conn.prepare(
    `INSERT OR REPLACE INTO checkpoints (id, at, summary, next, surfaces, batch, blocked, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insShare = conn.prepare(
    `INSERT OR REPLACE INTO hub_shares (id, at, job_id, platform, title, external_url, sid, hub_url, hub_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const now = new Date().toISOString();
  conn.exec("BEGIN");
  try {
    for (const j of jobs) {
      if (!j?.id || !j?.title || !j?.link) continue;
      insJob.run(
        String(j.id),
        String(j.platform || "unknown"),
        nullable(j.kind),
        String(j.title),
        String(j.description || ""),
        String(j.link),
        String(j.date || now),
        nullable(j.budget),
        j.raw === undefined ? null : JSON.stringify(j.raw),
        String(j.fetchedAt || now),
        String(j.seenAt || now),
        j.shownInDigest ? 1 : 0,
        j.hubShare ? JSON.stringify(j.hubShare) : null,
      );
    }
    for (const id of (data.shownDigestIds as string[]) || []) {
      insShown.run(String(id), now);
    }
    for (const d of (data.drafts as Array<Record<string, unknown>>) || []) {
      if (!d?.jobId) continue;
      insDraft.run(String(d.jobId), String(d.text || ""), String(d.createdAt || now));
    }
    for (const o of (data.outreach as Array<Record<string, unknown>>) || []) {
      if (!o?.id) continue;
      insOutreach.run(
        String(o.id),
        String(o.at || now),
        String(o.status || "draft"),
        String(o.channel || ""),
        String(o.contact || ""),
        String(o.text || ""),
        nullable(o.project),
        nullable(o.url),
        nullable(o.jobId),
        nullable(o.note),
      );
    }
    for (const c of (data.checkpoints as Array<Record<string, unknown>>) || []) {
      if (!c?.id) continue;
      insCheckpoint.run(
        String(c.id),
        String(c.at || now),
        String(c.summary || ""),
        nullable(c.next),
        c.surfaces ? JSON.stringify(c.surfaces) : null,
        nullable(c.batch),
        c.blocked ? JSON.stringify(c.blocked) : null,
        nullable(c.note),
      );
    }
    for (const h of (data.hubShares as Array<Record<string, unknown>>) || []) {
      if (!h?.id) continue;
      insShare.run(
        String(h.id),
        String(h.at || now),
        String(h.jobId || ""),
        String(h.platform || ""),
        String(h.title || ""),
        String(h.externalUrl || ""),
        String(h.sid || ""),
        String(h.hubUrl || ""),
        nullable(h.hubId),
        String(h.status || "created"),
      );
    }
    conn
      .prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('migrated_store_json', ?)")
      .run(now);
    conn.exec("COMMIT");
  } catch (e) {
    conn.exec("ROLLBACK");
    throw e;
  }

  try {
    renameSync(legacy, `${legacy}.migrated`);
  } catch {
    // Keeping the original in place is harmless — the meta flag stops a re-import.
  }
  if (process.env.WORKIX_MCP_DEBUG) {
    console.error(`[workix] migrated ${jobs.length} jobs from store.json → workix.db`);
  }
}
