/**
 * Send one message into an hh.ru chat from the logged-in Chrome profile.
 *
 * Dry run by default. The message is written through the native value setter,
 * never typed: page.type() replays newlines as Enter, and an hh chat input
 * sends on Enter — typing a multi-line message would fire it line by line.
 *
 *   node scripts/hh-chat-send.mjs --chat 5536866857 --text-file msg.txt [--send]
 */
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MCP_ROOT = join(HERE, "..");
const PROFILE = join(MCP_ROOT, "data", "browser", "hh");
const SHOTS = join(MCP_ROOT, "data", "apply-shots");

const argv = process.argv.slice(2);
const arg = (n) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const chatId = arg("chat");
const textFile = arg("text-file");
const send = argv.includes("--send");

if (!chatId || !textFile) {
  console.error("usage: --chat <chatId> --text-file <path> [--send]");
  process.exit(1);
}
const message = readFileSync(textFile, "utf8").trim();
if (!message) {
  console.error("[!] пустое сообщение — отменено");
  process.exit(1);
}
if (!existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true });

const puppeteer = (
  await import("file:///C:/Projects/Services/workix/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js")
).default;

const portFile = join(PROFILE, "DevToolsActivePort");
let b;
if (existsSync(portFile)) {
  try {
    const [port, ws] = readFileSync(portFile, "utf8").trim().split("\n");
    b = await puppeteer.connect({
      browserWSEndpoint: `ws://127.0.0.1:${port}${ws}`,
      defaultViewport: null,
    });
  } catch {
    /* stale */
  }
}
if (!b) {
  b = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: false,
    userDataDir: PROFILE,
    defaultViewport: null,
    args: ["--disable-blink-features=AutomationControlled"],
  });
}

const page = await b.newPage();
await page.setViewport({ width: 1400, height: 1000 });
const url = `https://hh.ru/chat/${chatId}`;
console.log(`open ${url}`);
await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
await new Promise((r) => setTimeout(r, 4000));

const input =
  (await page.$('textarea[placeholder*="ообщение"]')) ||
  (await page.$('[contenteditable="true"]')) ||
  (await page.$("textarea"));

if (!input) {
  const shot = join(SHOTS, `chat-${chatId}-no-input.png`);
  await page.screenshot({ path: shot });
  console.log(`[!] поле ввода не найдено. Скриншот: ${shot}`);
  await page.close();
  b.disconnect ? b.disconnect() : await b.close();
  process.exit(3);
}

const isTextarea = await page.evaluate((el) => el.tagName === "TEXTAREA", input);

// Type it for real. A native value setter updates the DOM but not hh's React
// state, so the send button stays inert. Newlines go in as Shift+Enter —
// a bare Enter in this input sends the message.
await input.click();
await page.keyboard.down("Control");
await page.keyboard.press("KeyA");
await page.keyboard.up("Control");
await page.keyboard.press("Backspace");
await new Promise((r) => setTimeout(r, 400));

const lines = message.split("\n");
for (let i = 0; i < lines.length; i++) {
  if (lines[i]) await page.keyboard.type(lines[i], { delay: 3 });
  if (i < lines.length - 1) {
    await page.keyboard.down("Shift");
    await page.keyboard.press("Enter");
    await page.keyboard.up("Shift");
  }
}
await new Promise((r) => setTimeout(r, 900));

const filled = await page.evaluate(
  (el, textarea) => (textarea ? el.value : el.textContent),
  input,
  isTextarea,
);
console.log(`в поле: ${filled.length} симв. (ожидалось ${message.length})`);

if (filled.trim() !== message.trim()) {
  console.log("[!] текст не совпадает с утверждённым — отправка отменена");
  await page.screenshot({ path: join(SHOTS, `chat-${chatId}-mismatch.png`) });
  await page.close();
  b.disconnect ? b.disconnect() : await b.close();
  process.exit(7);
}

const shot = join(SHOTS, `chat-${chatId}-${send ? "sent" : "preview"}.png`);
await page.screenshot({ path: shot });
console.log(`screenshot: ${shot}`);

if (!send) {
  console.log("\nDRY RUN — ничего не отправлено.");
  await page.close();
  b.disconnect ? b.disconnect() : await b.close();
  process.exit(0);
}

// Enter is the real send path in this input; the button alone did not fire it.
// Sent is confirmed by the composer going empty, not by the click returning.
const emptied = async () => {
  await new Promise((r) => setTimeout(r, 3000));
  return page.evaluate(
    (el, textarea) => ((textarea ? el.value : el.textContent) || "").trim().length === 0,
    input,
    isTextarea,
  );
};

await input.click();
await page.keyboard.press("Enter");
let sent = await emptied();

if (!sent) {
  const btn =
    (await page.$('[data-qa="chatik-do-send-message"]')) ||
    (await page.$('[data-qa="chat-form-submit"]'));
  if (btn) {
    await btn.click();
    sent = await emptied();
  }
}

await page.screenshot({ path: join(SHOTS, `chat-${chatId}-after.png`) });
console.log(
  sent
    ? "OK — отправлено (поле ввода очистилось)"
    : "[!] НЕ отправлено — текст остался в поле, отправь вручную",
);
await page.close();
b.disconnect ? b.disconnect() : await b.close();
process.exit(sent ? 0 : 8);

await page.close();
b.disconnect ? b.disconnect() : await b.close();
process.exit(0);
