import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export function loadProfile() {
    const custom = process.env.WORKIX_PROFILE_PATH;
    const candidates = [
        custom,
        join(ROOT, "profile.md"),
        join(ROOT, "profile.example.md"),
    ].filter(Boolean);
    for (const path of candidates) {
        if (existsSync(path)) {
            return readFileSync(path, "utf8");
        }
    }
    return "Профиль не задан. Создайте mcp/profile.md по образцу profile.example.md.";
}
export function profilePathUsed() {
    const custom = process.env.WORKIX_PROFILE_PATH;
    const candidates = [
        custom,
        join(ROOT, "profile.md"),
        join(ROOT, "profile.example.md"),
    ].filter(Boolean);
    for (const path of candidates) {
        if (existsSync(path))
            return path;
    }
    return "(missing)";
}
/** Parse YAML-like filter block from profile markdown. */
export function parseProfileFilters(text) {
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
function listAfter(src, re) {
    const m = src.match(re);
    if (!m)
        return [];
    return m[1]
        .split(/\n/)
        .map((l) => l.replace(/^[-*]\s*/, "").trim())
        .filter((l) => l && !l.startsWith("#"));
}
