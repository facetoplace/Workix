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
