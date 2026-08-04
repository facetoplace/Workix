import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let cache = null;
export function loadPlatforms() {
    if (cache)
        return cache;
    const raw = JSON.parse(readFileSync(join(ROOT, "platforms.json"), "utf8"));
    cache = raw.platforms;
    return cache;
}
export function v1Platforms() {
    return loadPlatforms().filter((p) => p.tier === "v1");
}
export function rssPlatforms(ids) {
    const all = loadPlatforms().filter((p) => p.access === "rss" && p.rss);
    if (!ids?.length) {
        // Default digest: core v1 boards only (FL / Freelance.ru / Weblancer).
        return all.filter((p) => p.tier === "v1");
    }
    return all.filter((p) => ids.includes(p.id));
}
