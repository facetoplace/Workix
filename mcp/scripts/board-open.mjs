/**
 * Open a gated board in a VISIBLE Chrome window with a per-jar persistent profile
 * and KEEP IT OPEN (no auto-detect). You log in at your own pace; when done, run
 * scripts/board-save.mjs <jar> to capture the session cookies into the jar.
 *
 *   node scripts/board-open.mjs yc https://www.workatastartup.com/
 */
import { existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MCP_ROOT = join(HERE, "..");
const jar = process.argv[2];
const url = process.argv[3];
if (!jar || !url) { console.error("usage: board-open.mjs <jar> <url>"); process.exit(1); }
const PROFILE = join(MCP_ROOT, "data", "browser", jar);
if (!existsSync(PROFILE)) mkdirSync(PROFILE, { recursive: true });

const puppeteer = (
  await import("file:///C:/Projects/Services/workix/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js")
).default;
const CHROME = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
].filter(Boolean).find((p) => existsSync(p));
if (!CHROME) { console.error("Chrome not found"); process.exit(1); }

console.log(`jar     : ${jar}`);
console.log(`profile : ${PROFILE}`);
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  userDataDir: PROFILE,
  defaultViewport: null,
  args: ["--start-maximized", "--disable-blink-features=AutomationControlled", "--no-first-run", "--remote-debugging-port=0"],
});
const page = (await browser.pages())[0] || (await browser.newPage());
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch((e) => console.log("goto:", e.message));
console.log("window open — log in at your pace.");
console.log(`when done:  node scripts/board-save.mjs ${jar}`);
console.log("(this window stays open ~30 min)");
await new Promise((r) => setTimeout(r, 30 * 60 * 1000));
await browser.close().catch(() => {});
process.exit(0);
