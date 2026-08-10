#!/usr/bin/env node
/**
 * Sign in to Workopia and store the grant in mcp/data/workopia-tokens.json.
 *
 *   npm run build
 *   npm run workopia:login
 *
 * There is no API key to paste: the board's MCP server advertises OAuth 2.0
 * with dynamic client registration and PKCE. This registers a client, prints
 * the authorize URL, and catches the redirect on 127.0.0.1 — the password is
 * typed in the browser and never passes through here.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mod = join(root, "dist", "adapters", "workopia.js");
if (!existsSync(mod)) {
  console.error("Build first: npm run build");
  process.exit(1);
}

const { loadEnv } = await import(pathToFileURL(join(root, "dist", "env.js")).href);
const { workopiaLogin } = await import(pathToFileURL(mod).href);
loadEnv();

const r = await workopiaLogin();
if (!r.ok) {
  console.error(`\nSign-in failed: ${r.error}`);
  process.exit(1);
}
console.log("\nSigned in. Token stored in mcp/data/workopia-tokens.json.");
console.log("Set a city too — WORKOPIA_CITY, or `city: Berlin` in mcp/profile.md.");
