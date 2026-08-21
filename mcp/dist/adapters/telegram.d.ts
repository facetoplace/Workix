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
export declare function fetchTelegramJobs(opts?: {
    keywords?: string[];
    limit?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
