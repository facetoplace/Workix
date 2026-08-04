#!/usr/bin/env node
/**
 * Slow peek of telegram channels (pauses between chats to reduce flood risk).
 *   node scripts/tg-peek.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const MCP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(MCP_ROOT);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PAUSE_MS = Number(process.env.TG_PEEK_PAUSE_MS || 12000);
const LIMIT = Number(process.env.TG_PEEK_LIMIT || 5);

async function main() {
  const { loadEnv } = await import(pathToFileURL(join(MCP_ROOT, "dist/env.js")).href);
  loadEnv();
  const { searchChat, getAuthState } = await import(
    pathToFileURL(join(MCP_ROOT, "dist/telegram/backend.js")).href
  );
  const { loadTgChannels } = await import(
    pathToFileURL(join(MCP_ROOT, "dist/telegram/channels.js")).href
  );

  const auth = await getAuthState();
  console.log("auth", auth.state, auth.backend || "", auth.raw || "");
  if (auth.state !== "ready") {
    console.error("Not ready:", auth.hint);
    process.exit(1);
  }

  // Prefer personal telegram-channels.json, else example
  const listed = loadTgChannels();
  const channels = listed.channels.filter((c) => c.url && !String(c.url).endsWith("t.me/"));
  console.log(`channels=${channels.length} pause=${PAUSE_MS}ms limit/chat=${LIMIT}\n`);

  const digest = [];

  for (let i = 0; i < channels.length; i++) {
    const ch = channels[i];
    console.log(`\n=== [${i + 1}/${channels.length}] ${ch.title || ch.id} (${ch.url}) ===`);
    try {
      // empty query = recent history
      const hits = await searchChat(ch.url, "", LIMIT);
      if (!hits.length) {
        console.log("(пусто или нет доступа)");
        digest.push({ chat: ch.id, count: 0, note: "empty/no access" });
      } else {
        for (const h of hits) {
          console.log(`- ${h.date.slice(0, 16)} | ${h.title.slice(0, 100)}`);
          console.log(`  ${h.link}`);
          console.log(`  ${h.description.replace(/\s+/g, " ").slice(0, 220)}`);
        }
        digest.push({
          chat: ch.id,
          count: hits.length,
          samples: hits.map((h) => ({
            title: h.title.slice(0, 120),
            link: h.link,
            date: h.date,
            snippet: h.description.replace(/\s+/g, " ").slice(0, 200),
          })),
        });
      }
    } catch (e) {
      const msg = e?.message || String(e);
      console.log("ERROR:", msg);
      digest.push({ chat: ch.id, error: msg });
      if (/FLOOD|WAIT|BAN|AUTH/i.test(msg)) {
        console.log("Stopping early due to rate-limit/auth signal.");
        break;
      }
    }

    if (i < channels.length - 1) {
      console.log(`… pause ${PAUSE_MS / 1000}s`);
      await sleep(PAUSE_MS);
    }
  }

  const out = join(MCP_ROOT, "data", "tg-peek-last.json");
  const { writeFileSync, mkdirSync } = await import("node:fs");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), digest }, null, 2));
  console.log(`\nSaved ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
