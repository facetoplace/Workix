import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export interface ProfileFilters {
  keywords: string[];
  minus: string[];
  min_budget?: number;
  focus?: string;
}

export function loadProfile(): string {
  const custom = process.env.WORKIX_PROFILE_PATH;
  const candidates = [
    custom,
    join(ROOT, "profile.md"),
    join(ROOT, "profile.example.md"),
  ].filter(Boolean) as string[];

  for (const path of candidates) {
    if (existsSync(path)) {
      return readFileSync(path, "utf8");
    }
  }
  return "Профиль не задан. Создайте mcp/profile.md по образцу profile.example.md.";
}

export function profilePathUsed(): string {
  const custom = process.env.WORKIX_PROFILE_PATH;
  const candidates = [
    custom,
    join(ROOT, "profile.md"),
    join(ROOT, "profile.example.md"),
  ].filter(Boolean) as string[];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return "(missing)";
}

/** Parse YAML-like filter block from profile markdown. */
export function parseProfileFilters(text?: string): ProfileFilters {
  const src = text ?? loadProfile();
  const keywords = listAfter(src, /(?:^|\n)##\s*keywords\s*\n([\s\S]*?)(?=\n##\s|\n*$)/i);
  const minus = listAfter(src, /(?:^|\n)##\s*minus\s*\n([\s\S]*?)(?=\n##\s|\n*$)/i);
  const budgetMatch = src.match(/min_budget:\s*(\d+)/i);
  const focusMatch = src.match(/focus:\s*(\S+)/i);
  return {
    keywords,
    minus,
    min_budget: budgetMatch ? Number(budgetMatch[1]) : undefined,
    focus: focusMatch?.[1],
  };
}

function listAfter(src: string, re: RegExp): string[] {
  const m = src.match(re);
  if (!m) return [];
  return m[1]
    .split(/\n/)
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter((l) => l && !l.startsWith("#"));
}
