import { verifySession } from "../adapters/hh.js";
import { jarStatus } from "../cookies.js";

export async function runHhStatus(): Promise<unknown> {
  const jar = jarStatus("hh");
  const probe = await verifySession();

  return {
    module: "hh",
    session: {
      file: jar.path,
      exists: jar.exists,
      cookies: jar.count,
      saved_at: jar.updated,
      expires_soonest: jar.expires_soonest,
    },
    authorized: probe.authorized,
    user_type: probe.userType,
    http_status: probe.status,
    api_token: Boolean(process.env.HH_APP_TOKEN?.trim()),
    note:
      "Сессия только локальная (mcp/data/cookies/hh.json) — на workix.co не уходит. " +
      "api.hh.ru анонимно отдаёт 403, поэтому поиск идёт через залогиненный hh.ru.",
    next: probe.authorized
      ? "workix_digest include_jobs:true (платформа hh)"
      : probe.hint || "cd mcp && npm run hh:login",
  };
}
