/**
 * Optional Telegram tools (GramJS on ARM64 / TDLib where native works).
 */
import { upsertJobs } from "../store.js";
import type { Job } from "../types.js";
import { loadTgChannels, parseTgUsername } from "../telegram/channels.js";
import {
  getAuthState,
  probeTelegramDeps,
  searchChat,
  tgCheckCode,
  tgCheckPassword,
  tgCredentialsConfigured,
  tgSetPhone,
  type TgMessageHit,
} from "../telegram/backend.js";

function hitToJob(h: TgMessageHit): Job {
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

export async function runTgStatus(): Promise<unknown> {
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
    next:
      auth.state === "missing_deps"
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

export async function runTgAuth(args: {
  phone?: string;
  code?: string;
  password?: string;
}): Promise<unknown> {
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
    if (args.phone) await tgSetPhone(args.phone);
    else if (args.code) await tgCheckCode(args.code);
    else if (args.password != null) await tgCheckPassword(args.password);
    else {
      return { ok: false, error: "Pass phone, code, or password", auth: before };
    }
  } catch (e) {
    return {
      ok: false,
      error: (e as Error)?.message || String(e),
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

export async function runTgSearch(args: {
  query?: string;
  chats?: string[];
  limit?: number;
  save?: boolean;
}): Promise<unknown> {
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
  const chats =
    args.chats?.length
      ? args.chats
      : listed.channels.map((c) => c.url).filter(Boolean);

  if (!chats.length) {
    return {
      ok: false,
      error:
        "No chats. Pass chats:[\"https://t.me/siliconpravdachat\"] or copy telegram-channels.example.json → telegram-channels.json",
    };
  }

  const query = String(args.query || "").trim();
  const perChat = Math.min(Math.max(Number(args.limit) || 10, 1), 30);
  const results: Array<{ chat: string; hits: TgMessageHit[]; error?: string }> = [];
  const allHits: TgMessageHit[] = [];

  for (const chat of chats.slice(0, 20)) {
    try {
      const hits = await searchChat(chat, query, perChat);
      results.push({ chat, hits });
      allHits.push(...hits);
    } catch (e) {
      results.push({
        chat,
        hits: [],
        error: (e as Error)?.message || String(e),
      });
    }
  }

  if (args.save !== false && allHits.length) {
    upsertJobs(allHits.map(hitToJob));
  }

  return {
    ok: true,
    backend: auth.backend,
    query: query || null,
    total: allHits.length,
    chats_searched: results.length,
    results: results.map((r) => ({
      chat: r.chat,
      error: r.error,
      count: r.hits.length,
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
