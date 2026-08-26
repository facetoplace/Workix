/**
 * Terminal-only login for a gated job board (Wellfound, YC Work at a Startup, …).
 * Opens a real Chrome window with a per-jar persistent profile; YOU log in there.
 * Nothing is asked in chat and no credential is read by the agent — only the
 * resulting session cookies are saved to mcp/data/cookies/<jar>.json for the
 * adapters (cookieJar) to reuse.
 *
 *   cd mcp
 *   node scripts/board-login.mjs wellfound https://wellfound.com/login
 *   node scripts/board-login.mjs yc https://www.workatastartup.com/
 */
import { existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MCP_ROOT = join(HERE, "..");
const jar = process.argv[2];
const loginUrl = process.argv[3];
if (!jar || !loginUrl) {
  console.error("usage: node scripts/board-login.mjs <jar> <loginUrl>");
  process.exit(1);
}
const PROFILE = join(MCP_ROOT, "data", "browser", jar);
if (!existsSync(PROFILE)) mkdirSync(PROFILE, { recursive: true });

const { saveCookies, jarStatus } = await import(pathToFileURL(join(MCP_ROOT, "dist", "cookies.js")).href);

const puppeteer = (
  await import("file:///C:/Projects/Services/workix/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js")
).default;
const CHROME = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
].filter(Boolean).find((p) => existsSync(p));
if (!CHROME) { console.error("Chrome not found — set CHROME_PATH"); process.exit(1); }

console.log(`jar     : ${jar}`);
console.log(`profile : ${PROFILE}`);
console.log(`login   : ${loginUrl}`);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  userDataDir: PROFILE,
  defaultViewport: null,
  args: ["--start-maximized", "--disable-blink-features=AutomationControlled", "--no-first-run"],
});
const page = (await browser.pages())[0] || (await browser.newPage());
await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});

console.log("=".repeat(60));
console.log(`Залогинься в открывшемся окне (${jar}). Логин/пароль/2FA — только там.`);
console.log("Как войдёшь — окно можно оставить; сессия сохранится автоматически.");
console.log("=".repeat(60));

const client = await page.createCDPSession();
async function snapshotCookies() {
  const { cookies } = await client.send("Network.getAllCookies");
  return cookies.map((c) => ({
    name: c.name, value: c.value, domain: c.domain, path: c.path || "/",
    expires: c.expires && c.expires > 0 ? Math.floor(c.expires) : 0,
    httpOnly: !!c.httpOnly, secure: !!c.secure,
  }));
}
// Heuristic: consider "logged in" once a session-ish cookie appears for the host.
const AUTH_HINT = /session|token|auth|_wf|logged_in|waas|_sso|remember/i;
const host = new URL(loginUrl).hostname.replace(/^www\./, "");

const WAIT_MS = 10 * 60 * 1000, STEP = 5000;
const deadline = Date.now() + WAIT_MS;
let saved = 0;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, STEP));
  const cookies = await snapshotCookies().catch(() => []);
  const relevant = cookies.filter((c) => c.domain.replace(/^\./, "").includes(host.split(".").slice(-2).join(".")));
  const authed = relevant.some((c) => AUTH_HINT.test(c.name) && c.value.length > 8);
  if (authed) {
    saveCookies(jar, cookies);
    saved = relevant.length;
    console.log(`✓ session detected — saved ${cookies.length} cookies to jar '${jar}' (${saved} for ${host})`);
    break;
  }
  console.log(`  …ещё не залогинен (осталось ${Math.round((deadline - Date.now()) / 1000)}с)`);
}
if (!saved) {
  // Save whatever we have so a partial session is still usable, then report.
  const cookies = await snapshotCookies().catch(() => []);
  if (cookies.length) saveCookies(jar, cookies);
  console.log(`saved ${cookies.length} cookies (no clear auth cookie seen). Check: ${JSON.stringify(jarStatus(jar)).slice(0, 200)}`);
}
console.log("[done — окно можно закрыть]");
await new Promise((r) => setTimeout(r, 8000));
await browser.close().catch(() => {});
process.exit(0);
