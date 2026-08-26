/**
 * Run a task inside a Chrome page bound to a persistent, logged-in profile
 * (mcp/data/browser/<profile>). If a window is already open on that profile
 * (DevToolsActivePort present — e.g. scripts/board-open.mjs), we CONNECT to it
 * and reuse the live session; otherwise we launch our own headless Chrome on the
 * same userDataDir, which carries the saved session cookies. puppeteer-core is
 * optional — without it the caller gets a soft error, never a crash.
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export function browserProfileDir(name) {
    const dir = join(ROOT, "data", "browser", name);
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
    return dir;
}
async function loadPuppeteer() {
    const candidates = [
        "puppeteer-core",
        pathToFileURL(join(ROOT, "..", "node_modules", "puppeteer-core", "lib", "esm", "puppeteer", "puppeteer-core.js")).href,
    ];
    for (const spec of candidates) {
        try {
            const mod = (await import(spec));
            const p = (mod.default || mod);
            if (typeof p?.launch === "function" && typeof p?.connect === "function") {
                return p;
            }
        }
        catch { /* try next */ }
    }
    return undefined;
}
function chromePath() {
    return [
        process.env.CHROME_PATH,
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
        "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/usr/bin/google-chrome",
    ].filter(Boolean).find((p) => existsSync(p));
}
/** Acquire a browser for the profile: connect to a live window if one is open,
 * else launch on the same profile. `headful` forces a visible Chrome — needed
 * for Cloudflare-gated boards (Wellfound) that challenge headless. */
async function acquire(profile, headful) {
    const puppeteer = await loadPuppeteer();
    if (!puppeteer)
        return { error: "puppeteer-core unavailable — cd mcp && npm install puppeteer-core" };
    const dir = browserProfileDir(profile);
    const portFile = join(dir, "DevToolsActivePort");
    if (existsSync(portFile)) {
        try {
            const [port, ws] = readFileSync(portFile, "utf8").trim().split("\n");
            const browser = await puppeteer.connect({ browserWSEndpoint: `ws://127.0.0.1:${port}${ws}`, defaultViewport: null });
            return { browser, owned: false };
        }
        catch { /* stale port — launch our own */ }
    }
    const executablePath = chromePath();
    if (!executablePath)
        return { error: "Chrome not found — set CHROME_PATH" };
    try {
        const browser = await puppeteer.launch({
            executablePath,
            headless: !headful,
            userDataDir: dir,
            args: [
                "--disable-blink-features=AutomationControlled",
                "--no-first-run",
                ...(headful ? ["--start-minimized"] : []),
            ],
        });
        return { browser, owned: true };
    }
    catch (e) {
        return { error: e?.message || String(e) };
    }
}
/** Open `url` in the profile, run `extract` in the page after `waitMs`, return its result. */
export async function withProfilePage(profile, url, extract, opts) {
    const acquired = await acquire(profile, Boolean(opts?.headful));
    if ("error" in acquired)
        return { error: acquired.error };
    const { browser, owned } = acquired;
    let page;
    try {
        page = await browser.newPage();
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: opts?.timeoutMs ?? 60000 });
        await new Promise((r) => setTimeout(r, opts?.waitMs ?? 6000));
        // Lazy-loaded SPAs (Wellfound) paginate on scroll — nudge the list a few times.
        for (let i = 0; i < (opts?.scrolls ?? 0); i++) {
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
            await new Promise((r) => setTimeout(r, 1800));
        }
        const data = (await page.evaluate(extract));
        return { data };
    }
    catch (e) {
        return { error: e?.message || String(e) };
    }
    finally {
        await page?.close().catch(() => { });
        if (owned)
            await browser.close?.().catch(() => { });
        else
            browser.disconnect?.();
    }
}
