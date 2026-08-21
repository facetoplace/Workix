/**
 * Pick Telegram backend: GramJS (always preferred on win-arm64 / when TDLib native missing).
 */
import { probeGramjs, gramjsAuthState, gramjsSearchChat, closeGramjs } from "./gramjs.js";
import { tgCredentialsConfigured } from "./credentials.js";
import type { TdAuthState, TgBackend, TgMessageHit } from "./types.js";

export type { TdAuthState, TgMessageHit, TgBackend };

async function probeTdlibNative(): Promise<{ ok: boolean; error?: string }> {
  try {
    await import("tdl");
    const pre = await import("prebuilt-tdlib");
    const getTdjson = (pre as { getTdjson: () => string }).getTdjson;
    getTdjson(); // throws on unsupported platform (win32-arm64)
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message || String(e) };
  }
}

export async function resolveBackend(): Promise<{
  backend: TgBackend;
  reason: string;
}> {
  const gram = await probeGramjs();
  const td = await probeTdlibNative();

  // Prefer GramJS when TDLib native unavailable (e.g. Windows ARM64)
  if (!td.ok && gram.ok) {
    return { backend: "gramjs", reason: `TDLib: ${td.error || "unavailable"}; using GramJS` };
  }
  if (gram.ok) {
    return { backend: "gramjs", reason: "GramJS (portable MTProto)" };
  }
  if (td.ok) {
    return { backend: "tdlib", reason: "TDLib prebuilt" };
  }
  return {
    backend: "none",
    reason: `Install: npm install telegram   (recommended on ARM). TDLib error: ${td.error || "n/a"}; GramJS: ${gram.error || "n/a"}`,
  };
}

export async function getAuthState(): Promise<{
  state: TdAuthState;
  raw?: string;
  hint?: string;
  backend?: TgBackend;
  reason?: string;
}> {
  const { backend, reason } = await resolveBackend();
  if (backend === "none") {
    return { state: "missing_deps", hint: reason, backend, reason };
  }
  if (!tgCredentialsConfigured()) {
    return {
      state: "missing_credentials",
      hint: "TG_APP_API_ID + TG_APP_API_HASH in .env",
      backend,
      reason,
    };
  }
  if (backend === "gramjs") {
    const a = await gramjsAuthState();
    return { ...a, backend, reason };
  }
  // lazy TDLib path
  const td = await import("./tdlib.js");
  const a = await td.getAuthState();
  return { ...a, backend, reason };
}

export async function searchChat(
  chatRef: string,
  query: string,
  limit = 20,
  since?: string,
): Promise<TgMessageHit[]> {
  const { backend } = await resolveBackend();
  if (backend === "gramjs") return gramjsSearchChat(chatRef, query, limit, since);
  if (backend === "tdlib") {
    const td = await import("./tdlib.js");
    return td.searchChat(chatRef, query, limit, since);
  }
  throw new Error("No Telegram backend — npm install telegram");
}

export async function tgSetPhone(phone: string): Promise<unknown> {
  const { backend } = await resolveBackend();
  if (backend === "tdlib") {
    const td = await import("./tdlib.js");
    return td.tgSetPhone(phone);
  }
  throw new Error("For GramJS use terminal: npm run tg:login (do not pass phone/code in chat)");
}

export async function tgCheckCode(code: string): Promise<unknown> {
  const { backend } = await resolveBackend();
  if (backend === "tdlib") {
    const td = await import("./tdlib.js");
    return td.tgCheckCode(code);
  }
  throw new Error("For GramJS use terminal: npm run tg:login");
}

export async function tgCheckPassword(password: string): Promise<unknown> {
  const { backend } = await resolveBackend();
  if (backend === "tdlib") {
    const td = await import("./tdlib.js");
    return td.tgCheckPassword(password);
  }
  throw new Error("For GramJS use terminal: npm run tg:login");
}

export { tgCredentialsConfigured } from "./credentials.js";

export async function probeTelegramDeps(): Promise<{
  ok: boolean;
  backend: TgBackend;
  reason: string;
  install: string;
  tdl: boolean;
  prebuilt: boolean;
  gramjs: boolean;
  error?: string;
}> {
  const gram = await probeGramjs();
  const td = await probeTdlibNative();
  const { backend, reason } = await resolveBackend();
  return {
    ok: backend !== "none",
    backend,
    reason,
    install:
      backend === "none"
        ? "npm install telegram   # recommended (ARM64 OK). Optional: tdl prebuilt-tdlib on x64"
        : reason,
    tdl: td.ok,
    prebuilt: td.ok,
    gramjs: gram.ok,
    error: backend === "none" ? reason : undefined,
  };
}

export async function closeTelegram(): Promise<void> {
  await closeGramjs();
  try {
    const td = await import("./tdlib.js");
    await td.closeTdClient();
  } catch {
    /* ignore */
  }
}
