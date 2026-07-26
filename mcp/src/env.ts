import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(ROOT, "..");

let loaded = false;

/** Load mcp/.env then repo root .env (PROXY_1, KWORK_*, etc). */
export function loadEnv(): void {
  if (loaded) return;
  const mcpEnv = join(ROOT, ".env");
  const rootEnv = join(REPO_ROOT, ".env");
  // Root first (PROXY_1), then mcp/.env overrides local MCP secrets
  if (existsSync(rootEnv)) config({ path: rootEnv, override: false });
  if (existsSync(mcpEnv)) config({ path: mcpEnv, override: true });
  loaded = true;
}

/**
 * PROXY_1 → KWORK_PROXY → WORKIX_HTTP_PROXY
 * Поддерживаются socks5://… и http://… (HTTP CONNECT proxy).
 */
export function getProxyUrl(): string | undefined {
  loadEnv();
  const raw =
    process.env.PROXY_1 ||
    process.env.KWORK_PROXY ||
    process.env.WORKIX_HTTP_PROXY ||
    "";
  const v = raw.trim();
  return v || undefined;
}
