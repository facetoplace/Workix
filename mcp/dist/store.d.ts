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
export declare function listOutreach(opts?: {
    status?: OutreachStatus;
    contact?: string;
    channel?: string;
    limit?: number;
}): OutreachRecord[];
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
export declare function dataDir(): string;
