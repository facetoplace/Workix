import { getAdapter } from "../adapterLoader.js";
import { loadEnv } from "../env.js";

export async function runUpworkAuthUrl(): Promise<unknown> {
  loadEnv();
  if (!process.env.UPWORK_CLIENT_ID?.trim()) {
    return {
      error: "Задай UPWORK_CLIENT_ID и UPWORK_CLIENT_SECRET в mcp/.env",
      steps: [
        "1. https://www.upwork.com/developer/keys/apply — создать app",
        "2. GraphQL permissions: Read marketplace Job Postings (+ Submit Proposal если нужен API apply)",
        "3. Redirect URI = UPWORK_REDIRECT_URI (default http://127.0.0.1:3456/callback)",
      ],
    };
  }
  const mod = await getAdapter("upwork");
  if (!mod) {
    return { error: "Upwork adapter module failed to install from registry" };
  }
  const configured =
    typeof mod.configured === "function" ? mod.configured() : false;
  const authUrl = mod.authUrl as
    | ((state?: string) => {
        url: string;
        redirect_uri: string;
        note: string;
      })
    | undefined;
  if (!authUrl) return { error: "adapter missing authUrl()" };
  return {
    configured_tokens: configured,
    ...authUrl(),
    next: [
      "Открой url в браузере, разреши доступ.",
      "Из redirect скопируй code.",
      "Вызови workix_upwork_exchange_code с этим code.",
      "Токены сохранятся в mcp/data/upwork-tokens.json (не коммить).",
    ],
  };
}

export async function runUpworkExchangeCode(args: {
  code: string;
}): Promise<unknown> {
  const code = args.code?.trim();
  if (!code) return { error: "code обязателен" };
  const mod = await getAdapter("upwork");
  if (!mod) {
    return { ok: false, error: "Upwork adapter unavailable" };
  }
  const exchangeCode = mod.exchangeCode as
    | ((
        c: string,
      ) => Promise<{ ok: boolean; error?: string; expires_in?: number }>)
    | undefined;
  const companySelector = mod.companySelector as
    | (() => Promise<unknown>)
    | undefined;
  if (!exchangeCode) return { ok: false, error: "adapter missing exchangeCode" };
  const r = await exchangeCode(code);
  if (!r.ok) return { ok: false, error: r.error };
  const orgs = companySelector ? await companySelector() : null;
  return {
    ok: true,
    expires_in: r.expires_in,
    token_file: "mcp/data/upwork-tokens.json",
    company_selector: orgs,
    hint: "Положи organizationId в UPWORK_TEAM_ORG_ID / UPWORK_TENANT_ID для X-Upwork-API-TenantId.",
  };
}
