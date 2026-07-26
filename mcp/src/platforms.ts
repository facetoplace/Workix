import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PlatformConfig } from "./types.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let cache: PlatformConfig[] | null = null;

export function loadPlatforms(): PlatformConfig[] {
  if (cache) return cache;
  const raw = JSON.parse(readFileSync(join(ROOT, "platforms.json"), "utf8")) as {
    platforms: PlatformConfig[];
  };
  cache = raw.platforms;
  return cache;
}

export function v1Platforms(): PlatformConfig[] {
  return loadPlatforms().filter((p) => p.tier === "v1");
}

export function rssPlatforms(ids?: string[]): PlatformConfig[] {
  return v1Platforms().filter(
    (p) => p.access === "rss" && p.rss && (!ids?.length || ids.includes(p.id)),
  );
}
