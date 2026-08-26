/**
 * Open hh.ru vacancy search in a VISIBLE Chrome window using the persistent hh
 * profile (logged-in session), extract the result cards, screenshot, and leave
 * the window open so a human can look. Read-only: it searches, never applies.
 *
 *   node scripts/hh-browse.mjs "flutter OR react native OR мобильный разработчик"
 */
import { existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MCP_ROOT = join(HERE, "..");
const PROFILE = join(MCP_ROOT, "data", "browser", "hh");
const SHOTS = join(MCP_ROOT, "data", "apply-shots");
if (!existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true });

const query = process.argv[2] || "flutter OR react native OR мобильный разработчик";
const url =
  "https://hh.ru/search/vacancy?" +
  new URLSearchParams({ text: query, order_by: "publication_time", search_field: "name", items_on_page: "50" }).toString();

const puppeteer = (
  await import("file:///C:/Projects/Services/workix/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js")
).default;

const CHROME = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
].filter(Boolean).find((p) => existsSync(p));
if (!CHROME) { console.error("Chrome not found"); process.exit(1); }

console.log("profile:", PROFILE);
console.log("query  :", query);
console.log("url    :", url);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  userDataDir: PROFILE,
  defaultViewport: null,
  args: ["--start-maximized", "--disable-blink-features=AutomationControlled", "--no-first-run"],
});

const page = (await browser.pages())[0] || (await browser.newPage());
try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 4000)); // let SERP hydrate / anti-bot settle

  const shot = join(SHOTS, "hh-search.png");
  await page.screenshot({ path: shot });
  console.log("screenshot:", shot);

  const items = await page.evaluate(() => {
    const out = [];
    const cards = document.querySelectorAll('[data-qa="vacancy-serp__vacancy"], [data-qa="serp-item__title"]');
    const seen = new Set();
    document.querySelectorAll('a[data-qa="serp-item__title"], a[data-qa="vacancy-serp__vacancy-title"]').forEach((a) => {
      const href = a.href || "";
      if (!href || seen.has(href)) return;
      seen.add(href);
      const card = a.closest('[data-qa="vacancy-serp__vacancy"]') || a.parentElement;
      const salary = card?.querySelector('[data-qa="vacancy-serp__vacancy-compensation"]')?.textContent || "";
      const company = card?.querySelector('[data-qa="vacancy-serp__vacancy-employer"]')?.textContent || "";
      out.push({ title: (a.textContent || "").trim(), href, salary: salary.trim(), company: company.trim() });
    });
    const found = document.querySelector('[data-qa="vacancies-search-header"], h1')?.textContent || "";
    return { found: found.trim(), items: out };
  });

  const title = await page.title();
  const loggedIn = /Мои резюме|Отклики|Личный кабинет/i.test(await page.content()) || !/Войти/i.test(title);
  console.log("page title:", title);
  console.log("header:", items.found.slice(0, 80));
  console.log("session looks logged-in:", loggedIn);
  console.log("\n=== VACANCIES (" + items.items.length + ") ===");
  for (const v of items.items.slice(0, 30)) {
    console.log(`• ${v.title}${v.salary ? " — " + v.salary : ""}${v.company ? " @ " + v.company : ""}`);
    console.log(`   ${v.href.split("?")[0]}`);
  }
} catch (e) {
  console.log("ERROR:", e.message);
}

console.log("\n[window left open ~10 min — look at it; press Ctrl+C here to close early]");
await new Promise((r) => setTimeout(r, 10 * 60 * 1000));
await browser.close().catch(() => {});
process.exit(0);
