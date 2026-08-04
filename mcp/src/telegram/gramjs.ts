/**
 * GramJS (pure JS MTProto) — works on win32-arm64 where prebuilt-tdlib does not.
 * Session: mcp/data/telegram/gramjs.session
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../store.js";
import { tgApiHash, tgApiId, tgCredentialsConfigured } from "./credentials.js";
import type { TdAuthState, TgMessageHit } from "./types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

let client: AnyClient | null = null;

export function gramjsSessionPath(): string {
  const dir = join(dataDir(), "telegram");
  mkdirSync(dir, { recursive: true });
  return join(dir, "gramjs.session");
}

export function hasGramjsSession(): boolean {
  try {
    const p = gramjsSessionPath();
    return existsSync(p) && readFileSync(p, "utf8").trim().length > 20;
  } catch {
    return false;
  }
}

export async function probeGramjs(): Promise<{
  ok: boolean;
  error?: string;
  install: string;
}> {
  const install = "In mcp/: npm install telegram   # GramJS (works on Windows ARM64)";
  try {
    await import("telegram");
    await import("telegram/sessions/index.js");
    return { ok: true, install };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message || String(e), install };
  }
}

async function loadClientModules() {
  const telegram = await import("telegram");
  const sessions = await import("telegram/sessions/index.js");
  return {
    TelegramClient: (telegram as { TelegramClient: new (...a: unknown[]) => AnyClient }).TelegramClient,
    StringSession: (sessions as { StringSession: new (s?: string) => unknown }).StringSession,
  };
}

export async function getGramjsClient(): Promise<AnyClient> {
  if (client) return client;
  if (!tgCredentialsConfigured()) {
    throw new Error("Set TG_APP_API_ID + TG_APP_API_HASH (or TELEGRAM_API_*)");
  }
  const deps = await probeGramjs();
  if (!deps.ok) throw new Error(`${deps.error}. ${deps.install}`);

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

export function saveGramjsSession(c: AnyClient): void {
  const s = String(c.session.save());
  writeFileSync(gramjsSessionPath(), s, "utf8");
}

export async function gramjsAuthState(): Promise<{
  state: TdAuthState;
  raw?: string;
  hint?: string;
}> {
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
  } catch (e) {
    return {
      state: "wait_phone",
      hint: (e as Error)?.message || String(e),
    };
  }
}

function parseUsername(ref: string): string {
  const raw = String(ref || "").trim();
  if (raw.startsWith("@")) return raw.slice(1);
  const m = raw.match(/(?:t\.me|telegram\.me)\/(?:s\/)?([A-Za-z0-9_]+)/i);
  if (m) return m[1];
  return raw.replace(/[^\w\d_]/g, "");
}

export async function gramjsSearchChat(
  chatRef: string,
  query: string,
  limit = 20,
): Promise<TgMessageHit[]> {
  const c = await getGramjsClient();
  const username = parseUsername(chatRef);
  const entity = await c.getEntity(username.startsWith("+") || /^-?\d+$/.test(chatRef) ? chatRef : username);
  const lim = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const q = String(query || "").trim();

  const out: TgMessageHit[] = [];
  const opts: Record<string, unknown> = { limit: lim };
  if (q) opts.search = q;

  for await (const msg of c.iterMessages(entity, opts)) {
    const text = String(msg.message || "").trim();
    if (!text) continue;
    const messageId = Number(msg.id);
    const chatId = Number(entity.id ?? msg.chatId ?? 0);
    const uname = entity.username || username;
    const link = uname
      ? `https://t.me/${uname}/${messageId}`
      : `https://t.me/c/${String(chatId).replace(/^-100/, "")}/${messageId}`;
    const title = entity.title || entity.firstName || uname || "telegram";
    const date = msg.date
      ? new Date(msg.date * 1000).toISOString()
      : new Date().toISOString();
    const titleLine = text.split("\n").find((l: string) => l.trim()) || String(title);
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
    if (out.length >= lim) break;
  }
  return out;
}

export async function closeGramjs(): Promise<void> {
  if (!client) return;
  try {
    await client.disconnect();
  } catch {
    /* ignore */
  }
  client = null;
}
