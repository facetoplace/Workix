/**
 * Capture the current session cookies from the Chrome window opened by
 * board-open.mjs (connects to that profile's DevToolsActivePort) into the jar.
 *
 *   node scripts/board-save.mjs yc
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MCP_ROOT = join(HERE, "..");
const jar = process.argv[2];
if (!jar) { console.error("usage: board-save.mjs <jar>"); process.exit(1); }
const PROFILE = join(MCP_ROOT, "data", "browser", jar);
const portFile = join(PROFILE, "DevToolsActivePort");
if (!existsSync(portFile)) { console.error(`no DevToolsActivePort in ${PROFILE} — is board-open.mjs running?`); process.exit(1); }

const { saveCookies, jarStatus } = await import(pathToFileURL(join(MCP_ROOT, "dist", "cookies.js")).href);
const puppeteer = (
  await import("file:///C:/Projects/Services/workix/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js")
).default;

const [port, ws] = readFileSync(portFile, "utf8").trim().split("\n");
const browser = await puppeteer.connect({ browserWSEndpoint: `ws://127.0.0.1:${port}${ws}`, defaultViewport: null });
const page = (await browser.pages())[0] || (await browser.newPage());
const client = await page.createCDPSession();
const { cookies } = await client.send("Network.getAllCookies");
const mapped = cookies.map((c) => ({
  name: c.name, value: c.value, domain: c.domain, path: c.path || "/",
  expires: c.expires && c.expires > 0 ? Math.floor(c.expires) : 0,
  httpOnly: !!c.httpOnly, secure: !!c.secure,
}));
saveCookies(jar, mapped);
const host = { yc: "workatastartup.com", wellfound: "wellfound.com", profi: "profi.ru", avito: "avito.ru", x: "x.com" }[jar] || jar;
const forHost = mapped.filter((c) => c.domain.replace(/^\./, "").includes(host.split(".").slice(-2).join(".")));
console.log(`saved ${mapped.length} cookies to jar '${jar}' (${forHost.length} for ${host})`);
console.log("names for host:", forHost.map((c) => c.name).join(", "));
console.log("jar:", JSON.stringify(jarStatus(jar)).slice(0, 200));
browser.disconnect();
process.exit(0);
