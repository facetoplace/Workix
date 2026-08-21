/**
 * GramJS (pure JS MTProto) — works on win32-arm64 where prebuilt-tdlib does not.
 * Session: mcp/data/telegram/gramjs.session
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../store.js";
import { tgApiHash, tgApiId, tgCredentialsConfigured } from "./credentials.js";
let client = null;
export function gramjsSessionPath() {
    const dir = join(dataDir(), "telegram");
    mkdirSync(dir, { recursive: true });
    return join(dir, "gramjs.session");
}
export function hasGramjsSession() {
    try {
        const p = gramjsSessionPath();
        return existsSync(p) && readFileSync(p, "utf8").trim().length > 20;
    }
    catch {
        return false;
    }
}
export async function probeGramjs() {
    const install = "In mcp/: npm install telegram   # GramJS (works on Windows ARM64)";
    try {
        await import("telegram");
        await import("telegram/sessions/index.js");
        return { ok: true, install };
    }
    catch (e) {
        return { ok: false, error: e?.message || String(e), install };
    }
}
async function loadClientModules() {
    const telegram = await import("telegram");
    const sessions = await import("telegram/sessions/index.js");
    return {
        TelegramClient: telegram.TelegramClient,
        StringSession: sessions.StringSession,
    };
}
export async function getGramjsClient() {
    if (client)
        return client;
    if (!tgCredentialsConfigured()) {
        throw new Error("Set TG_APP_API_ID + TG_APP_API_HASH (or TELEGRAM_API_*)");
    }
    const deps = await probeGramjs();
    if (!deps.ok)
        throw new Error(`${deps.error}. ${deps.install}`);
    const { TelegramClient, StringSession } = await loadClientModules();
    const saved = hasGramjsSession() ? readFileSync(gramjsSessionPath(), "utf8").trim() : "";
    const session = new StringSession(saved);
    client = new TelegramClient(session, tgApiId(), tgApiHash(), {
        connectionRetries: 5,
        deviceModel: "Workix MCP",
        appVersion: "0.3",
    });
    await client.connect();
    if (!(await client.checkAuthorization())) {
        await client.disconnect().catch(() => null);
        client = null;
        throw new Error("Not logged in — run: npm run tg:login");
    }
    return client;
}
export function saveGramjsSession(c) {
    const s = String(c.session.save());
    writeFileSync(gramjsSessionPath(), s, "utf8");
}
export async function gramjsAuthState() {
    const deps = await probeGramjs();
    if (!deps.ok) {
        return { state: "missing_deps", hint: deps.install };
    }
    if (!tgCredentialsConfigured()) {
        return {
            state: "missing_credentials",
            hint: "TG_APP_API_ID + TG_APP_API_HASH in .env (my.telegram.org/apps)",
        };
    }
    if (!hasGramjsSession()) {
        return {
            state: "wait_phone",
            hint: "Run in terminal: cd mcp && npm run tg:login",
        };
    }
    try {
        const c = await getGramjsClient();
        const me = await c.getMe();
        return {
            state: "ready",
            raw: `gramjs:${me?.username || me?.id || "ok"}`,
            hint: "workix_tg_search",
        };
    }
    catch (e) {
        return {
            state: "wait_phone",
            hint: e?.message || String(e),
        };
    }
}
function parseUsername(ref) {
    const raw = String(ref || "").trim();
    if (raw.startsWith("@"))
        return raw.slice(1);
    const m = raw.match(/(?:t\.me|telegram\.me)\/(?:s\/)?([A-Za-z0-9_]+)/i);
    if (m)
        return m[1];
    return raw.replace(/[^\w\d_]/g, "");
}
export async function gramjsSearchChat(chatRef, query, limit = 20, since) {
    const c = await getGramjsClient();
    const username = parseUsername(chatRef);
    const entity = await c.getEntity(username.startsWith("+") || /^-?\d+$/.test(chatRef) ? chatRef : username);
    const requested = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const cutoff = since ? new Date(since).getTime() : 0;
    const lim = cutoff ? 50 : requested;
    const q = String(query || "").trim();
    const out = [];
    const opts = { limit: lim };
    if (q)
        opts.search = q;
    for await (const msg of c.iterMessages(entity, opts)) {
        const text = String(msg.message || "").trim();
        if (!text)
            continue;
        const messageId = Number(msg.id);
        const chatId = Number(entity.id ?? msg.chatId ?? 0);
        const uname = entity.username || username;
        const link = uname
            ? `https://t.me/${uname}/${messageId}`
            : `https://t.me/c/${String(chatId).replace(/^-100/, "")}/${messageId}`;
        const title = entity.title || entity.firstName || uname || "telegram";
        const dateMs = msg.date ? Number(msg.date) * 1000 : Date.now();
        const date = new Date(dateMs).toISOString();
        const titleLine = text.split("\n").find((l) => l.trim()) || String(title);
        if (cutoff && dateMs < cutoff)
            continue;
        out.push({
            id: `tg_${chatId}_${messageId}`,
            platform: "telegram",
            kind: "gig",
            title: titleLine.slice(0, 160),
            description: text.slice(0, 4000),
            link,
            date,
            chat: String(title),
            chatId,
            messageId,
        });
        if (out.length >= requested)
            break;
    }
    return out;
}
/** Send one message to a user/chat from the logged-in account. */
export async function gramjsSendMessage(to, text) {
    const c = await getGramjsClient();
    const ref = String(to || "").trim();
    const arg = ref.startsWith("+") || /^-?\d+$/.test(ref) ? ref : parseUsername(ref);
    const entity = await c.getEntity(arg);
    const res = await c.sendMessage(entity, { message: String(text) });
    const messageId = Number(res?.id ?? 0);
    const chatId = Number(entity.id ?? 0);
    const uname = entity.username;
    return {
        ok: true,
        peer: uname ? "@" + uname : String(chatId),
        chatId,
        messageId,
        link: uname && messageId ? `https://t.me/${uname}/${messageId}` : undefined,
    };
}
export async function closeGramjs() {
    if (!client)
        return;
    try {
        await client.disconnect();
    }
    catch {
        /* ignore */
    }
    client = null;
}
