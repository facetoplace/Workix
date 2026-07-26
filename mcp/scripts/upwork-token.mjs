#!/usr/bin/env node
/**
 * Exchange Upwork OAuth code → mcp/data/upwork-tokens.json
 *
 *   npm run build
 *   npm run upwork:token -- <authorization_code>
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const code = process.argv[2];
if (!code) {
  console.error("Usage: npm run upwork:token -- <authorization_code>");
  process.exit(1);
}

const mod = join(root, "dist", "adapters", "upwork.js");
if (!existsSync(mod)) {
  console.error("Сначала: npm run build");
  process.exit(1);
}

const { loadEnv } = await import(pathToFileURL(join(root, "dist", "env.js")).href);
const { upworkExchangeCode, upworkCompanySelector } = await import(
  pathToFileURL(mod).href
);
loadEnv();
const r = await upworkExchangeCode(code);
console.log(JSON.stringify(r, null, 2));
if (!r.ok) process.exit(1);
const orgs = await upworkCompanySelector();
console.log(JSON.stringify({ company_selector: orgs }, null, 2));
