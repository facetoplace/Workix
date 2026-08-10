import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import { join } from "node:path";
import { callMcpTool } from "../mcpClient.js";
import { loadProfile } from "../profile.js";
import { dataDir, jobId } from "../store.js";
/**
 * Workopia — ATS aggregation (Lever, Greenhouse, Workday, employer career
 * pages) across 90+ countries, reached through its own MCP server.
 *
 * Half-open: `tools/list` answers anonymously, but `tools/call` comes back
 * with JSON-RPC -32001 "Authentication required. Sign in with Workopia to
 * continue." (verified 2026-08-10). The account is free.
 *
 * There is no API key to copy from a dashboard — the server advertises
 * OAuth 2.0 with Dynamic Client Registration and PKCE, as a public client:
 *
 *   registration_endpoint            https://workopia.io/api/oauth/register
 *   authorization_endpoint           https://workopia.io/oauth/authorize
 *   token_endpoint                   https://workopia.io/api/oauth/token
 *   token_endpoint_auth_methods      ["none"]         (no client secret)
 *   code_challenge_methods           ["S256"]
 *
 * So the token has to be earned by running the flow: `npm run workopia:login`
 * registers a client, opens the browser, catches the redirect on localhost and
 * stores the result in mcp/data/workopia-tokens.json. Refresh is automatic
 * afterwards. WORKOPIA_TOKEN stays supported as an escape hatch for a token
 * obtained some other way.
 */
const MCP_URL = "https://workopia.io/api/mcp-jobs";
const REGISTER_URL = "https://workopia.io/api/oauth/register";
const AUTHORIZE_URL = "https://workopia.io/oauth/authorize";
const TOKEN_URL = "https://workopia.io/api/oauth/token";
const SCOPES = "profile:read applications:read applications:write";
const CALLBACK_PORT = Number(process.env.WORKOPIA_CALLBACK_PORT) || 51987;
const REDIRECT_URI = `http://127.0.0.1:${CALLBACK_PORT}/callback`;
function pickCards(payload) {
    if (!payload || typeof payload !== "object")
        return [];
    const p = payload;
    // The tool answers with job_cards[].card per its own schema, but the wrapper
    // key has moved before; accept the obvious shapes rather than one literal.
    const buckets = [p.job_cards, p.jobs, p.results, p.data];
    for (const b of buckets) {
        if (!Array.isArray(b))
            continue;
        return b.map((row) => {
            const r = row;
            return (r.card && typeof r.card === "object" ? r.card : r);
        });
    }
    return [];
}
function companyOf(c) {
    if (typeof c.company === "string")
        return c.company;
    if (c.company && typeof c.company === "object")
        return c.company.name;
    return c.company_name;
}
function tokenPath() {
    return join(dataDir(), "workopia-tokens.json");
}
function readTokens() {
    const p = tokenPath();
    if (!existsSync(p))
        return undefined;
    try {
        return JSON.parse(readFileSync(p, "utf8"));
    }
    catch {
        return undefined;
    }
}
function writeTokens(t) {
    const dir = dataDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(tokenPath(), JSON.stringify(t, null, 2), "utf8");
}
async function refresh(t) {
    if (!t.refresh_token)
        return undefined;
    const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: t.refresh_token,
            client_id: t.client_id,
        }),
    });
    if (!res.ok)
        return undefined;
    const j = (await res.json());
    if (!j.access_token)
        return undefined;
    const next = {
        client_id: t.client_id,
        access_token: j.access_token,
        refresh_token: j.refresh_token || t.refresh_token,
        expires_at: j.expires_in ? Date.now() + j.expires_in * 1000 : undefined,
    };
    writeTokens(next);
    return next;
}
/**
 * The env var wins when set — it is the escape hatch. Otherwise use the stored
 * grant, refreshing a minute before expiry so a long digest does not die
 * halfway through.
 */
export async function workopiaToken() {
    const fromEnv = process.env.WORKOPIA_TOKEN?.trim();
    if (fromEnv)
        return fromEnv;
    const stored = readTokens();
    if (!stored?.access_token)
        return undefined;
    if (stored.expires_at && stored.expires_at - Date.now() < 60_000) {
        const fresh = await refresh(stored);
        return fresh?.access_token;
    }
    return stored.access_token;
}
/** Cheap sync check for `configured()` — does not touch the network. */
export function workopiaConfigured() {
    return Boolean(process.env.WORKOPIA_TOKEN?.trim() || readTokens()?.access_token);
}
/**
 * Full DCR + PKCE login, driven from the terminal by scripts/workopia-login.mjs.
 * Registers a fresh public client, waits on a loopback redirect for the code,
 * and exchanges it. Nothing is stored until the exchange succeeds.
 */
export async function workopiaLogin() {
    const reg = await fetch(REGISTER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            client_name: "Workix MCP",
            redirect_uris: [REDIRECT_URI],
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
            token_endpoint_auth_method: "none",
            scope: SCOPES,
        }),
    });
    if (!reg.ok) {
        return { ok: false, error: `register HTTP ${reg.status}: ${(await reg.text()).slice(0, 200)}` };
    }
    const { client_id: clientId } = (await reg.json());
    if (!clientId)
        return { ok: false, error: "register returned no client_id" };
    const verifier = randomBytes(48).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const state = randomBytes(16).toString("base64url");
    const authorizeUrl = `${AUTHORIZE_URL}?` +
        new URLSearchParams({
            response_type: "code",
            client_id: clientId,
            redirect_uri: REDIRECT_URI,
            scope: SCOPES,
            state,
            code_challenge: challenge,
            code_challenge_method: "S256",
        });
    console.log(`\nOpen this in a browser and sign in to Workopia:\n\n${authorizeUrl}\n`);
    const code = await waitForCode(state);
    if (!code.ok)
        return { ok: false, authorizeUrl, error: code.error };
    const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "authorization_code",
            code: code.value,
            redirect_uri: REDIRECT_URI,
            client_id: clientId,
            code_verifier: verifier,
        }),
    });
    if (!res.ok) {
        return { ok: false, error: `token HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
    }
    const j = (await res.json());
    if (!j.access_token)
        return { ok: false, error: "token response had no access_token" };
    writeTokens({
        client_id: clientId,
        access_token: j.access_token,
        refresh_token: j.refresh_token,
        expires_at: j.expires_in ? Date.now() + j.expires_in * 1000 : undefined,
    });
    return { ok: true };
}
function waitForCode(state) {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            const url = new URL(req.url || "/", `http://127.0.0.1:${CALLBACK_PORT}`);
            if (url.pathname !== "/callback") {
                res.writeHead(404).end();
                return;
            }
            const code = url.searchParams.get("code");
            const got = url.searchParams.get("state");
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(code && got === state
                ? "<p>Workix: signed in. You can close this tab.</p>"
                : "<p>Workix: sign-in failed. Check the terminal.</p>");
            server.close();
            if (!code)
                resolve({ ok: false, error: url.searchParams.get("error") || "no code in redirect" });
            // A mismatched state means the redirect did not come from our request.
            else if (got !== state)
                resolve({ ok: false, error: "state mismatch — redirect not ours" });
            else
                resolve({ ok: true, value: code });
        });
        server.listen(CALLBACK_PORT, "127.0.0.1", () => {
            console.log(`Waiting for the redirect on ${REDIRECT_URI} …`);
        });
        setTimeout(() => {
            server.close();
            resolve({ ok: false, error: "timed out after 5 minutes" });
        }, 5 * 60_000).unref();
    });
}
/**
 * Where to search. Explicit argument wins, then the env override, then the
 * operator's own profile — a job seeker has already written down where they
 * are, and making them repeat it in a second place is how the board ends up
 * silently disabled.
 *
 * "Remote"/"Worldwide" are passed through as-is: Workopia documents no
 * wildcard, and `*` is a guess, so we send the words a human would type and
 * let the board answer. Verify against a live token before relying on it.
 */
export function resolveCity(explicit) {
    const direct = explicit?.trim() || process.env.WORKOPIA_CITY?.trim();
    if (direct)
        return direct;
    return cityFromProfile();
}
export function cityFromProfile() {
    let text;
    try {
        text = loadProfile();
    }
    catch {
        return undefined;
    }
    // Explicit key first — `city: Berlin` in the profile is unambiguous.
    const key = text.match(/^\s*(?:city|город|location|локация)\s*:\s*(.+)$/im);
    if (key?.[1])
        return cleanCity(key[1]);
    // Then the human line the example profile ships with: "Гео / язык: RU, EN".
    const geo = text.match(/^\s*[-*]?\s*(?:Гео|Geo)\s*(?:\/[^:]*)?:\s*(.+)$/im);
    if (geo?.[1])
        return cleanCity(geo[1]);
    return undefined;
}
function cleanCity(raw) {
    const first = raw
        .split(/[,/|]/)[0]
        .replace(/[…\s]+$/g, "")
        .trim();
    // The example profile ships placeholders; treat them as "not filled in".
    if (!first || /^[.…]+$/.test(first))
        return undefined;
    // "Гео / язык: RU, EN" is a country and a language, not a city. Sending "RU"
    // as a city yields nonsense, and nonsense results are worse than a skip with
    // a message telling the operator to write a real city.
    if (/^[A-Z]{2}$/.test(first))
        return undefined;
    return first;
}
export async function fetchWorkopiaJobs(opts) {
    const token = await workopiaToken();
    if (!token) {
        return {
            jobs: [],
            error: "workopia: optional — not signed in. There is no API key to copy: the " +
                "board uses OAuth with dynamic client registration. Run " +
                "`npm run workopia:login` once (free account), or set WORKOPIA_TOKEN " +
                "if you already hold a bearer token.",
        };
    }
    const city = resolveCity(opts?.city);
    if (!city) {
        return {
            jobs: [],
            error: "workopia: optional — no city to search. Its job_tool requires one, " +
                "and an empty value returns nothing rather than searching everywhere. " +
                "Set WORKOPIA_CITY, or put `city: Berlin` (or `Remote`) in your " +
                "mcp/profile.md — the adapter also reads the `Гео / язык:` line.",
        };
    }
    const jobTitle = (opts?.keywords || []).filter(Boolean).join(" ").trim() || "developer";
    const res = await callMcpTool({
        url: MCP_URL,
        tool: "job_tool",
        token,
        args: {
            action: "search",
            search_jobs: { job_title: jobTitle, city },
        },
    });
    if (res.error)
        return { jobs: [], error: `workopia: ${res.error}` };
    if (res.isError) {
        return { jobs: [], error: `workopia: ${(res.text || "rejected").slice(0, 300)}` };
    }
    const cards = pickCards(res.structured ?? res.data);
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const now = new Date().toISOString();
    const jobs = [];
    for (const c of cards.slice(0, limit)) {
        const link = c.apply_url || c.job_url || c.url;
        const title = c.title || c.job_title;
        if (!link || !title)
            continue;
        jobs.push({
            id: jobId("workopia", c.id || link),
            platform: "workopia",
            kind: "job",
            title,
            description: (c.description || c.snippet || "")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 4000),
            link,
            date: c.posted_at || c.posted_date || now,
            budget: c.salary?.trim() || undefined,
            fetchedAt: now,
            raw: { company: companyOf(c), location: c.location, city },
        });
    }
    if (!jobs.length && cards.length) {
        return { jobs: [], error: "workopia: cards returned but none had a title and an apply URL" };
    }
    return { jobs };
}
