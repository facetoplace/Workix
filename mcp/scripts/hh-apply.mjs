/**
 * Apply to an hh.ru vacancy from the logged-in Chrome profile.
 *
 * Default mode is a DRY RUN: it opens the vacancy, fills the cover letter and
 * screenshots the filled form, but never presses submit. Sending requires an
 * explicit `--send`, one vacancy at a time — an application cannot be undone.
 *
 *   node scripts/hh-apply.mjs --id 135589354 --text-file letter.txt
 *   node scripts/hh-apply.mjs --id 135589354 --text-file letter.txt --send
 */
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MCP_ROOT = join(HERE, "..");
const PROFILE = join(MCP_ROOT, "data", "browser", "hh");
const SHOTS = join(MCP_ROOT, "data", "apply-shots");

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const vacancyId = arg("id");
const textFile = arg("text-file");
const send = argv.includes("--send");

if (!vacancyId || !textFile) {
  console.error("usage: --id <vacancyId> --text-file <path> [--send]");
  process.exit(1);
}
const letter = readFileSync(textFile, "utf8").trim();
if (!letter) {
  console.error("[!] cover letter is empty — refusing to apply");
  process.exit(1);
}
if (!existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true });

const puppeteer = (
  await import("file:///C:/Projects/Services/workix/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js")
).default;

async function browser() {
  const portFile = join(PROFILE, "DevToolsActivePort");
  if (existsSync(portFile)) {
    try {
      const [port, ws] = readFileSync(portFile, "utf8").trim().split("\n");
      return await puppeteer.connect({
        browserWSEndpoint: `ws://127.0.0.1:${port}${ws}`,
        defaultViewport: null,
      });
    } catch {
      /* stale port file */
    }
  }
  return puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: false,
    userDataDir: PROFILE,
    defaultViewport: null,
    args: ["--disable-blink-features=AutomationControlled"],
  });
}

const b = await browser();
const page = await b.newPage();
await page.setViewport({ width: 1400, height: 1000 });

const url = `https://hh.ru/vacancy/${vacancyId}`;
console.log(`open ${url}`);
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));

const title = await page
  .$eval('[data-qa="vacancy-title"]', (el) => el.innerText.trim())
  .catch(() => "(no title)");
console.log(`vacancy: ${title}`);

// Already applied? The apply control disappears once a negotiation exists.
const applyBtn =
  (await page.$('[data-qa="vacancy-response-link-top"]')) ||
  (await page.$('[data-qa="vacancy-response-link-top-with-hint"]'));
if (!applyBtn) {
  console.log("[skip] кнопки отклика нет — вероятно, уже откликались");
  await page.close();
  b.disconnect ? b.disconnect() : await b.close();
  process.exit(2);
}

await applyBtn.click();
await new Promise((r) => setTimeout(r, 4000));
console.log(`after click: ${page.url()}`);

// hh sometimes hides the letter behind a "add cover letter" toggle.
for (const sel of [
  '[data-qa="vacancy-response-letter-toggle"]',
  '[data-qa="add-cover-letter"]',
]) {
  const t = await page.$(sel);
  if (t) {
    await t.click();
    await new Promise((r) => setTimeout(r, 1200));
    break;
  }
}

const area =
  (await page.$('[data-qa="vacancy-response-popup-form-letter-input"]')) ||
  (await page.$('textarea[name="letter"]')) ||
  (await page.$("textarea"));

if (!area) {
  const shot = join(SHOTS, `${vacancyId}-no-textarea.png`);
  await page.screenshot({ path: shot, fullPage: false });
  console.log(`[!] поле сопроводительного не найдено. Скриншот: ${shot}`);
  const forms = await page.evaluate(() =>
    [...document.querySelectorAll("[data-qa]")]
      .map((el) => el.getAttribute("data-qa"))
      .filter((q) => /response|letter|submit|popup/i.test(q || ""))
      .slice(0, 40),
  );
  console.log("data-qa на странице:", JSON.stringify(forms, null, 1));
  await page.close();
  b.disconnect ? b.disconnect() : await b.close();
  process.exit(3);
}

/*
 * Two hazards here, both learned the hard way:
 *
 *  - hh restores a saved draft into the field, so writing without clearing
 *    produces a duplicated, interleaved letter;
 *  - page.type() replays newlines as Enter, which on some hh forms submits the
 *    response mid-fill — that is how an application went out during a "dry" run.
 *
 * So: clear and set in a single evaluate on one element handle, no typing, no
 * re-render gap in between.
 */
await area.click();
await page.keyboard.down("Control");
await page.keyboard.press("KeyA");
await page.keyboard.up("Control");
await page.keyboard.press("Backspace");
await new Promise((r) => setTimeout(r, 400));

// Type it: a native value setter updates the DOM but not React's state, and hh
// would then submit an empty letter. Newlines go in as Shift+Enter, because a
// bare Enter can submit the form mid-fill.
const lines = letter.split("\n");
for (let i = 0; i < lines.length; i++) {
  if (lines[i]) await page.keyboard.type(lines[i], { delay: 3 });
  if (i < lines.length - 1) {
    await page.keyboard.down("Shift");
    await page.keyboard.press("Enter");
    await page.keyboard.up("Shift");
  }
}
await new Promise((r) => setTimeout(r, 900));

const filled = await page.evaluate((el) => el.value, area);
console.log(`letter filled: ${filled.length} симв. (ожидалось ${letter.length})`);

// Hard gate: never submit a letter that is not exactly what was approved.
if (filled.trim() !== letter.trim()) {
  console.log("[!] текст в поле не совпадает с утверждённым — отправка отменена");
  console.log(`    в поле ${filled.length} симв., ожидалось ${letter.length}`);
  await page.screenshot({ path: join(SHOTS, `${vacancyId}-mismatch.png`) });
  await page.close();
  b.disconnect ? b.disconnect() : await b.close();
  process.exit(7);
}

const shot = join(SHOTS, `${vacancyId}-${send ? "sent" : "preview"}.png`);
await page.screenshot({ path: shot, fullPage: false });
console.log(`screenshot: ${shot}`);

if (!send) {
  console.log("\nDRY RUN — ничего не отправлено. Добавь --send чтобы отправить.");
  await page.close();
  b.disconnect ? b.disconnect() : await b.close();
  process.exit(0);
}

const submit =
  (await page.$('[data-qa="vacancy-response-submit-popup"]')) ||
  (await page.$('[data-qa="vacancy-response-letter-submit"]')) ||
  (await page.$('button[type="submit"]'));
if (!submit) {
  console.log("[!] кнопка отправки не найдена — НЕ отправлено");
  await page.close();
  b.disconnect ? b.disconnect() : await b.close();
  process.exit(4);
}

await submit.click();
await new Promise((r) => setTimeout(r, 5000));
await page.screenshot({ path: join(SHOTS, `${vacancyId}-after.png`) });

// Verify by reloading: a real application removes the apply control.
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));
const stillThere = await page.$('[data-qa="vacancy-response-link-top"]');
console.log(stillThere ? "[?] кнопка отклика ещё на месте — проверь вручную" : "OK — отклик отправлен");

await page.close();
b.disconnect ? b.disconnect() : await b.close();
process.exit(stillThere ? 5 : 0);
