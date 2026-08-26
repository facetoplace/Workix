/**
 * Optional Telegram digest fetch (TDLib). Only runs when session ready.
 */
import { loadTgChannels } from "../telegram/channels.js";
import { getAuthState, searchChat } from "../telegram/backend.js";
import { tgCredentialsConfigured } from "../telegram/credentials.js";
import { hasGramjsSession } from "../telegram/gramjs.js";
import { telegramSearchSince } from "../telegram/searchSince.js";
/**
 * Is Telegram set up enough to fold into a full scan? This is a LOCAL-only
 * check — credentials in env, a saved session file, and at least one channel —
 * so it never touches the network. That matters: getAuthState() connects to
 * Telegram (with retries) and can hang for a minute when the account is
 * flood-limited, and a background digest must not stall on it. We decide to
 * *attempt* TG from local signals, then guard the fetch itself with a timeout.
 */
export function telegramActivated() {
    try {
        if (!tgCredentialsConfigured())
            return false;
        if (!hasGramjsSession())
            return false;
        return loadTgChannels().channels.length > 0;
    }
    catch {
        return false;
    }
}
/**
 * One digest run reads at most this many channels — each is a network round-trip,
 * and Telegram answers a long sweep with flood-waits. Raise it with
 * WORKIX_TG_MAX_CHANNELS when the watch list outgrows the default.
 */
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
/**
 * Which channels this run actually reads. Taking them in file order meant a
 * channel appended to the end of a long list was never fetched, however high its
 * priority — so order by priority (stable, so equal priorities keep file order)
 * and leave `community` out: those are discussion chats, not vacancy feeds, and
 * they only add noise to a digest. Search them explicitly with workix_tg_search.
 */
function watchOrder(channels) {
    return channels
        .filter((c) => c.kind !== "community")
        .slice()
        .sort((a, b) => (PRIORITY_RANK[String(a.priority || "")] ?? 1) -
        (PRIORITY_RANK[String(b.priority || "")] ?? 1));
}
/**
 * Sweep recent history of every (non-community) channel with ONE empty search
 * each — the collect-phase Telegram ingest. No keyword filtering here: the raw
 * postings land in the store and searchCorpus ranks them later. Guarded per
 * channel so a slow/flood-limited chat can't wedge the sweep.
 */
export async function sweepTelegramChannels(opts) {
    const auth = await getAuthState();
    if (auth.state !== "ready") {
        return { jobs: [], channels: 0, ok: 0, failed: 0, errors: [`telegram: session ${auth.state}`] };
    }
    const { channels } = loadTgChannels();
    const list = watchOrder(channels);
    const days = Math.min(Math.max(Number(opts?.days) || 30, 1), 120);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const per = Math.min(Math.max(Number(opts?.perChannel) || 40, 1), 50);
    const jobs = [];
    const errors = [];
    let ok = 0;
    let failed = 0;
    const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
    for (const ch of list) {
        try {
            const hits = await withTimeout(searchChat(ch.url, "", per, since), 25_000);
            for (const h of hits) {
                jobs.push({
                    id: h.id,
                    platform: "telegram",
                    kind: h.kind,
                    title: h.title,
                    description: h.description,
                    link: h.link,
                    date: h.date,
                    fetchedAt: new Date().toISOString(),
                });
            }
            ok++;
        }
        catch (e) {
            failed++;
            if (errors.length < 8)
                errors.push(`${ch.id}: ${e?.message || e}`);
        }
    }
    return { jobs, channels: list.length, ok, failed, errors };
}
export async function fetchTelegramJobs(opts) {
    const auth = await getAuthState();
    if (auth.state === "missing_deps") {
        return {
            jobs: [],
            error: "telegram: npm install telegram   # GramJS (ARM64 OK)",
        };
    }
    if (auth.state === "missing_credentials") {
        return {
            jobs: [],
            error: "telegram: set TG_APP_API_ID + TG_APP_API_HASH",
        };
    }
    if (auth.state !== "ready") {
        return {
            jobs: [],
            error: `telegram: session ${auth.state} — npm run tg:login`,
        };
    }
    const { channels } = loadTgChannels();
    if (!channels.length) {
        return { jobs: [], error: "telegram: no channels in telegram-channels.json" };
    }
    const keywords = (opts?.keywords || []).map((k) => String(k).trim()).filter(Boolean);
    const query = keywords.slice(0, 4).join(" ") || "";
    const since = telegramSearchSince().since;
    const per = Math.min(Math.max(Number(opts?.limit) || 8, 1), 15);
    const jobs = [];
    const errors = [];
    for (const ch of watchOrder(channels)) {
        try {
            const hits = await searchChat(ch.url, query, per, since);
            for (const h of hits) {
                jobs.push({
                    id: h.id,
                    platform: "telegram",
                    kind: "gig",
                    title: h.title,
                    description: h.description,
                    link: h.link,
                    date: h.date,
                    fetchedAt: new Date().toISOString(),
                });
            }
        }
        catch (e) {
            errors.push(`${ch.id}: ${e?.message || e}`);
        }
    }
    return {
        jobs,
        error: errors.length ? errors.slice(0, 5).join("; ") : undefined,
    };
}
