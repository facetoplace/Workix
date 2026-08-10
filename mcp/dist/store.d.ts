import type { CheckpointRecord, DraftRecord, HubShareInfo, HubShareRecord, Job, OutreachRecord, OutreachStatus, StoredJob } from "./types.js";
export declare function jobId(platform: string, link: string): string;
export declare function upsertJobs(jobs: Job[]): StoredJob[];
export declare function getJob(idOrUrl: string): StoredJob | undefined;
export declare function listJobs(): StoredJob[];
export declare function markDigestShown(ids: string[]): void;
export declare function wasShownInDigest(id: string): boolean;
export declare function saveDraft(jobIdValue: string, text: string): DraftRecord;
export declare function getLatestDraft(jobIdValue: string): DraftRecord | undefined;
export declare function logOutreach(input: {
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
}): OutreachRecord;
/**
 * Drop outreach rows by id. Used when an application is deleted on the hub, so
 * the local mirror does not keep claiming the job was answered.
 * Returns how many rows were actually removed.
 */
export declare function deleteOutreach(ids: string[]): number;
export declare function listOutreach(opts?: {
    status?: OutreachStatus;
    contact?: string;
    channel?: string;
    jobId?: string;
    limit?: number;
}): OutreachRecord[];
/** Normalize a link so the same posting matches across trackers/mirrors. */
export declare function normalizeLink(url?: string): string | undefined;
/**
 * Every job already touched in any way — url or job_id, any status.
 *
 * The digest subtracts this so cards the user already wrote to never resurface.
 * Unbounded on purpose: listOutreach caps at 100 rows, which is a UI limit, not
 * a dedupe one.
 */
export declare function contactedKeys(): Set<string>;
export declare function setCheckpoint(input: {
    summary: string;
    next?: string;
    surfaces?: string[];
    batch?: string;
    blocked?: string[];
    note?: string;
    at?: string;
    id?: string;
}): CheckpointRecord;
export declare function getLatestCheckpoint(): CheckpointRecord | undefined;
export declare function listCheckpoints(limit?: number): CheckpointRecord[];
export declare function isHubShared(jobIdValue: string): boolean;
export declare function markHubShared(jobIdValue: string, info: HubShareInfo): HubShareRecord | undefined;
export declare function listHubShares(opts?: {
    limit?: number;
    platform?: string;
}): HubShareRecord[];
export declare function listUnsharedJobs(opts?: {
    limit?: number;
}): StoredJob[];
/** Unified local history: hub shares + outreach + checkpoints. */
export declare function listHistory(limit?: number): {
    hubShares: HubShareRecord[];
    outreach: OutreachRecord[];
    checkpoints: CheckpointRecord[];
    counts: {
        hubShared: number;
        hubUnshared: number;
        outreach: number;
    };
};
/**
 * Everything the local store knows about one card, in a single lookup.
 *
 * The agent otherwise has to stitch this together from four separate list
 * tools and still cannot see whether a card was already shown in a digest —
 * which is exactly the question that decides "do I act on this or skip it".
 */
export declare function jobState(idOrUrl: string): {
    found: false;
    id: string;
} | {
    found: true;
    job: StoredJob;
    shownInDigest: boolean;
    shownAt?: string;
    hubShare?: HubShareInfo;
    hubShareRecord?: HubShareRecord;
    draft?: DraftRecord;
    outreach: OutreachRecord[];
    lastOutreachStatus?: OutreachStatus;
};
/**
 * Drop stale cards, but never one that carries work: anything shared to the hub,
 * drafted, or referenced by an outreach entry stays regardless of age.
 */
export declare function pruneJobs(opts?: {
    days?: number;
}): {
    removed: number;
    kept: number;
};
export declare function storeStats(): Record<string, number | string>;
export declare function dataDir(): string;
