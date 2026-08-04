#!/usr/bin/env node
/**
 * Verify a list of TG usernames (slow, paused).
 *   node scripts/tg-check-usernames.mjs user1 user2 ...
 *   TG_CHECK_PAUSE_MS=10000 TG_PEEK_LIMIT=3 node scripts/tg-check-usernames.mjs …
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const MCP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(MCP_ROOT);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PAUSE_MS = Number(process.env.TG_CHECK_PAUSE_MS || 10000);
const LIMIT = Number(process.env.TG_PEEK_LIMIT || 3);

async function main() {
  const users = process.argv.slice(2).map((u) => u.replace(/^@/, "").trim()).filter(Boolean);
  if (!users.length) {
    console.error("Usage: node scripts/tg-check-usernames.mjs user1 user2 …");
    process.exit(2);
  }

  const { loadEnv } = await import(pathToFileURL(join(MCP_ROOT, "dist/env.js")).href);
  loadEnv();
  const { searchChat, getAuthState } = await import(
    pathToFileURL(join(MCP_ROOT, "dist/telegram/backend.js")).href
  );

  const auth = await getAuthState();
  console.log("auth", auth.state, auth.backend || "");
  if (auth.state !== "ready") {
    console.error("Not ready:", auth.hint);
    process.exit(1);
  }

  const digest = [];
  for (let i = 0; i < users.length; i++) {
    const id = users[i];
    const url = `https://t.me/${id}`;
    console.log(`\n=== [${i + 1}/${users.length}] @${id} ===`);
    try {
      const hits = await searchChat(url, "", LIMIT);
      if (!hits.length) {
        console.log("(empty/no access)");
        digest.push({ id, status: "empty", count: 0 });
      } else {
        for (const h of hits) {
          console.log(`- ${h.date.slice(0, 16)} | ${h.title.slice(0, 90)}`);
          console.log(`  ${h.description.replace(/\s+/g, " ").slice(0, 180)}`);
        }
        digest.push({
          id,
          status: "ok",
          count: hits.length,
          samples: hits.map((h) => ({
            title: h.title.slice(0, 100),
            date: h.date,
            snippet: h.description.replace(/\s+/g, " ").slice(0, 160),
          })),
        });
      }
    } catch (e) {
      const msg = e?.message || String(e);
      console.log("ERROR:", msg);
      digest.push({ id, status: "error", error: msg });
      if (/FLOOD|WAIT|BAN|AUTH/i.test(msg)) {
        console.log("Stopping early.");
        break;
      }
    }
    if (i < users.length - 1) {
      console.log(`… pause ${PAUSE_MS / 1000}s`);
      await sleep(PAUSE_MS);
    }
  }

  const out = join(MCP_ROOT, "data", "tg-check-last.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), digest }, null, 2));
  console.log(`\nSaved ${out}`);
  const ok = digest.filter((d) => d.status === "ok").map((d) => d.id);
  const bad = digest.filter((d) => d.status !== "ok").map((d) => `${d.id}:${d.status}`);
  console.log("OK:", ok.join(", ") || "(none)");
  console.log("BAD:", bad.join(", ") || "(none)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
