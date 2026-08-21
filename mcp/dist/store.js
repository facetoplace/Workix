import { createHash } from "node:crypto";
import { db, nullable, resolveDataDir } from "./db.js";
function parseJson(s) {
    if (!s)
        return undefined;
    try {
        return JSON.parse(s);
    }
    catch {
        return undefined;
    }
}
function toJob(r) {
    const hubShare = parseJson(r.hub_share);
    return {
        id: r.id,
        platform: r.platform,
        ...(r.kind ? { kind: r.kind } : {}),
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
export function jobId(platform, link) {
    return createHash("sha1").update(`${platform}|${link}`).digest("hex").slice(0, 16);
}
export function upsertJobs(jobs) {
    const conn = db();
    const now = new Date().toISOString();
    const out = [];
    const get = conn.prepare("SELECT * FROM jobs WHERE id = ?");
    // Refreshing a card must not lose the work attached to it: seen_at marks when
    // we first saw it, and hub_share / shown_in_digest record what we already did.
    const ins = conn.prepare(`INSERT INTO jobs
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
       fetched_at  = excluded.fetched_at`);
    conn.exec("BEGIN");
    try {
        for (const job of jobs) {
            const existing = get.get(job.id);
            ins.run(job.id, String(job.platform), nullable(job.kind), job.title, job.description || "", job.link, job.date, nullable(job.budget), job.raw === undefined ? null : JSON.stringify(job.raw), job.fetchedAt || now, existing?.seen_at || now, existing?.shown_in_digest || 0, existing?.hub_share ?? null);
            out.push({
                ...job,
                seenAt: existing?.seen_at || now,
                ...(existing?.shown_in_digest ? { shownInDigest: true } : {}),
                ...(existing?.hub_share
                    ? { hubShare: parseJson(existing.hub_share) }
                    : {}),
            });
        }
        conn.exec("COMMIT");
    }
    catch (e) {
        conn.exec("ROLLBACK");
        throw e;
    }
    return out;
}
export function getJob(idOrUrl) {
    const conn = db();
    const byId = conn.prepare("SELECT * FROM jobs WHERE id = ?").get(idOrUrl);
    if (byId)
        return toJob(byId);
    const trimmed = idOrUrl.replace(/\/$/, "");
    const byLink = conn
        .prepare("SELECT * FROM jobs WHERE link = ? OR link = ? LIMIT 1")
        .get(idOrUrl, trimmed);
    if (byLink)
        return toJob(byLink);
    const withSlash = conn
        .prepare("SELECT * FROM jobs WHERE link = ? LIMIT 1")
        .get(`${trimmed}/`);
    return withSlash ? toJob(withSlash) : undefined;
}
export function listJobs() {
    const rows = db()
        .prepare("SELECT * FROM jobs ORDER BY date DESC")
        .all();
    return rows.map(toJob);
}
export function markDigestShown(ids) {
    if (!ids.length)
        return;
    const conn = db();
    const now = new Date().toISOString();
    const insShown = conn.prepare("INSERT INTO shown_digest (id, at) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET at = excluded.at");
    const mark = conn.prepare("UPDATE jobs SET shown_in_digest = 1 WHERE id = ?");
    conn.exec("BEGIN");
    try {
        for (const id of ids) {
            insShown.run(id, now);
            mark.run(id);
        }
        conn.exec("COMMIT");
    }
    catch (e) {
        conn.exec("ROLLBACK");
        throw e;
    }
    // Keep the seen-set bounded, oldest first.
    conn.exec("DELETE FROM shown_digest WHERE id NOT IN (SELECT id FROM shown_digest ORDER BY at DESC LIMIT 20000)");
}
export function wasShownInDigest(id) {
    const row = db()
        .prepare(`SELECT 1 AS hit FROM shown_digest WHERE id = ?
       UNION ALL
       SELECT 1 FROM jobs WHERE id = ? AND shown_in_digest = 1
       LIMIT 1`)
        .get(id, id);
    return Boolean(row);
}
export function saveDraft(jobIdValue, text) {
    const conn = db();
    const rec = {
        jobId: jobIdValue,
        text,
        createdAt: new Date().toISOString(),
    };
    conn
        .prepare("INSERT INTO drafts (job_id, text, created_at) VALUES (?, ?, ?)")
        .run(rec.jobId, rec.text, rec.createdAt);
    conn.exec("DELETE FROM drafts WHERE rowid_alias NOT IN (SELECT rowid_alias FROM drafts ORDER BY created_at DESC LIMIT 500)");
    return rec;
}
export function getLatestDraft(jobIdValue) {
    const row = db()
        .prepare("SELECT job_id, text, created_at FROM drafts WHERE job_id = ? ORDER BY created_at DESC LIMIT 1")
        .get(jobIdValue);
    return row
        ? { jobId: row.job_id, text: row.text, createdAt: row.created_at }
        : undefined;
}
export function logOutreach(input) {
    const at = input.at?.trim() || new Date().toISOString();
    const contact = input.contact.trim();
    const channel = input.channel.trim().toLowerCase();
    const id = input.id?.trim() ||
        createHash("sha1")
            .update(`${channel}|${contact}|${input.url || ""}|${at}|${input.text.slice(0, 80)}`)
            .digest("hex")
            .slice(0, 12);
    const rec = {
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
        .prepare(`INSERT INTO outreach (id, at, status, channel, contact, text, project, url, job_id, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         at = excluded.at, status = excluded.status, channel = excluded.channel,
         contact = excluded.contact, text = excluded.text, project = excluded.project,
         url = excluded.url, job_id = excluded.job_id, note = excluded.note`)
        .run(rec.id, rec.at, rec.status, rec.channel, rec.contact, rec.text, nullable(rec.project), nullable(rec.url), nullable(rec.jobId), nullable(rec.note));
    return rec;
}
function toOutreach(r) {
    return {
        id: r.id,
        at: r.at,
        status: r.status,
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
export function deleteOutreach(ids) {
    const clean = ids.map((i) => i.trim()).filter(Boolean);
    if (!clean.length)
        return 0;
    const stmt = db().prepare("DELETE FROM outreach WHERE id = ?");
    let removed = 0;
    for (const id of clean) {
        removed += stmt.run(id).changes;
    }
    return removed;
}
export function listOutreach(opts) {
    const where = [];
    const params = [];
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
    const sql = `SELECT * FROM outreach ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY at DESC LIMIT ${limit}`;
    return db().prepare(sql).all(...params).map(toOutreach);
}
/**
 * Every outreach row, unpaginated — for importers that have to reconcile the
 * whole log (hh negotiations backfill) rather than show a page of it.
 * listOutreach caps at 100 on purpose: that cap is a UI limit, not a data one.
 */
export function listAllOutreach() {
    const rows = db()
        .prepare("SELECT * FROM outreach ORDER BY at DESC")
        .all();
    return rows.map(toOutreach);
}
/** Normalize a link so the same posting matches across trackers/mirrors. */
export function normalizeLink(url) {
    if (!url)
        return undefined;
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
    }
    catch {
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
export function contactedKeys() {
    const rows = db()
        .prepare("SELECT url, job_id, contact FROM outreach")
        .all();
    const keys = new Set();
    for (const r of rows) {
        const link = normalizeLink(r.url || undefined);
        if (link)
            keys.add(link);
        if (r.job_id)
            keys.add(r.job_id.trim());
    }
    return keys;
}
function toCheckpoint(r) {
    const surfaces = parseJson(r.surfaces);
    const blocked = parseJson(r.blocked);
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
export function setCheckpoint(input) {
    const at = input.at?.trim() || new Date().toISOString();
    const summary = input.summary.trim();
    const id = input.id?.trim() ||
        createHash("sha1").update(`${at}|${summary}`).digest("hex").slice(0, 12);
    const surfaces = input.surfaces?.map((s) => s.trim()).filter(Boolean) || [];
    const blocked = input.blocked?.map((s) => s.trim()).filter(Boolean) || [];
    const rec = {
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
        .prepare(`INSERT INTO checkpoints (id, at, summary, next, surfaces, batch, blocked, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         at = excluded.at, summary = excluded.summary, next = excluded.next,
         surfaces = excluded.surfaces, batch = excluded.batch,
         blocked = excluded.blocked, note = excluded.note`)
        .run(rec.id, rec.at, rec.summary, nullable(rec.next), surfaces.length ? JSON.stringify(surfaces) : null, nullable(rec.batch), blocked.length ? JSON.stringify(blocked) : null, nullable(rec.note));
    conn.exec("DELETE FROM checkpoints WHERE id NOT IN (SELECT id FROM checkpoints ORDER BY at DESC LIMIT 200)");
    return rec;
}
export function getLatestCheckpoint() {
    const row = db()
        .prepare("SELECT * FROM checkpoints ORDER BY at DESC LIMIT 1")
        .get();
    return row ? toCheckpoint(row) : undefined;
}
export function listCheckpoints(limit = 10) {
    const n = Math.min(Math.max(limit, 1), 50);
    const rows = db()
        .prepare(`SELECT * FROM checkpoints ORDER BY at DESC LIMIT ${n}`)
        .all();
    return rows.map(toCheckpoint);
}
export function isHubShared(jobIdValue) {
    const job = getJob(jobIdValue);
    return Boolean(job?.hubShare?.sid);
}
export function markHubShared(jobIdValue, info) {
    const conn = db();
    const job = conn.prepare("SELECT * FROM jobs WHERE id = ?").get(jobIdValue);
    if (!job)
        return undefined;
    conn
        .prepare("UPDATE jobs SET hub_share = ? WHERE id = ?")
        .run(JSON.stringify(info), jobIdValue);
    const rec = {
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
        .prepare(`INSERT INTO hub_shares (id, at, job_id, platform, title, external_url, sid, hub_url, hub_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(rec.id, rec.at, rec.jobId, rec.platform, rec.title, rec.externalUrl, rec.sid, rec.hubUrl, nullable(rec.hubId), rec.status);
    return rec;
}
function toShare(r) {
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
        status: r.status,
    };
}
export function listHubShares(opts) {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
    const rows = opts?.platform
        ? db()
            .prepare(`SELECT * FROM hub_shares WHERE LOWER(platform) = ? ORDER BY at DESC LIMIT ${limit}`)
            .all(opts.platform.trim().toLowerCase())
        : db()
            .prepare(`SELECT * FROM hub_shares ORDER BY at DESC LIMIT ${limit}`)
            .all();
    return rows.map(toShare);
}
export function listUnsharedJobs(opts) {
    const limit = Math.min(Math.max(opts?.limit ?? 30, 1), 100);
    const rows = db()
        .prepare(`SELECT * FROM jobs WHERE hub_share IS NULL
       ORDER BY COALESCE(fetched_at, seen_at) DESC LIMIT ${limit}`)
        .all();
    return rows.map(toJob);
}
/** Unified local history: hub shares + outreach + checkpoints. */
export function listHistory(limit = 40) {
    const conn = db();
    const n = Math.min(Math.max(limit, 1), 100);
    const shared = conn
        .prepare("SELECT COUNT(*) AS c FROM jobs WHERE hub_share IS NOT NULL")
        .get().c;
    const total = conn.prepare("SELECT COUNT(*) AS c FROM jobs").get().c;
    const outreachCount = conn.prepare("SELECT COUNT(*) AS c FROM outreach").get().c;
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
export function jobState(idOrUrl) {
    const job = getJob(idOrUrl);
    if (!job)
        return { found: false, id: idOrUrl };
    const shown = db()
        .prepare("SELECT at FROM shown_digest WHERE id = ?")
        .get(job.id);
    const shareRow = db()
        .prepare("SELECT * FROM hub_shares WHERE job_id = ? ORDER BY at DESC LIMIT 1")
        .get(job.id);
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
export function pruneJobs(opts) {
    const days = Math.max(opts?.days ?? Number(process.env.WORKIX_JOB_TTL_DAYS || 30), 1);
    const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
    const conn = db();
    const res = conn
        .prepare(`DELETE FROM jobs
       WHERE COALESCE(fetched_at, seen_at) < ?
         AND hub_share IS NULL
         AND id NOT IN (SELECT job_id FROM drafts)
         AND id NOT IN (SELECT job_id FROM outreach WHERE job_id IS NOT NULL)`)
        .run(cutoff);
    const kept = conn.prepare("SELECT COUNT(*) AS c FROM jobs").get().c;
    return { removed: Number(res.changes), kept };
}
export function storeStats() {
    const conn = db();
    const count = (t) => conn.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c;
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
export function dataDir() {
    db(); // creates the directory and schema on first use
    return resolveDataDir();
}
