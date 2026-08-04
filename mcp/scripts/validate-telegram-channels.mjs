#!/usr/bin/env node
/**
 * Validate mcp/telegram-channels.example.json for community PRs.
 *   node scripts/validate-telegram-channels.mjs [path]
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MCP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = process.argv[2] || join(MCP_ROOT, "telegram-channels.example.json");

const KINDS = new Set(["gigs", "roles", "startups", "jobs_feed", "bots", "community"]);
const PRIOS = new Set(["high", "medium", "low"]);

const raw = readFileSync(path, "utf8");
const data = JSON.parse(raw);
const channels = data.channels;
if (!Array.isArray(channels) || !channels.length) {
  console.error("channels[] missing or empty");
  process.exit(1);
}

const errors = [];
const ids = new Set();
const urls = new Set();

for (let i = 0; i < channels.length; i++) {
  const c = channels[i];
  const loc = `channels[${i}]`;
  if (!c || typeof c !== "object") {
    errors.push(`${loc}: not an object`);
    continue;
  }
  if (!c.id || typeof c.id !== "string") errors.push(`${loc}: id required`);
  else if (ids.has(c.id)) errors.push(`${loc}: duplicate id "${c.id}"`);
  else ids.add(c.id);

  if (!c.title || typeof c.title !== "string") errors.push(`${loc}: title required`);
  if (!c.url || typeof c.url !== "string") errors.push(`${loc}: url required`);
  else if (!/^https:\/\/t\.me\/[A-Za-z0-9_]+$/i.test(c.url)) {
    errors.push(`${loc}: url must be https://t.me/<public_username> (got ${c.url})`);
  } else {
    if (urls.has(c.url)) errors.push(`${loc}: duplicate url`);
    else urls.add(c.url);
    const fromUrl = c.url.replace(/^https:\/\/t\.me\//i, "");
    if (c.id && fromUrl.toLowerCase() !== String(c.id).toLowerCase()) {
      console.warn(`warn ${loc}: id "${c.id}" ≠ username "${fromUrl}"`);
    }
  }
  if (!KINDS.has(c.kind)) errors.push(`${loc}: kind must be one of ${[...KINDS].join("|")}`);
  if (!PRIOS.has(c.priority)) errors.push(`${loc}: priority must be one of ${[...PRIOS].join("|")}`);
  if (c.verified_at != null && !/^\d{4}-\d{2}-\d{2}$/.test(String(c.verified_at))) {
    errors.push(`${loc}: verified_at must be YYYY-MM-DD`);
  }
  if (c.lang != null && !/^[a-z]{2}(-[A-Z]{2})?$/.test(String(c.lang))) {
    errors.push(`${loc}: lang should look like "ru" or "en"`);
  }
}

if (errors.length) {
  console.error(`FAIL ${path}\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  process.exit(1);
}

console.log(`OK ${path}: ${channels.length} channels`);
