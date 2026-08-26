/**
 * Optional Telegram tools (GramJS on ARM64 / TDLib where native works).
 */
import { upsertJobs, logOutreach, listJobs, listOutreach } from "../store.js";
import { gramjsSendMessage } from "../telegram/gramjs.js";
import { estimateScan, recordScan, msToHuman } from "../telegram/scanTiming.js";
import { loadTgChannels, parseTgUsername } from "../telegram/channels.js";
import { telegramSearchSince } from "../telegram/searchSince.js";
import { listTelegramSourceQuality, recordTelegramSourceQuality } from "../telegram/sourceQuality.js";
import { setCheckpoint } from "../store.js";
import { getAuthState, probeTelegramDeps, searchChat, tgCheckCode, tgCheckPassword, tgCredentialsConfigured, tgSetPhone, } from "../telegram/backend.js";
function hitToJob(h) {
    return {
        id: h.id,
        platform: "telegram",
        kind: h.kind,
        title: h.title,
        description: h.description,
        link: h.link,
        date: h.date,
        fetchedAt: new Date().toISOString(),
    };
}
export async function runTgStatus() {
    const deps = await probeTelegramDeps();
    const channels = loadTgChannels();
    const auth = await getAuthState();
    return {
        module: "telegram",
        optional: true,
        backend: deps.backend,
        reason: deps.reason,
        deps: {
            ok: deps.ok,
            gramjs: deps.gramjs,
            tdl: deps.tdl,
            prebuilt_tdlib: deps.prebuilt,
            install: deps.install,
            error: deps.error,
        },
        credentials: {
            configured: tgCredentialsConfigured(),
            need: ["TG_APP_API_ID|TELEGRAM_API_ID", "TG_APP_API_HASH|TELEGRAM_API_HASH"],
            apps: "https://my.telegram.org/apps",
        },
        auth: {
            state: auth.state,
            raw: auth.raw,
            hint: auth.hint,
        },
        channels: {
            path: channels.path,
            count: channels.channels.length,
            sample: channels.channels.slice(0, 8).map((c) => ({
                id: c.id,
                title: c.title,
                url: c.url,
                username: parseTgUsername(c.url),
            })),
        },
        next: auth.state === "missing_deps"
            ? deps.install
            : auth.state === "missing_credentials"
                ? "Set TG_APP_API_ID + TG_APP_API_HASH in .env"
                : auth.state === "wait_phone" || auth.state === "wait_code"
                    ? "cd mcp && npm run tg:login   # phone/code in terminal"
                    : auth.state === "ready"
                        ? "workix_tg_search"
                        : auth.hint,
    };
}
export async function runTgAuth(args) {
    const before = await getAuthState();
    if (before.backend === "gramjs") {
        return {
            ok: false,
            error: "GramJS login is terminal-only (safer). Run: cd mcp && npm run tg:login",
            auth: before,
        };
    }
    if (before.state === "missing_deps" || before.state === "missing_credentials") {
        return { ok: false, ...before };
    }
    try {
        if (args.phone)
            await tgSetPhone(args.phone);
        else if (args.code)
            await tgCheckCode(args.code);
        else if (args.password != null)
            await tgCheckPassword(args.password);
        else {
            return { ok: false, error: "Pass phone, code, or password", auth: before };
        }
    }
    catch (e) {
        return {
            ok: false,
            error: e?.message || String(e),
            auth: await getAuthState(),
        };
    }
    const after = await getAuthState();
    return {
        ok: after.state === "ready",
        auth: after,
        next: after.hint || (after.state === "ready" ? "workix_tg_search" : undefined),
    };
}
/** Chats searched per call unless the caller raises it — see runTgSearch. */
const MAX_CHATS_CEILING = 500;
/** Separate searches per call. Each term is a full pass over every chat. */
const MAX_TERMS = 12;
/**
 * Telegram's message search is a substring match — it has no boolean grammar,
 * so `"flutter OR android OR ios"` is looked up as that literal string and
 * answers 0 for every chat. The rest of the project speaks OR (UPWORK_SEARCH,
 * presets → digest), so an agent naturally sends the same syntax here and reads
 * the empty answer as "Telegram is quiet today" — a silent false negative.
 *
 * Split it instead: each term is its own search, results merge and dedupe by
 * message id. Commas are treated the same way, being the other list syntax
 * people type.
 */
export function parseTgQueryTerms(query) {
    const raw = String(query || "").trim();
    if (!raw)
        return [];
    const parts = raw
        .split(/\s+OR\s+|\s*\|\|\s*|\s*,\s*/i)
        .map((t) => t.trim().replace(/^["']|["']$/g, "").trim())
        .filter(Boolean);
    const seen = new Set();
    const out = [];
    for (const p of parts) {
        const k = p.toLowerCase();
        if (seen.has(k))
            continue;
        seen.add(k);
        out.push(p);
    }
    return out;
}
export async function runTgSearch(args) {
    const auth = await getAuthState();
    if (auth.state !== "ready") {
        return {
            ok: false,
            error: "Telegram session not ready",
            auth,
            hint: auth.hint || "npm run tg:login",
        };
    }
    const listed = loadTgChannels();
    const chats = args.chats?.length
        ? args.chats
        : listed.channels.map((c) => c.url).filter(Boolean);
    if (!chats.length) {
        return {
            ok: false,
            error: "No chats. Pass chats:[\"https://t.me/siliconpravdachat\"] or copy telegram-channels.example.json → telegram-channels.json",
        };
    }
    // DUMP mode: one empty-query sweep per chat into the local store, then match
    // the whole TG corpus locally. Window is explicit (args.since or last `days`),
    // never the checkpoint — so a just-written checkpoint can't shrink it to zero.
    if (args.mode === "dump") {
        return runTgDump(args, chats, auth.backend);
    }
    const query = String(args.query || "").trim();
    const sinceInfo = telegramSearchSince(args.since);
    const parsedTerms = parseTgQueryTerms(query);
    const termsDropped = Math.max(parsedTerms.length - MAX_TERMS, 0);
    // No query at all = recent history, which is one pass with an empty search.
    const terms = parsedTerms.length ? parsedTerms.slice(0, MAX_TERMS) : [""];
    const perChat = Math.min(Math.max(Number(args.limit) || 10, 1), 30);
    const quality = listTelegramSourceQuality();
    const qualityBySource = new Map(quality.map((q) => [q.source.replace(/^telegram:/, ""), q]));
    const firstSearch = quality.length === 0;
    const orderedChats = chats.slice().sort((a, b) => {
        const qa = qualityBySource.get(a) || qualityBySource.get(parseTgUsername(a));
        const qb = qualityBySource.get(b) || qualityBySource.get(parseTgUsername(b));
        if (!qa && !qb)
            return 0;
        if (!qa)
            return -1;
        if (!qb)
            return 1;
        return String(qa.last_at || "").localeCompare(String(qb.last_at || "")) || qb.score - qa.score;
    });
    const maxChats = args.max_chats == null
        ? chats.length
        : Math.min(Math.max(Number(args.max_chats) || chats.length, 1), MAX_CHATS_CEILING);
    const chatsToSearch = orderedChats.slice(0, maxChats);
    const results = [];
    const allHits = [];
    const perTerm = {};
    // Units of work = chats × terms. Estimate up front from past runs so the
    // caller can tell the user how long to wait, then record the real time so the
    // next estimate self-corrects as the session speeds up or throttles.
    const units = chatsToSearch.length * terms.length;
    const eta = estimateScan({ kind: "tg_search", units });
    const startedAt = Date.now();
    for (const chat of chatsToSearch) {
        const byId = new Map();
        const errors = [];
        const matchedTerms = [];
        for (const term of terms) {
            try {
                const hits = await searchChat(chat, term, perChat, sinceInfo.since);
                if (hits.length)
                    matchedTerms.push(term || "(recent)");
                perTerm[term || "(recent)"] =
                    (perTerm[term || "(recent)"] || 0) + hits.length;
                for (const h of hits) {
                    // One message can answer several terms — keep it once.
                    if (!byId.has(h.id))
                        byId.set(h.id, h);
                }
            }
            catch (e) {
                const msg = e?.message || String(e);
                if (!errors.includes(msg))
                    errors.push(msg);
            }
        }
        const hits = [...byId.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
        results.push({ chat, hits, errors, matchedTerms });
        allHits.push(...hits);
        recordTelegramSourceQuality({ source: `telegram:${chat}`, hits: hits.length, errors: errors.length, query });
    }
    if (args.save !== false && allHits.length) {
        upsertJobs(allHits.map(hitToJob));
    }
    const elapsedMs = Date.now() - startedAt;
    recordScan({ kind: "tg_search", units, ms: elapsedMs });
    const failedChats = results.filter((r) => r.errors.length && !r.hits.length);
    const qualityAfter = listTelegramSourceQuality();
    const checkpoint = setCheckpoint({
        summary: `Telegram search: ${allHits.length} hits across ${results.length}/${chats.length} channels; rotation=${firstSearch ? "initial_full_watchlist" : "oldest_first"}.`,
        next: chats.length > chatsToSearch.length ? `Continue Telegram rotation with ${chats.length - chatsToSearch.length} channels.` : "Use source quality and rotate Telegram channels on the next search.",
        surfaces: ["telegram", ...chatsToSearch.map((chat) => `telegram:${chat}`)],
        batch: `tg-${new Date().toISOString().slice(0, 10)}`,
        note: JSON.stringify({ since: sinceInfo.since, since_source: sinceInfo.source, source_quality: qualityAfter }),
    });
    return {
        ok: true,
        backend: auth.backend,
        query: query || null,
        since: sinceInfo.since,
        since_source: sinceInfo.source,
        // How long it took, and what we'd predicted — so the user knows the wait and
        // the estimate improves each run. estimated_* is from history before the run.
        timing: {
            ms: elapsedMs,
            human: msToHuman(elapsedMs),
            units,
            ms_per_unit: Math.round(elapsedMs / Math.max(1, units)),
            estimated_ms: eta.estimated_ms,
            estimated_human: eta.estimated_human,
            estimate_from_history: eta.from_history,
            estimate_samples: eta.samples,
        },
        // Telegram search has no OR — these are what was actually looked up, so a
        // zero here means "nothing matched", not "the query was unusable".
        terms: terms.map((t) => t || "(recent history)"),
        terms_searched: terms.length,
        ...(termsDropped
            ? {
                terms_dropped: termsDropped,
                terms_note: `Only the first ${MAX_TERMS} terms were searched (each term is a full pass over every chat).`,
            }
            : {}),
        hits_per_term: perTerm,
        total: allHits.length,
        chats_searched: results.length,
        chats_limit: args.max_chats == null ? null : maxChats,
        rotation: {
            mode: firstSearch ? "initial_full_watchlist" : "oldest_last_searched_first",
            explicit_limit: args.max_chats != null,
            quality_persisted: true,
            checkpoint_id: checkpoint.id,
        },
        // The watch list is usually longer than one call walks — say so, instead of
        // letting `chats_searched: 20` read like the whole list was covered.
        chats_available: chats.length,
        ...(chats.length > chatsToSearch.length
            ? {
                chats_skipped: chats.length - chatsToSearch.length,
                chats_note: "Raise max_chats (or pass chats:[…]) to cover the rest of telegram-channels.json.",
            }
            : {}),
        ...(failedChats.length ? { chats_failed: failedChats.length } : {}),
        source_quality: qualityAfter,
        results: results.map((r) => ({
            chat: r.chat,
            error: r.errors.length ? r.errors.join("; ") : undefined,
            count: r.hits.length,
            matched_terms: r.matchedTerms,
            messages: r.hits.map((h) => ({
                id: h.id,
                title: h.title,
                link: h.link,
                date: h.date,
                snippet: h.description.slice(0, 280),
            })),
        })),
        note: "Hits saved locally. No spam in chats.",
    };
}
/** Candidate self-adverts, not vacancies — dropped from dump matches. */
const TG_RESUME_RE = /#резюме|#resume|#ищу\b|ищу работу|ищу проект|рассмотрю предложени|открыт к предложени|обо мне[:\s]|мои навыки|мой стек/i;
/**
 * Generic words that are NOT a company/product name — never a match anchor.
 * Company/product names in this domain are almost always latin non-dictionary
 * tokens (grosssoft, smartbrainio, workayte, upgraide…), so name-matching is
 * latin-anchored and these common tech/HR words are stopped to avoid false
 * "already applied" hits.
 */
const APPLIED_STOP = new Set([
    "flutter", "react", "native", "mobile", "android", "swift", "kotlin", "dart",
    "node", "nodejs", "python", "backend", "frontend", "fullstack", "developer",
    "engineer", "senior", "middle", "junior", "lead", "techlead", "remote",
    "vacancy", "vacancies", "startup", "fulltime", "parttime", "part", "time",
    "unity", "golang", "typescript", "javascript", "reactnative", "rust", "solidity",
    "blockchain", "devops", "sre", "kubernetes", "docker", "aqa", "hiring", "job",
    "jobs", "work", "team", "bank", "crypto", "web3", "llm", "aiengineer", "fintech",
    "founding", "staff", "platform", "software", "programmer", "middleplus",
]);
const applyNorm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9а-яё]+/gi, " ").replace(/\s+/g, " ").trim();
/** @handles from a contact/project string — always trustworthy anchors. */
function handleKeys(raw) {
    const out = [];
    for (const m of String(raw || "").matchAll(/@([a-z0-9_]{4,})/gi))
        out.push(m[1].toLowerCase());
    return out;
}
/** Candidate name words: latin (>=4) + ALLCAPS acronyms (>=3, VOX/IMS). Kept
 * only if rare in the corpus (a real company/product name appears in a handful
 * of posts; role words like "full"/"senior" appear in hundreds). */
function wordKeys(raw) {
    const out = [];
    for (const tok of String(raw || "").split(/[^A-Za-zА-Яа-яЁё0-9]+/)) {
        if (/^[A-Z0-9]{3,}$/.test(tok))
            out.push(tok.toLowerCase());
        const lw = tok.toLowerCase();
        if (/^[a-z][a-z0-9]{3,}$/.test(lw) && !APPLIED_STOP.has(lw))
            out.push(lw);
    }
    return out;
}
/**
 * Index of what we've already reached out to. Exact urls always count. Name
 * anchors: @handles always; other words only when their corpus document
 * frequency is low (rare token ⇒ likely a name, not a generic role word).
 */
function buildAppliedIndex(corpus) {
    const rows = listOutreach({ limit: 100 });
    const urls = new Set();
    const handles = new Set();
    const wordCandidates = new Set();
    for (const r of rows) {
        if (r.url)
            urls.add(r.url.trim());
        for (const h of [...handleKeys(r.contact || ""), ...handleKeys(r.project || "")])
            handles.add(h);
        for (const w of [...wordKeys(r.contact || ""), ...wordKeys(r.project || "")])
            wordCandidates.add(w);
    }
    // Document frequency of each candidate word across the corpus.
    const DF_MAX = 6;
    const haystacks = corpus.map((j) => " " + applyNorm(`${j.title} ${(j.description || "").slice(0, 160)}`) + " ");
    const keys = new Set(handles);
    for (const w of wordCandidates) {
        let df = 0;
        for (const h of haystacks) {
            if (h.includes(` ${w} `)) {
                if (++df > DF_MAX)
                    break;
            }
        }
        if (df <= DF_MAX)
            keys.add(w);
    }
    return { urls, keys: [...keys] };
}
/** Has this posting already been contacted? Match by exact url, then by name. */
function matchApplied(job, idx) {
    if (idx.urls.has(job.link))
        return "url";
    const hay = " " + applyNorm(`${job.title} ${(job.description || "").slice(0, 160)}`) + " ";
    for (const k of idx.keys) {
        if (hay.includes(` ${k} `) || hay.includes(` ${k}`))
            return "name";
    }
    return null;
}
/**
 * DUMP mode: sweep recent history of each chat into the store with ONE empty
 * search per chat (cheap — no per-term fan-out), then run the match locally
 * over the whole Telegram corpus. Good for a broad, changing keyword set and
 * for freshness; `search` mode stays better for deep history of one rare term.
 */
async function runTgDump(args, chats, backend) {
    const days = Math.min(Math.max(Number(args.days) || 30, 1), 120);
    const explicit = args.since?.trim() ? new Date(args.since) : null;
    const since = explicit && !Number.isNaN(explicit.getTime())
        ? explicit.toISOString()
        : new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const sinceSource = explicit && !Number.isNaN(explicit.getTime()) ? "explicit" : `fallback_${days}d`;
    const cutoffMs = new Date(since).getTime();
    const perChat = Math.min(Math.max(Number(args.limit) || 50, 1), 50);
    const maxChats = args.max_chats == null
        ? chats.length
        : Math.min(Math.max(Number(args.max_chats) || chats.length, 1), MAX_CHATS_CEILING);
    const chatsToSweep = chats.slice(0, maxChats);
    // 1) Sweep — one empty search per chat, guarded so a slow chat can't wedge the run.
    const swept = [];
    const pulledHits = [];
    const startedAt = Date.now();
    for (const chat of chatsToSweep) {
        try {
            const hits = await searchChat(chat, "", perChat, since);
            for (const h of hits)
                pulledHits.push(h);
            swept.push({ chat, pulled: hits.length });
            recordTelegramSourceQuality({ source: `telegram:${chat}`, hits: hits.length, errors: 0, query: "(dump)" });
        }
        catch (e) {
            swept.push({ chat, pulled: 0, error: e?.message || String(e) });
            recordTelegramSourceQuality({ source: `telegram:${chat}`, hits: 0, errors: 1, query: "(dump)" });
        }
    }
    if (args.save !== false && pulledHits.length) {
        upsertJobs(pulledHits.map(hitToJob));
    }
    const elapsedMs = Date.now() - startedAt;
    recordScan({ kind: "tg_dump", units: chatsToSweep.length, ms: elapsedMs });
    // 2) Local match over the whole TG corpus inside the window. Local matching
    // is cheap (no per-term network pass), so allow the full keyword set — the
    // MAX_TERMS cap only exists to bound server-side `search` fan-out.
    const terms = parseTgQueryTerms(String(args.query || "")).slice(0, 64).map((t) => t.toLowerCase());
    const corpus = listJobs().filter((j) => j.platform === "telegram" && new Date(j.date).getTime() >= cutoffMs);
    const outLimit = Math.min(Math.max(Number(args.limit) || 40, 1), 100);
    const applied = buildAppliedIndex(corpus);
    // Single alnum words match on WORD boundary (token set), not substring — so
    // "ton" doesn't hit "button", "ai" doesn't hit "email". Multi-word or special
    // terms ("high load", "node.js", "c++", "sing-box") stay substring: distinctive.
    const isWordTerm = (t) => /^[0-9a-zа-яё]+$/i.test(t);
    const wordTerms = terms.filter(isWordTerm);
    const phraseTerms = terms.filter((t) => !isWordTerm(t));
    const ranked = corpus
        .map((j) => {
        const text = `${j.title}\n${j.description || ""}`.toLowerCase();
        const isResume = TG_RESUME_RE.test(text);
        const tokens = new Set(text.split(/[^0-9a-zа-яё]+/i).filter(Boolean));
        const matched = [
            ...wordTerms.filter((t) => tokens.has(t)),
            ...phraseTerms.filter((t) => text.includes(t)),
        ];
        const ageDays = (Date.now() - new Date(j.date).getTime()) / 86_400_000;
        const recency = ageDays <= 3 ? 3 : ageDays <= 7 ? 2 : ageDays <= 14 ? 1 : 0;
        const appliedVia = matchApplied(j, applied);
        return { j, isResume, matched, score: matched.length * 3 + recency, ageDays, appliedVia };
    })
        .filter((x) => !x.isResume)
        .filter((x) => (terms.length ? x.matched.length > 0 : true))
        .filter((x) => (args.hide_applied ? !x.appliedVia : true))
        .sort((a, b) => b.score - a.score || a.ageDays - b.ageDays);
    // Collapse cross-posts: the same vacancy is mirrored across many aggregator
    // channels (program_job / ITjobsFeed / javascript_jobs …). Key on the
    // normalized title + head of the body so distinct posts that share a generic
    // title ("Новая вакансия") are NOT merged, while true mirrors are. Keep the
    // best-ranked copy (already sorted) and remember where else it ran.
    const dupKey = (j) => applyNorm(`${j.title} ${(j.description || "").slice(0, 200)}`).slice(0, 180);
    const byKey = new Map();
    const deduped = [];
    let collapsed = 0;
    for (const x of ranked) {
        const key = dupKey(x.j);
        const seen = byKey.get(key);
        if (seen) {
            collapsed++;
            seen.also.push(x.j.link);
            continue;
        }
        const entry = { x, also: [] };
        byKey.set(key, entry);
        deduped.push(Object.assign(x, { also: entry.also }));
    }
    const scored = deduped.slice(0, outLimit);
    const appliedCount = scored.filter((x) => x.appliedVia).length;
    return {
        ok: true,
        mode: "dump",
        backend,
        query: args.query || null,
        terms: terms.length ? terms : ["(recent history)"],
        window: { since, since_source: sinceSource, days },
        timing: { ms: elapsedMs, human: msToHuman(elapsedMs) },
        sweep: {
            chats_swept: chatsToSweep.length,
            chats_available: chats.length,
            pulled: pulledHits.length,
            failed: swept.filter((s) => s.error).length,
        },
        corpus_in_window: corpus.length,
        total: scored.length,
        duplicates_collapsed: collapsed,
        applied_count: appliedCount,
        open_count: scored.length - appliedCount,
        results: scored.map((x) => ({
            score: x.score,
            age_days: Math.round(x.ageDays),
            matched_terms: x.matched,
            applied: Boolean(x.appliedVia),
            ...(x.appliedVia ? { applied_via: x.appliedVia } : {}),
            ...(x.also.length ? { cross_posts: x.also.length, also_in: x.also.slice(0, 6) } : {}),
            title: x.j.title,
            link: x.j.link,
            date: x.j.date,
            snippet: (x.j.description || "").slice(0, 280),
        })),
        note: "DUMP: swept recent history into store, matched locally. Cross-posts collapsed (see cross_posts/also_in); resumes filtered; `applied` flags postings already in the outreach log (by url or company/product name). Pass hide_applied:true to drop them. Use mode:'search' for deep history of a specific term.",
    };
}
/**
 * Send ONE Telegram message from the logged-in account (face2place / Alice).
 * Dry-run by default: without confirm:true it returns what would be sent and
 * sends nothing. Real sends are logged to outreach. One message per call —
 * no mass sending; cold outreach is the caller's responsibility.
 */
export async function runTgSend(args) {
    const to = String(args.to || "").trim();
    const text = String(args.text || "").trim();
    if (!to)
        return { ok: false, error: "to required (@username, t.me link, or numeric id)" };
    if (!text)
        return { ok: false, error: "text required" };
    const auth = await getAuthState();
    if (auth.state !== "ready") {
        return {
            ok: false,
            error: "Telegram session not ready",
            state: auth.state,
            hint: auth.hint || "cd mcp && npm run tg:login",
        };
    }
    if (args.confirm !== true) {
        return {
            ok: true,
            dry_run: true,
            to,
            chars: text.length,
            text,
            hint: "DRY RUN — nothing sent. Call again with confirm:true to actually send. Never send without the user's explicit ok.",
        };
    }
    const res = await gramjsSendMessage(to, text);
    try {
        logOutreach({
            id: `tg-${res.chatId}-${res.messageId}`,
            status: "sent",
            channel: "telegram",
            contact: res.peer || to,
            text,
            url: res.link,
            jobId: args.job_id,
            note: args.note,
        });
    }
    catch {
        /* logging is best-effort — a delivered message must not fail on bookkeeping */
    }
    return { ...res, sent: true };
}
/**
 * Pre-flight estimate for a Telegram scan — how long it will take, WITHOUT
 * running it, from the moving average of recent scans. Lets the agent tell the
 * user the wait up front (e.g. "≈ 6 мин, 51 канал × 5 слов").
 */
export async function runTgScanEta(args) {
    const listed = loadTgChannels();
    const chats = args.chats?.length
        ? args.chats
        : listed.channels.map((c) => c.url).filter(Boolean);
    const maxChats = args.max_chats == null
        ? chats.length
        : Math.min(Math.max(Number(args.max_chats) || chats.length, 1), MAX_CHATS_CEILING);
    const chatCount = Math.min(chats.length, maxChats);
    const parsed = parseTgQueryTerms(String(args.query || "").trim());
    const termCount = Math.min(parsed.length || 1, MAX_TERMS);
    const units = chatCount * termCount;
    const eta = estimateScan({ kind: "tg_search", units });
    return {
        ok: true,
        chats: chatCount,
        terms: termCount,
        units,
        estimated_ms: eta.estimated_ms,
        estimated_human: eta.estimated_human,
        ms_per_unit: eta.ms_per_unit,
        from_history: eta.from_history,
        samples: eta.samples,
        note: eta.from_history
            ? `Из ${eta.samples} прошлых сканов. Скажи пользователю ожидание перед запуском.`
            : "Истории ещё нет — оценка по дефолту, уточнится после первого скана.",
    };
}
