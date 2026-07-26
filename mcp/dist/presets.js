import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let cache = null;
export function loadPresets() {
    if (cache)
        return cache;
    cache = JSON.parse(readFileSync(join(ROOT, "presets.json"), "utf8"));
    return cache;
}
export function getPreset(name) {
    return loadPresets()[name];
}
