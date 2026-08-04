/**
 * Load watch list from telegram-channels.json (or example).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MCP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export type TgChannel = {
  id: string;
  title?: string;
  url: string;
  kind?: string;
  priority?: string;
  note?: string;
};

export function parseTgUsername(urlOrUser: string): string {
  const raw = String(urlOrUser || "").trim();
  if (!raw) return "";
  if (raw.startsWith("@")) return raw.slice(1).replace(/[^\w\d_]/g, "");
  const m = raw.match(/(?:t\.me|telegram\.me)\/(?:s\/)?([A-Za-z0-9_]+)/i);
  if (m) return m[1];
  if (/^[A-Za-z0-9_]{4,}$/.test(raw)) return raw;
  return "";
}

export function loadTgChannels(): {
  path: string | null;
  channels: TgChannel[];
  note?: string;
} {
  const candidates = [
    join(MCP_ROOT, "telegram-channels.json"),
    process.env.WORKIX_TG_CHANNELS?.trim() || "",
    join(MCP_ROOT, "telegram-channels.example.json"),
  ].filter(Boolean);

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const data = JSON.parse(readFileSync(path, "utf8")) as {
        note?: string;
        channels?: TgChannel[];
      };
      const channels = (data.channels || [])
        .filter((c) => c && c.url && parseTgUsername(c.url))
        .map((c) => ({
          ...c,
          id: c.id || parseTgUsername(c.url) || c.url,
        }));
      return { path, channels, note: data.note };
    } catch {
      /* next */
    }
  }
  return { path: null, channels: [], note: "No telegram-channels.json found" };
}
