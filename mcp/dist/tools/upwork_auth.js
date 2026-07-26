import { upworkAuthUrl, upworkCompanySelector, upworkConfigured, upworkExchangeCode, } from "../adapters/upwork.js";
import { loadEnv } from "../env.js";
export async function runUpworkAuthUrl() {
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
    return {
        configured_tokens: upworkConfigured(),
        ...upworkAuthUrl(),
        next: [
            "Открой url в браузере, разреши доступ.",
            "Из redirect скопируй code.",
            "Вызови workix_upwork_exchange_code с этим code.",
            "Токены сохранятся в mcp/data/upwork-tokens.json (не коммить).",
        ],
    };
}
export async function runUpworkExchangeCode(args) {
    const code = args.code?.trim();
    if (!code)
        return { error: "code обязателен" };
    const r = await upworkExchangeCode(code);
    if (!r.ok)
        return { ok: false, error: r.error };
    const orgs = await upworkCompanySelector();
    return {
        ok: true,
        expires_in: r.expires_in,
        token_file: "mcp/data/upwork-tokens.json",
        company_selector: orgs,
        hint: "Положи organizationId в UPWORK_TEAM_ORG_ID / UPWORK_TENANT_ID для X-Upwork-API-TenantId.",
    };
}
