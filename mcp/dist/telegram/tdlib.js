/**
 * Optional TDLib client (x64/arm64 macOS/Linux + win x64).
 * On win32-arm64 use GramJS via backend.ts instead.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../store.js";
import { tgApiHash, tgApiId, tgCredentialsConfigured } from "./credentials.js";
export { tgCredentialsConfigured };
let configured = false;
let client = null;
let loadError = null;
export async function probeTdlibDeps() {
    const install = "Prefer: npm install telegram (GramJS, ARM64 OK). Or tdl+prebuilt-tdlib on supported platforms.";
    let tdlOk = false;
    let preOk = false;
    let error;
    try {
        await import("tdl");
        tdlOk = true;
    }
    catch (e) {
        error = e?.message || String(e);
    }
    try {
        const pre = await import("prebuilt-tdlib");
        pre.getTdjson();
        preOk = true;
    }
    catch (e) {
        error = error || e?.message || String(e);
    }
    return {
        ok: tdlOk && preOk,
        tdl: tdlOk,
        prebuilt: preOk,
        error: tdlOk && preOk ? undefined : error,
        install,
    };
}
async function configureTdlib() {
    if (configured)
        return;
    const tdl = await import("tdl");
    const pre = await import("prebuilt-tdlib");
    const getTdjson = pre.getTdjson;
    tdl.configure({
        tdjson: getTdjson(),
        verbosityLevel: Number(process.env.TELEGRAM_TDLIB_VERBOSITY || 1),
    });
    configured = true;
}
function sessionDirs() {
    const root = join(dataDir(), "telegram");
    const databaseDirectory = join(root, "tdlib-db");
    const filesDirectory = join(root, "tdlib-files");
    mkdirSync(databaseDirectory, { recursive: true });
    mkdirSync(filesDirectory, { recursive: true });
    return { databaseDirectory, filesDirectory };
}
export async function getTdClient() {
    if (client)
        return client;
    loadError = null;
    if (!tgCredentialsConfigured()) {
        throw new Error("Set TELEGRAM_API_ID and TELEGRAM_API_HASH from https://my.telegram.org/apps");
    }
    const deps = await probeTdlibDeps();
    if (!deps.ok) {
        loadError = deps.error || "tdl/prebuilt-tdlib missing";
        throw new Error(`${loadError}. ${deps.install}`);
    }
    await configureTdlib();
    const tdl = await import("tdl");
    const { databaseDirectory, filesDirectory } = sessionDirs();
    client = tdl.createClient({
        apiId: tgApiId(),
        apiHash: tgApiHash(),
        databaseDirectory,
        filesDirectory,
        tdlibParameters: {
            use_message_database: true,
            use_secret_chats: false,
            system_language_code: "en",
            application_version: "workix-mcp/0.3",
            device_model: "Workix MCP",
            system_version: process.platform,
        },
    });
    return client;
}
export async function getAuthState() {
    const deps = await probeTdlibDeps();
    if (!deps.ok) {
        return {
            state: "missing_deps",
            hint: deps.install,
            deps,
        };
    }
    if (!tgCredentialsConfigured()) {
        return {
            state: "missing_credentials",
            hint: "Get api_id + api_hash at https://my.telegram.org/apps → TELEGRAM_API_ID / TELEGRAM_API_HASH in mcp/.env",
            deps,
        };
    }
    try {
        const c = await getTdClient();
        const auth = await c.invoke({ _: "getAuthorizationState" });
        const type = String(auth._ || "");
        const map = {
            authorizationStateWaitPhoneNumber: "wait_phone",
            authorizationStateWaitCode: "wait_code",
            authorizationStateWaitPassword: "wait_password",
            authorizationStateWaitRegistration: "wait_registration",
            authorizationStateReady: "ready",
            authorizationStateLoggingOut: "logging_out",
            authorizationStateClosing: "closed",
            authorizationStateClosed: "closed",
            authorizationStateWaitTdlibParameters: "unknown",
            authorizationStateWaitEncryptionKey: "unknown",
        };
        return {
            state: map[type] || "unknown",
            raw: type,
            deps,
            hint: map[type] === "wait_phone"
                ? "Call workix_tg_auth with phone:+888…"
                : map[type] === "wait_code"
                    ? "Call workix_tg_auth with code from Telegram/SMS"
                    : map[type] === "wait_password"
                        ? "Call workix_tg_auth with password (2FA)"
                        : undefined,
        };
    }
    catch (e) {
        return {
            state: "unknown",
            hint: e?.message || String(e),
            deps,
        };
    }
}
export async function tgSetPhone(phone) {
    const c = await getTdClient();
    const normalized = String(phone || "").trim();
    if (!normalized.startsWith("+")) {
        throw new Error("phone must be international, e.g. +79001234567");
    }
    return c.invoke({
        _: "setAuthenticationPhoneNumber",
        phone_number: normalized,
        settings: { _: "phoneNumberAuthenticationSettings" },
    });
}
export async function tgCheckCode(code) {
    const c = await getTdClient();
    return c.invoke({
        _: "checkAuthenticationCode",
        code: String(code || "").trim(),
    });
}
export async function tgCheckPassword(password) {
    const c = await getTdClient();
    return c.invoke({
        _: "checkAuthenticationPassword",
        password: String(password || ""),
    });
}
export async function resolveChatId(urlOrUser) {
    const c = await getTdClient();
    const username = urlOrUser.includes("t.me") || urlOrUser.startsWith("@")
        ? urlOrUser.replace(/^@/, "").replace(/^https?:\/\/(t\.me|telegram\.me)\//i, "").split("/")[0]
        : urlOrUser;
    if (/^-?\d+$/.test(String(urlOrUser).trim())) {
        const chat = await c.invoke({
            _: "getChat",
            chat_id: Number(urlOrUser),
        });
        return {
            chatId: Number(chat.id),
            title: String(chat.title || ""),
            username: undefined,
        };
    }
    const pub = await c.invoke({
        _: "searchPublicChat",
        username: username.replace(/[^\w\d_]/g, ""),
    });
    const chatId = Number(pub.id);
    await c.invoke({ _: "openChat", chat_id: chatId }).catch(() => null);
    return {
        chatId,
        title: String(pub.title || username),
        username,
    };
}
function messageText(msg) {
    const content = msg.content;
    if (!content)
        return "";
    if (content._ === "messageText") {
        const text = content.text;
        return String(text?.text || "");
    }
    if (content._ === "messagePhoto" || content._ === "messageDocument") {
        const cap = content.caption;
        return String(cap?.text || "");
    }
    return "";
}
function messageLink(username, chatId, messageId) {
    if (username)
        return `https://t.me/${username}/${messageId}`;
    // private / supergroup without username
    const abs = String(chatId).replace(/^-100/, "");
    return `https://t.me/c/${abs}/${messageId}`;
}
export async function searchChat(chatRef, query, limit = 20) {
    const c = await getTdClient();
    const { chatId, title, username } = await resolveChatId(chatRef);
    await c.invoke({ _: "openChat", chat_id: chatId }).catch(() => null);
    const q = String(query || "").trim();
    const lim = Math.min(Math.max(Number(limit) || 20, 1), 50);
    let messages = [];
    if (q) {
        const res = await c.invoke({
            _: "searchChatMessages",
            chat_id: chatId,
            query: q,
            from_message_id: 0,
            offset: 0,
            limit: lim,
            filter: { _: "searchMessagesFilterEmpty" },
            message_thread_id: 0,
        });
        messages = res.messages || [];
    }
    else {
        const res = await c.invoke({
            _: "getChatHistory",
            chat_id: chatId,
            from_message_id: 0,
            offset: 0,
            limit: lim,
            only_local: false,
        });
        messages = res.messages || [];
    }
    const out = [];
    for (const msg of messages) {
        const text = messageText(msg).trim();
        if (!text)
            continue;
        const messageId = Number(msg.id);
        const dateSec = Number(msg.date || 0);
        const link = messageLink(username, chatId, messageId);
        const titleLine = text.split("\n").find((l) => l.trim()) || title;
        out.push({
            id: `tg_${chatId}_${messageId}`,
            platform: "telegram",
            kind: "gig",
            title: titleLine.slice(0, 160),
            description: text.slice(0, 4000),
            link,
            date: dateSec ? new Date(dateSec * 1000).toISOString() : new Date().toISOString(),
            chat: title,
            chatId,
            messageId,
        });
    }
    return out;
}
export async function closeTdClient() {
    if (!client)
        return;
    try {
        await client.invoke({ _: "close" });
    }
    catch {
        /* ignore */
    }
    client = null;
    configured = false;
}
export function lastLoadError() {
    return loadError;
}
