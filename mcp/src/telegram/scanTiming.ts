/**
 * Adaptive scan timing. Records how long vacancy scans take and predicts the
 * next one from history, so the agent can tell the user how long to wait.
 *
 * The unit of work is one (chat × term) lookup; total time scales with it.
 * We keep a rolling window of recent runs and average their per-unit cost, so
 * the estimate self-corrects as the session speeds up or (as today) throttles.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveDataDir } from "../db.js";

export type ScanKind = "tg_search" | "tg_dump" | "digest";

type ScanRecord = {
  at: string;
  kind: ScanKind;
  units: number; // chats × terms (or sources) actually walked
  ms: number;
  msPerUnit: number;
};

const MAX_HISTORY = 40;
const RECENT_WINDOW = 10;
/** Fallback per-unit cost before any history exists (ms). Self-corrects after run 1. */
const DEFAULT_MS_PER_UNIT = 1200;

function file(): string {
  return join(resolveDataDir(), "scan-timings.json");
}

function load(): ScanRecord[] {
  try {
    const arr = JSON.parse(readFileSync(file(), "utf8"));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function save(rows: ScanRecord[]): void {
  try {
    writeFileSync(file(), JSON.stringify(rows.slice(-MAX_HISTORY), null, 0));
  } catch {
    /* timing history is best-effort — never fail a scan over it */
  }
}

/** Record a finished scan and return its per-unit cost. */
export function recordScan(input: {
  kind: ScanKind;
  units: number;
  ms: number;
  at?: string;
}): void {
  if (!input.units || input.units < 1 || !input.ms || input.ms < 0) return;
  const rows = load();
  rows.push({
    at: input.at || new Date().toISOString(),
    kind: input.kind,
    units: input.units,
    ms: input.ms,
    msPerUnit: input.ms / input.units,
  });
  save(rows);
}

export function msToHuman(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `~${s} сек`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `~${m} мин ${r} сек` : `~${m} мин`;
}

/**
 * Predict how long a scan of `units` (chats × terms) will take, from the
 * average per-unit cost of recent runs of the same kind.
 */
export function estimateScan(input: {
  kind: ScanKind;
  units: number;
}): {
  estimated_ms: number;
  estimated_human: string;
  ms_per_unit: number;
  samples: number;
  from_history: boolean;
} {
  const units = Math.max(1, input.units);
  const recent = load()
    .filter((r) => r.kind === input.kind && r.msPerUnit > 0)
    .slice(-RECENT_WINDOW);
  const msPerUnit = recent.length
    ? recent.reduce((a, r) => a + r.msPerUnit, 0) / recent.length
    : DEFAULT_MS_PER_UNIT;
  const estimated_ms = Math.round(msPerUnit * units);
  return {
    estimated_ms,
    estimated_human: msToHuman(estimated_ms),
    ms_per_unit: Math.round(msPerUnit),
    samples: recent.length,
    from_history: recent.length > 0,
  };
}
