import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface Preset {
  label: string;
  hours?: number;
  limit?: number;
  keywords?: string[];
  minus?: string[];
  include_jobs?: boolean;
  include_services?: boolean;
  watch_sources?: string[];
  platforms?: string[];
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let cache: Record<string, Preset> | null = null;

export function loadPresets(): Record<string, Preset> {
  if (cache) return cache;
  cache = JSON.parse(readFileSync(join(ROOT, "presets.json"), "utf8")) as Record<
    string,
    Preset
  >;
  return cache;
}

export function getPreset(name: string): Preset | undefined {
  return loadPresets()[name];
}
