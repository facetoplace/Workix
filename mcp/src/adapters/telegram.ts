/**
 * Optional Telegram digest fetch (TDLib). Only runs when session ready.
 */
import { loadTgChannels } from "../telegram/channels.js";
import { getAuthState, searchChat } from "../telegram/backend.js";
import type { Job } from "../types.js";

export async function fetchTelegramJobs(opts?: {
  keywords?: string[];
  limit?: number;
}): Promise<{ jobs: Job[]; error?: string }> {
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
  const per = Math.min(Math.max(Number(opts?.limit) || 8, 1), 15);
  const jobs: Job[] = [];
  const errors: string[] = [];

  for (const ch of channels.slice(0, 12)) {
    try {
      const hits = await searchChat(ch.url, query, per);
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
    } catch (e) {
      errors.push(`${ch.id}: ${(e as Error)?.message || e}`);
    }
  }

  return {
    jobs,
    error: errors.length ? errors.slice(0, 5).join("; ") : undefined,
  };
}
