#!/usr/bin/env node
// Dump the live tools/list from the built MCP server to JSON.
// Usage: node scripts/dump-tools.mjs [out.json]
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(here, "..", "dist", "index.js");
const out = process.argv[2] || path.join(here, "..", "..", ".tmp", "tools.json");

const child = spawn(process.execPath, [entry], {
  stdio: ["pipe", "pipe", "inherit"],
  env: { ...process.env, WORKIX_API: process.env.WORKIX_API || "https://workix.co" },
});

const send = (msg) => child.stdin.write(JSON.stringify(msg) + "\n");

let buf = "";
const pending = new Map();
child.stdout.on("data", (chunk) => {
  buf += chunk.toString();
  let nl;
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

const rpc = (method, params) =>
  new Promise((resolve) => {
    const id = Math.floor(performance.now() * 1000) % 1e9;
    pending.set(id, resolve);
    send({ jsonrpc: "2.0", id, method, params });
  });

const init = await rpc("initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "dump-tools", version: "1.0.0" },
});
send({ jsonrpc: "2.0", method: "notifications/initialized" });

const list = await rpc("tools/list", {});
const tools = list?.result?.tools || [];

writeFileSync(out, JSON.stringify({ server: init?.result?.serverInfo, tools }, null, 2));
console.log(`server: ${init?.result?.serverInfo?.name} ${init?.result?.serverInfo?.version}`);
console.log(`tools:  ${tools.length} -> ${out}`);
child.kill();
