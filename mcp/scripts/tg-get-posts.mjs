#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

const MCP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(MCP_ROOT);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const POSTS = [
  ["jobs_in_it_remoute", 38431],
  ["theyseeku_it", 5600],
  ["fordev", 57279],
  ["jobs_in_it_remoute", 38232],
  ["startupfellows", 3419],
  ["siliconpravdachat", 191189],
  ["it_vakansii_jobs", 3056],
  ["remocate", 5756],
  ["startupfellows", 3420],
];

function extractEntities(m) {
  const entities = [];
  for (const e of m.entities || []) {
    const cls = e?.className || e?.constructor?.name || "";
    const row = { cls, offset: e.offset, length: e.length };
    if (e.url) row.url = e.url;
    if (e.userId) row.userId = String(e.userId);
    if (e.username) row.username = e.username;
    entities.push(row);
  }
  const buttons = [];
  const rows = m.replyMarkup?.rows || [];
  for (const row of rows) {
    for (const b of row.buttons || []) {
      buttons.push({
        text: b.text,
        url: b.url,
        data: b.data ? String(b.data) : undefined,
      });
    }
  }
  return { entities, buttons };
}

async function main() {
  const { loadEnv } = await import(pathToFileURL(join(MCP_ROOT, "dist/env.js")).href);
  loadEnv();
  const { tgApiId, tgApiHash } = await import(
    pathToFileURL(join(MCP_ROOT, "dist/telegram/credentials.js")).href
  );
  const client = new TelegramClient(
    new StringSession(readFileSync(join(MCP_ROOT, "data/telegram/gramjs.session"), "utf8").trim()),
    tgApiId(),
    tgApiHash(),
    { connectionRetries: 3 }
  );
  await client.connect();

  const out = [];
  for (const [username, id] of POSTS) {
    try {
      const entity = await client.getEntity(username);
      const msgs = await client.getMessages(entity, { ids: [id] });
      const m = msgs[0];
      if (!m) {
        out.push({ username, id, missing: true });
        console.log("MISS", username, id);
      } else {
        const text = m.message || "";
        const { entities, buttons } = extractEntities(m);
        let from = null;
        try {
          if (m.fromId) {
            const u = await client.getEntity(m.fromId);
            from = {
              id: String(u.id),
              username: u.username || null,
              firstName: u.firstName || null,
              lastName: u.lastName || null,
            };
          }
        } catch {
          /* ignore */
        }
        const urls = [
          ...[...text.matchAll(/https?:\/\/\S+/g)].map((x) => x[0]),
          ...entities.filter((e) => e.url).map((e) => e.url),
          ...buttons.filter((b) => b.url).map((b) => b.url),
        ];
        const tgs = [
          ...[...text.matchAll(/@[A-Za-z0-9_]{3,}/g)].map((x) => x[0]),
          ...entities.filter((e) => e.username).map((e) => `@${e.username}`),
        ];
        out.push({
          username,
          id,
          date: m.date,
          text,
          from,
          urls: [...new Set(urls)],
          tgs: [...new Set(tgs)],
          entities,
          buttons,
        });
        console.log(
          "OK",
          username,
          id,
          "from=",
          from?.username || from?.id || "-",
          "urls=",
          urls.length,
          "btns=",
          buttons.length
        );
      }
    } catch (e) {
      out.push({ username, id, error: e?.message || String(e) });
      console.log("ERR", username, id, e?.message || e);
    }
    await sleep(3500);
  }

  mkdirSync(join(MCP_ROOT, "data"), { recursive: true });
  writeFileSync(join(MCP_ROOT, "data/tg-posts-detail.json"), JSON.stringify(out, null, 2));
  await client.disconnect();
  console.log("saved");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
