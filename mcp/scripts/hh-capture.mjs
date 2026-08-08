/**
 * Attach to the Chrome already opened by hh-login.mjs and capture its session.
 *
 * Used when auto-detection of the login state fails: connecting over CDP is
 * non-destructive, so in-memory session cookies survive (closing Chrome would
 * drop them). Reads the debug endpoint from the profile's DevToolsActivePort.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MCP_ROOT = join(HERE, "..");
const PROFILE_DIR = join(MCP_ROOT, "data", "browser", "hh");
const JAR = "hh";

const { loadEnv } = await import(`file://${join(MCP_ROOT, "dist", "env.js").replace(/\\/g, "/")}`);
const { saveCookies, jarStatus } = await import(
  `file://${join(MCP_ROOT, "dist", "cookies.js").replace(/\\/g, "/")}`
);
loadEnv();

const portFile = join(PROFILE_DIR, "DevToolsActivePort");
if (!existsSync(portFile)) {
  console.error("DevToolsActivePort не найден — браузер не запущен. Сначала npm run hh:login");
  process.exit(1);
}
const [port, wsPath] = readFileSync(portFile, "utf8").trim().split("\n");
const browserWSEndpoint = `ws://127.0.0.1:${port}${wsPath}`;

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.connect({ browserWSEndpoint, defaultViewport: null });

const pages = await browser.pages();
console.log("open tabs:");
for (const p of pages) console.log("  -", p.url());

// Diagnose why the poller did not see the login.
const hhPage = pages.find((p) => /hh\.ru/i.test(p.url())) || pages[0];
try {
  const diag = await hhPage.evaluate(() => {
    const ids = [...document.querySelectorAll("template[id]")].map((t) => t.id);
    const tpl = document.querySelector("#HH-Lux-InitialState");
    let userType = null;
    let keys = [];
    if (tpl) {
      try {
        const s = JSON.parse(tpl.textContent || "{}");
        userType = s.userType ?? s?.session?.userType ?? null;
        keys = Object.keys(s).slice(0, 25);
      } catch (e) {
        userType = `parse-error: ${e.message}`;
      }
    }
    return { url: location.href, templates: ids, hasInitialState: Boolean(tpl), userType, keys };
  });
  console.log("\ndiagnostics:", JSON.stringify(diag, null, 2));
} catch (e) {
  console.log("diagnostics failed:", e.message);
}

const client = await hhPage.createCDPSession();
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

console.log(`\nhh.ru cookies: ${hhCookies.length}`);
console.log("names:", hhCookies.map((c) => c.name).join(", "));

if (!hhCookies.length) {
  console.error("[!] пусто — логин не завершён?");
  browser.disconnect();
  process.exit(1);
}

saveCookies(JAR, hhCookies);
console.log(`saved → ${jarStatus(JAR).path}`);

const { verifySession } = await import(
  `file://${join(MCP_ROOT, "dist", "adapters", "hh.js").replace(/\\/g, "/")}`
);
console.log("\nprobe:", JSON.stringify(await verifySession(), null, 2));

browser.disconnect(); // leave the window open
