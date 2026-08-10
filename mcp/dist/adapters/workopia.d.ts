import type { Job } from "../types.js";
/**
 * The env var wins when set — it is the escape hatch. Otherwise use the stored
 * grant, refreshing a minute before expiry so a long digest does not die
 * halfway through.
 */
export declare function workopiaToken(): Promise<string | undefined>;
/** Cheap sync check for `configured()` — does not touch the network. */
export declare function workopiaConfigured(): boolean;
/**
 * Full DCR + PKCE login, driven from the terminal by scripts/workopia-login.mjs.
 * Registers a fresh public client, waits on a loopback redirect for the code,
 * and exchanges it. Nothing is stored until the exchange succeeds.
 */
export declare function workopiaLogin(): Promise<{
    ok: boolean;
    authorizeUrl?: string;
    error?: string;
}>;
/**
 * Where to search. Explicit argument wins, then the env override, then the
 * operator's own profile — a job seeker has already written down where they
 * are, and making them repeat it in a second place is how the board ends up
 * silently disabled.
 *
 * "Remote"/"Worldwide" are passed through as-is: Workopia documents no
 * wildcard, and `*` is a guess, so we send the words a human would type and
 * let the board answer. Verify against a live token before relying on it.
 */
export declare function resolveCity(explicit?: string): string | undefined;
export declare function cityFromProfile(): string | undefined;
export declare function fetchWorkopiaJobs(opts?: {
    keywords?: string[];
    limit?: number;
    city?: string;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
