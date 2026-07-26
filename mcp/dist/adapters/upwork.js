import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnv } from "../env.js";
import { dataDir, jobId } from "../store.js";
const GRAPHQL = "https://api.upwork.com/graphql";
const TOKEN_URL = "https://www.upwork.com/api/v3/oauth2/token";
const AUTH_URL = "https://www.upwork.com/ab/account-security/oauth2/authorize";
function tokenFile() {
    return join(dataDir(), "upwork-tokens.json");
}
let memoryTokens = null;
export function upworkConfigured() {
    loadEnv();
    return Boolean(process.env.UPWORK_CLIENT_ID?.trim() &&
        process.env.UPWORK_CLIENT_SECRET?.trim() &&
        (process.env.UPWORK_ACCESS_TOKEN?.trim() ||
            process.env.UPWORK_REFRESH_TOKEN?.trim() ||
            loadTokenFile()?.access_token ||
            loadTokenFile()?.refresh_token));
}
function loadTokenFile() {
    try {
        const path = tokenFile();
        if (!existsSync(path))
            return null;
        return JSON.parse(readFileSync(path, "utf8"));
    }
    catch {
        return null;
    }
}
function saveTokenFile(t) {
    const dir = dataDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(tokenFile(), JSON.stringify({ ...t, updated_at: new Date().toISOString() }, null, 2), "utf8");
    memoryTokens = t;
}
function currentTokens() {
    loadEnv();
    const file = loadTokenFile();
    const mem = memoryTokens || file;
    return {
        access_token: mem?.access_token || process.env.UPWORK_ACCESS_TOKEN?.trim() || "",
        refresh_token: mem?.refresh_token || process.env.UPWORK_REFRESH_TOKEN?.trim() || "",
        expires_at: mem?.expires_at,
    };
}
export function upworkAuthUrl(state = "workix") {
    loadEnv();
    const clientId = process.env.UPWORK_CLIENT_ID?.trim() || "";
    const redirect = process.env.UPWORK_REDIRECT_URI?.trim() ||
        "http://127.0.0.1:3456/callback";
    const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirect,
        state,
    });
    return {
        url: `${AUTH_URL}?${params}`,
        redirect_uri: redirect,
        note: "Открой url, авторизуйся, скопируй ?code= из redirect. Затем workix_upwork_exchange_code или скрипт npm run upwork:token.",
    };
}
export async function upworkExchangeCode(code) {
    loadEnv();
    const clientId = process.env.UPWORK_CLIENT_ID?.trim();
    const clientSecret = process.env.UPWORK_CLIENT_SECRET?.trim();
    const redirect = process.env.UPWORK_REDIRECT_URI?.trim() ||
        "http://127.0.0.1:3456/callback";
    if (!clientId || !clientSecret) {
        return { ok: false, error: "UPWORK_CLIENT_ID/SECRET missing" };
    }
    const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirect,
    });
    return persistTokenResponse(await postForm(TOKEN_URL, body));
}
async function refreshAccessToken() {
    loadEnv();
    const clientId = process.env.UPWORK_CLIENT_ID?.trim();
    const clientSecret = process.env.UPWORK_CLIENT_SECRET?.trim();
    const tokens = currentTokens();
    if (!clientId || !clientSecret) {
        return { ok: false, error: "UPWORK_CLIENT_ID/SECRET missing" };
    }
    if (!tokens.refresh_token) {
        if (tokens.access_token) {
            return { ok: true, access_token: tokens.access_token };
        }
        return { ok: false, error: "UPWORK_REFRESH_TOKEN / ACCESS_TOKEN missing" };
    }
    const stillValid = tokens.access_token &&
        tokens.expires_at &&
        tokens.expires_at > Date.now() + 60_000;
    if (stillValid) {
        return { ok: true, access_token: tokens.access_token };
    }
    const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
    });
    const r = await persistTokenResponse(await postForm(TOKEN_URL, body));
    if (!r.ok)
        return { ok: false, error: r.error };
    return { ok: true, access_token: currentTokens().access_token };
}
async function persistTokenResponse(res) {
    if (!res.ok || !res.data?.access_token) {
        return {
            ok: false,
            error: res.error || "token exchange failed",
        };
    }
    const prev = currentTokens();
    const expiresIn = Number(res.data.expires_in || 86400);
    saveTokenFile({
        access_token: String(res.data.access_token),
        refresh_token: res.data.refresh_token
            ? String(res.data.refresh_token)
            : prev.refresh_token,
        expires_at: Date.now() + expiresIn * 1000,
    });
    return { ok: true, expires_in: expiresIn };
}
async function postForm(url, body) {
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Accept: "application/json",
            },
            body: body.toString(),
        });
        const text = await res.text();
        let data = {};
        try {
            data = JSON.parse(text);
        }
        catch {
            /* ignore */
        }
        if (!res.ok) {
            return {
                ok: false,
                error: `HTTP ${res.status}: ${text.slice(0, 400)}`,
                data,
            };
        }
        return { ok: true, data };
    }
    catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
}
async function graphql(query, variables) {
    const tok = await refreshAccessToken();
    if (!tok.ok || !tok.access_token) {
        return { error: tok.error || "no access token" };
    }
    loadEnv();
    const headers = {
        Authorization: `Bearer ${tok.access_token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
    };
    const tenant = process.env.UPWORK_TENANT_ID?.trim() ||
        process.env.UPWORK_TEAM_ORG_ID?.trim();
    if (tenant)
        headers["X-Upwork-API-TenantId"] = tenant;
    try {
        const res = await fetch(GRAPHQL, {
            method: "POST",
            headers,
            body: JSON.stringify({ query, variables }),
        });
        const text = await res.text();
        let json = {};
        try {
            json = JSON.parse(text);
        }
        catch {
            return { error: `GraphQL non-JSON HTTP ${res.status}: ${text.slice(0, 300)}` };
        }
        if (!res.ok) {
            return {
                error: `GraphQL HTTP ${res.status}: ${text.slice(0, 400)}`,
                errors: json.errors,
            };
        }
        if (json.errors?.length) {
            return {
                error: json.errors.map((e) => e.message).join("; "),
                errors: json.errors,
                data: json.data,
            };
        }
        return { data: json.data };
    }
    catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
    }
}
const SEARCH_QUERY = `
query SearchJobs($filter: MarketplaceJobPostingsSearchFilter) {
  marketplaceJobPostingsSearch(
    marketPlaceJobFilter: $filter
    searchType: USER_JOBS_SEARCH
    sortAttributes: [{ field: RECENCY }]
  ) {
    totalCount
    edges {
      node {
        id
        title
        description
        createdDateTime
        ciphertext
        amount { displayValue currency }
        skills { name }
      }
    }
  }
}
`;
export async function fetchUpworkJobs(opts) {
    if (!upworkConfigured()) {
        return { jobs: [], error: "Upwork credentials missing (optional)" };
    }
    loadEnv();
    const q = opts?.query?.trim() ||
        process.env.UPWORK_SEARCH?.trim() ||
        "mobile OR flutter OR react native OR MVP OR telegram bot";
    const first = Math.min(Math.max(opts?.first ?? 20, 1), 50);
    const result = await graphql(SEARCH_QUERY, {
        filter: {
            searchExpression_eq: q,
            pagination_eq: { after: "0", first },
        },
    });
    if (result.error && !result.data?.marketplaceJobPostingsSearch) {
        return { jobs: [], error: result.error };
    }
    const edges = result.data?.marketplaceJobPostingsSearch?.edges || [];
    const jobs = [];
    for (const edge of edges) {
        const n = edge.node;
        if (!n?.title)
            continue;
        const cipher = n.ciphertext || n.id;
        const link = cipher
            ? `https://www.upwork.com/jobs/${cipher.startsWith("~") ? cipher : `~${cipher}`}`
            : `https://www.upwork.com/jobs/`;
        const budget = n.amount?.displayValue
            ? `${n.amount.displayValue}${n.amount.currency ? ` ${n.amount.currency}` : ""}`
            : undefined;
        jobs.push({
            id: jobId("upwork", link + (n.id || n.title)),
            platform: "upwork",
            kind: "gig",
            title: n.title,
            description: (n.description || "").slice(0, 4000),
            link,
            date: n.createdDateTime || new Date().toISOString(),
            budget,
            fetchedAt: new Date().toISOString(),
            raw: n,
        });
    }
    return {
        jobs,
        totalCount: result.data?.marketplaceJobPostingsSearch?.totalCount,
        error: result.error,
    };
}
export async function upworkCompanySelector() {
    const r = await graphql(`query { companySelector { items { title organizationId } } }`);
    if (r.error && !r.data?.companySelector) {
        return { ok: false, error: r.error };
    }
    return { ok: true, items: r.data?.companySelector?.items || [] };
}
/** Best-effort createJobProposal; needs Submit Proposal permission + IDs in env. */
export async function upworkCreateProposal(opts) {
    loadEnv();
    const contractorId = process.env.UPWORK_CONTRACTOR_ID?.trim();
    const oDeskUserID = process.env.UPWORK_ODESK_USER_ID?.trim();
    const teamOrgId = process.env.UPWORK_TEAM_ORG_ID?.trim() ||
        process.env.UPWORK_TENANT_ID?.trim();
    if (!contractorId || !oDeskUserID || !teamOrgId) {
        return {
            ok: false,
            error: "Для API-proposal нужны UPWORK_CONTRACTOR_ID, UPWORK_ODESK_USER_ID, UPWORK_TEAM_ORG_ID (см. companySelector / docs).",
            browserHint: "browser",
        };
    }
    const mutation = `
    mutation createJobProposal($input: CreateJobProposalInput!) {
      createJobProposal(input: $input) {
        newProposalId
        status
        error
      }
    }
  `;
    const r = await graphql(mutation, {
        input: {
            selectedContractor: { id: contractorId, oDeskUserID },
            jobReference: opts.jobReference,
            chargedAmount: opts.chargedAmount,
            coverLetter: opts.coverLetter,
            teamOrgId,
            estimatedDuration: opts.estimatedDuration ?? 7,
        },
    });
    if (r.error) {
        return { ok: false, error: r.error, raw: r.errors, browserHint: "browser" };
    }
    const status = r.data?.createJobProposal?.status;
    if (status && status !== "SUCCESS" && status !== "OK") {
        return {
            ok: false,
            error: `status=${status} error=${r.data?.createJobProposal?.error || "?"}`,
            raw: r.data,
            browserHint: "browser",
        };
    }
    return { ok: true, raw: r.data };
}
export function upworkJobReference(job) {
    const raw = job.raw;
    return raw?.ciphertext || raw?.id;
}
