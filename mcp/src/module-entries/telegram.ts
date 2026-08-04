import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import { fetchTelegramJobs } from "../adapters/telegram.js";

export const meta: AdapterMeta = {
  id: "telegram",
  version: "1.0.0",
  platforms: ["telegram"],
  envKeys: ["TELEGRAM_API_ID", "TELEGRAM_API_HASH", "TG_APP_API_ID", "TG_APP_API_HASH"],
};

export function configured() {
  const id = Number(
    process.env.TELEGRAM_API_ID ||
      process.env.TG_APP_API_ID ||
      process.env.TG_API_ID ||
      0,
  );
  const hash = String(
    process.env.TELEGRAM_API_HASH ||
      process.env.TG_APP_API_HASH ||
      process.env.TG_API_HASH ||
      "",
  ).trim();
  return id > 0 && hash.length >= 16;
}

export async function fetchJobs(
  _ctx: AdapterContext,
  opts?: Record<string, unknown>,
) {
  const keywords = Array.isArray(opts?.keywords)
    ? (opts!.keywords as string[])
    : undefined;
  return fetchTelegramJobs({
    keywords,
    limit: typeof opts?.limit === "number" ? opts.limit : undefined,
  });
}
