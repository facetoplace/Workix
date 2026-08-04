#!/usr/bin/env node
/**
 * Search curated TG channels for mobile / lead / startup roles.
 *   node scripts/tg-search-me.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const MCP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(MCP_ROOT);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PAUSE_MS = Number(process.env.TG_CHECK_PAUSE_MS || 7500);
const LIMIT = Number(process.env.TG_PEEK_LIMIT || 4);

const ORDER = [
  "dartlang_jobs",
  "mobjobskz",
  "fintech_vacancy",
  "startupfellows",
  "startup_job_russia",
  "hireproproduct",
  "siliconpravdachat",
  "productradar_official",
  "it_vakansii_jobs",
  "jobs_in_it_remoute",
  "digital_hr",
  "getitrussia",
  "choicy_work",
  "workayte",
  "fordev",
  "remocate",
  "theyseeku_it",
  "flutter_react_native_job",
  "mnogovakansiy",
  "javascript_jobs",
  "web3hiring",
];
const QUERIES = ["Flutter", "мобильн", "тимлид"];

async function main() {
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

  const plan = [];
  for (const id of ORDER) {
    for (const q of QUERIES) plan.push([id, q]);
  }

  const out = [];
  for (let i = 0; i < plan.length; i++) {
    const [id, q] = plan[i];
    process.stdout.write(`[${i + 1}/${plan.length}] ${id} "${q}" `);
    try {
      const hits = await searchChat(`https://t.me/${id}`, q, LIMIT);
      console.log(hits.length);
      out.push({
        id,
        q,
        count: hits.length,
        hits: hits.map((h) => ({
          title: h.title.slice(0, 120),
          link: h.link,
          date: h.date,
          sn: h.description.replace(/\s+/g, " ").slice(0, 240),
        })),
      });
    } catch (e) {
      const msg = e?.message || String(e);
      console.log("ERR", msg);
      out.push({ id, q, error: msg });
      if (/FLOOD|WAIT|BAN|AUTH/i.test(msg)) {
        console.log("Stopping early.");
        break;
      }
    }
    if (i < plan.length - 1) await sleep(PAUSE_MS);
  }

  mkdirSync(join(MCP_ROOT, "data"), { recursive: true });
  writeFileSync(join(MCP_ROOT, "data", "tg-search-me.json"), JSON.stringify({ at: new Date().toISOString(), out }, null, 2));

  const scored = [];
  for (const block of out) {
    if (!block.hits) continue;
    for (const h of block.hits) {
      const t = `${h.title} ${h.sn}`.toLowerCase();
      let score = 0;
      if (/flutter/.test(t)) score += 5;
      if (/react\s*native|\brn\b/.test(t)) score += 4;
      if (/мобильн|mobile|\bios\b|android|приложен/.test(t)) score += 3;
      if (/тимлид|tech\s*lead|team\s*lead|lead\b/.test(t)) score += 4;
      if (/кофаундер|co-?founder|founding|\bcto\b|\bmvp\b|набираю/.test(t)) score += 3;
      if (/#кандидат|#резюме|ищу работу|ищу работу/.test(t)) score -= 3;
      const age = (Date.now() - new Date(h.date).getTime()) / 86400000;
      if (age <= 14) score += 3;
      else if (age <= 45) score += 1;
      else if (age > 120) score -= 2;
      if (score >= 5) {
        scored.push({ score, chat: block.id, q: block.q, age_d: Math.round(age), ...h });
      }
    }
  }
  scored.sort((a, b) => b.score - a.score || a.age_d - b.age_d);
  const uniq = [];
  const seen = new Set();
  for (const s of scored) {
    if (seen.has(s.link)) continue;
    seen.add(s.link);
    uniq.push(s);
  }

  console.log("\n=== TOP ===");
  for (const s of uniq.slice(0, 20)) {
    console.log(`${s.score} ${s.age_d}d @${s.chat} | ${s.title.slice(0, 90)}`);
    console.log(`  ${s.link}`);
    console.log(`  ${s.sn.slice(0, 180)}`);
  }

  writeFileSync(
    join(MCP_ROOT, "data", "tg-search-top.json"),
    JSON.stringify({ at: new Date().toISOString(), top: uniq.slice(0, 30) }, null, 2)
  );
  console.log(`\nSaved data/tg-search-top.json (${uniq.length} scored)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
