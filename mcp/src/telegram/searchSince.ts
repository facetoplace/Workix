import { listCheckpoints } from "../store.js";

const FALLBACK_DAYS = 30;

export function telegramSearchSince(explicit?: string): {
  since: string;
  source: "explicit" | "checkpoint" | "fallback_30d";
} {
  if (explicit?.trim()) {
    const parsed = new Date(explicit);
    if (!Number.isNaN(parsed.getTime())) {
      return { since: parsed.toISOString(), source: "explicit" };
    }
  }
  // Incremental "since last TG scan" — but ONLY from a Telegram checkpoint.
  // A generic session checkpoint (e.g. a full-scan summary) must never shrink
  // the window: that silently zeroed every next search. Also floor the window
  // so a checkpoint written seconds ago still catches same-day reposts.
  const tgCheckpoint = listCheckpoints(50).find((c) =>
    (c.surfaces || []).some((s) => s === "telegram" || s.startsWith("telegram:")),
  );
  if (tgCheckpoint?.at && !Number.isNaN(new Date(tgCheckpoint.at).getTime())) {
    const at = new Date(tgCheckpoint.at).getTime();
    const floor = Date.now() - 2 * 24 * 60 * 60 * 1000; // never narrower than 2d
    return { since: new Date(Math.min(at, floor)).toISOString(), source: "checkpoint" };
  }
  return {
    since: new Date(Date.now() - FALLBACK_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    source: "fallback_30d",
  };
}
