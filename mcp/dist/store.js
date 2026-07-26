import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = process.env.WORKIX_MCP_DATA || join(ROOT, "data");
const STORE_PATH = join(DATA_DIR, "store.json");
function empty() {
    return { jobs: {}, drafts: [], shownDigestIds: [] };
}
function ensure() {
    if (!existsSync(DATA_DIR))
        mkdirSync(DATA_DIR, { recursive: true });
    if (!existsSync(STORE_PATH)) {
        writeFileSync(STORE_PATH, JSON.stringify(empty(), null, 2), "utf8");
    }
}
function load() {
    ensure();
    try {
        return JSON.parse(readFileSync(STORE_PATH, "utf8"));
    }
    catch {
        return empty();
    }
}
function save(data) {
    ensure();
    writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
}
export function jobId(platform, link) {
    return createHash("sha1").update(`${platform}|${link}`).digest("hex").slice(0, 16);
}
export function upsertJobs(jobs) {
    const data = load();
    const out = [];
    const now = new Date().toISOString();
    for (const job of jobs) {
        const existing = data.jobs[job.id];
        const stored = existing
            ? { ...existing, ...job, seenAt: existing.seenAt }
            : { ...job, seenAt: now };
        data.jobs[job.id] = stored;
        out.push(stored);
    }
    save(data);
    return out;
}
export function getJob(idOrUrl) {
    const data = load();
    if (data.jobs[idOrUrl])
        return data.jobs[idOrUrl];
    const byLink = Object.values(data.jobs).find((j) => j.link === idOrUrl || j.link.replace(/\/$/, "") === idOrUrl.replace(/\/$/, ""));
    return byLink;
}
export function listJobs() {
    return Object.values(load().jobs);
}
export function markDigestShown(ids) {
    const data = load();
    const set = new Set(data.shownDigestIds);
    for (const id of ids)
        set.add(id);
    data.shownDigestIds = [...set].slice(-5000);
    for (const id of ids) {
        if (data.jobs[id])
            data.jobs[id].shownInDigest = true;
    }
    save(data);
}
export function wasShownInDigest(id) {
    const data = load();
    return data.shownDigestIds.includes(id) || Boolean(data.jobs[id]?.shownInDigest);
}
export function saveDraft(jobIdValue, text) {
    const data = load();
    const rec = {
        jobId: jobIdValue,
        text,
        createdAt: new Date().toISOString(),
    };
    data.drafts.push(rec);
    data.drafts = data.drafts.slice(-200);
    save(data);
    return rec;
}
export function getLatestDraft(jobIdValue) {
    const data = load();
    return [...data.drafts].reverse().find((d) => d.jobId === jobIdValue);
}
export function dataDir() {
    ensure();
    return DATA_DIR;
}
