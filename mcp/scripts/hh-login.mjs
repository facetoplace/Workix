/**
 * Terminal-only hh.ru login. Opens a real Chrome window with a persistent
 * profile; YOU type the login/password/2FA there. Nothing is asked for in chat,
 * and no credential is ever read by the agent — only the resulting session
 * cookies are saved to mcp/data/cookies/hh.json.
 *
 *   cd mcp
 *   npm run hh:login            # log in, then press Enter here
 *   npm run hh:login -- --check # verify the saved session, no window
 */
import { createInterface } from "node:readline/promises";
import { existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MCP_ROOT = join(HERE, "..");
const DATA = join(MCP_ROOT, "data");
const PROFILE_DIR = join(DATA, "browser", "hh");
const JAR = "hh";

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const headful = !args.includes("--headless");

const { loadEnv } = await import(`file://${join(MCP_ROOT, "dist", "env.js").replace(/\\/g, "/")}`);
const { saveCookies, jarStatus } = await import(
  `file://${join(MCP_ROOT, "dist", "cookies.js").replace(/\\/g, "/")}`
);
loadEnv();

if (checkOnly) {
  const st = jarStatus(JAR);
  console.log(JSON.stringify(st, null, 2));
  const { verifySession } = await import(
    `file://${join(MCP_ROOT, "dist", "adapters", "hh.js").replace(/\\/g, "/")}`
  );
  console.log("\nprobing hh.ru with saved session…");
  console.log(JSON.stringify(await verifySession(), null, 2));
  process.exit(0);
}

let puppeteer;
try {
  puppeteer = (await import("puppeteer-core")).default;
} catch {
  console.error(
    "puppeteer-core not found. Install it:\n  cd mcp && npm install puppeteer-core",
  );
  process.exit(1);
}

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  process.env.LOCALAPPDATA &&
    join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

const executablePath = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!executablePath) {
  console.error(
    "Chrome/Edge not found. Set CHROME_PATH=... in .env to the browser binary.",
  );
  process.exit(1);
}

if (!existsSync(PROFILE_DIR)) mkdirSync(PROFILE_DIR, { recursive: true });

console.log(`browser : ${executablePath}`);
console.log(`profile : ${PROFILE_DIR}`);
console.log("");

const browser = await puppeteer.launch({
  executablePath,
  headless: !headful,
  userDataDir: PROFILE_DIR,
  defaultViewport: null,
  args: ["--start-maximized", "--disable-blink-features=AutomationControlled"],
});

const page = (await browser.pages())[0] || (await browser.newPage());
await page.goto("https://hh.ru/account/login", { waitUntil: "domcontentloaded" });

console.log("=".repeat(60));
console.log("Залогинься в открывшемся окне hh.ru.");
console.log("Логин / пароль / код — вводи ТОЛЬКО там, не в чат.");
console.log("=".repeat(60));

/**
 * hh sets `hhrole=applicant` once logged in (anonymous visitors get
 * `hhrole=anonymous`). Read it over CDP rather than from the DOM: the cookie is
 * httpOnly, and a <template>'s payload is in a document fragment, so
 * `textContent` on it comes back empty.
 */
async function isLoggedIn(client) {
  try {
    const { cookies } = await client.send("Network.getAllCookies");
    const role = cookies.find(
      (c) => c.name === "hhrole" && /(^|\.)hh\.ru$/i.test(c.domain.replace(/^\./, "")),
    );
    return Boolean(role && role.value && role.value !== "anonymous");
  } catch {
    return false;
  }
}

if (process.stdin.isTTY) {
  console.log("Когда увидишь свой кабинет — вернись сюда и нажми Enter.");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await rl.question("\n[Enter] когда залогинился… ");
  rl.close();
} else {
  // No terminal (agent-driven run): poll a background tab until hh reports a
  // real user, so nothing is captured before the login actually completes.
  const WAIT_MS = 10 * 60 * 1000;
  const STEP_MS = 5000;
  const probeClient = await page.createCDPSession();
  const deadline = Date.now() + WAIT_MS;
  let ok = false;

  console.log(`\nЖду логина (до ${WAIT_MS / 60000} мин), проверяю каждые ${STEP_MS / 1000}с…`);
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, STEP_MS));
    if (await isLoggedIn(probeClient)) {
      ok = true;
      break;
    }
    const left = Math.round((deadline - Date.now()) / 1000);
    console.log(`  …ещё не залогинен (осталось ${left}с)`);
  }

  if (!ok) {
    // Leave the window open: closing it would drop in-memory session cookies,
    // and `npm run hh:capture` can still rescue a login that finished late.
    console.error(
      "\n[!] Логин не обнаружен за отведённое время. Окно НЕ закрываю — " +
        "если ты всё же вошёл, забери сессию: npm run hh:capture",
    );
    browser.disconnect();
    process.exit(1);
  }
  console.log("\nЛогин обнаружен — забираю куки.");
}

const client = await page.createCDPSession();
const { cookies } = await client.send("Network.getAllCookies");

const hhCookies = cookies
  .filter((c) => /(^|\.)hh\.ru$/i.test(c.domain.replace(/^\./, "")))
  .map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain.replace(/^\./, ""),
    path: c.path || "/",
    expires: c.expires && c.expires > 0 ? Math.floor(c.expires) : undefined,
    secure: Boolean(c.secure),
    httpOnly: Boolean(c.httpOnly),
  }));

if (!hhCookies.length) {
  console.error("\n[!] Куки hh.ru не найдены — похоже, логин не завершён.");
  await browser.close();
  process.exit(1);
}

saveCookies(JAR, hhCookies);
console.log(`\nsaved ${hhCookies.length} cookies → ${jarStatus(JAR).path}`);

const { verifySession } = await import(
  `file://${join(MCP_ROOT, "dist", "adapters", "hh.js").replace(/\\/g, "/")}`
);
const probe = await verifySession();
console.log("session probe:", JSON.stringify(probe, null, 2));

await browser.close();
console.log(
  probe.authorized
    ? "\nOK — сессия сохранена. Рестартни MCP → workix_hh_status / workix_digest."
    : "\n[!] Сессия сохранена, но hh не подтвердил авторизацию. Проверь окно и повтори.",
);
process.exit(probe.authorized ? 0 : 1);
