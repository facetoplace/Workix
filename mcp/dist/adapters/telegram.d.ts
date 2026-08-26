import type { Job } from "../types.js";
/**
 * Is Telegram set up enough to fold into a full scan? This is a LOCAL-only
 * check — credentials in env, a saved session file, and at least one channel —
 * so it never touches the network. That matters: getAuthState() connects to
 * Telegram (with retries) and can hang for a minute when the account is
 * flood-limited, and a background digest must not stall on it. We decide to
 * *attempt* TG from local signals, then guard the fetch itself with a timeout.
 */
export declare function telegramActivated(): boolean;
/**
 * Sweep recent history of every (non-community) channel with ONE empty search
 * each — the collect-phase Telegram ingest. No keyword filtering here: the raw
 * postings land in the store and searchCorpus ranks them later. Guarded per
 * channel so a slow/flood-limited chat can't wedge the sweep.
 */
export declare function sweepTelegramChannels(opts?: {
    days?: number;
    perChannel?: number;
}): Promise<{
    jobs: Job[];
    channels: number;
    ok: number;
    failed: number;
    errors: string[];
}>;
export declare function fetchTelegramJobs(opts?: {
    keywords?: string[];
    limit?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
