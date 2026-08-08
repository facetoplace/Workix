/**
 * Browser-backed page reader for hh.ru.
 *
 * Raw HTTP with the saved cookies works, but DDoS-Guard starts answering with a
 * JS challenge (403) after a burst of requests. Driving the real Chrome profile
 * — the same one the user logged into — solves the challenge natively, so this
 * is the reliable path; plain fetch stays as the fast first attempt.
 *
 * puppeteer-core is optional: without it we degrade to the HTTP path.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "../store.js";

interface BrowserLike {
  newPage: () => Promise<PageLike>;
  disconnect?: () => void;
  close?: () => Promise<void>;
}
interface PageLike {
  goto: (url: string, opts?: unknown) => Promise<unknown>;
  content: () => Promise<string>;
  close: () => Promise<void>;
  setUserAgent?: (ua: string) => Promise<void>;
}

export function hhProfileDir(): string {
  return join(dataDir(), "browser", "hh");
}

let cached: { browser: BrowserLike; owned: boolean } | null = null;

async function loadPuppeteer(): Promise<
  { launch: (o: unknown) => Promise<BrowserLike>; connect: (o: unknown) => Promise<BrowserLike> } | undefined
> {
  try {
    const mod = (await import("puppeteer-core")) as unknown as {
      default?: unknown;
    };
    return (mod.default ?? mod) as never;
  } catch {
    return undefined;
  }
}

/** Reuse the window the user already has open; otherwise start a headless one. */
async function getBrowser(): Promise<{ browser: BrowserLike; owned: boolean } | undefined> {
  if (cached) return cached;

  const puppeteer = await loadPuppeteer();
  if (!puppeteer) return undefined;

  const profile = hhProfileDir();
  const portFile = join(profile, "DevToolsActivePort");

  if (existsSync(portFile)) {
    try {
      const [port, wsPath] = readFileSync(portFile, "utf8").trim().split("\n");
      const browser = await puppeteer.connect({
        browserWSEndpoint: `ws://127.0.0.1:${port}${wsPath}`,
        defaultViewport: null,
      });
      cached = { browser, owned: false };
      return cached;
    } catch {
      // stale port file — fall through to launching our own
    }
  }

  const candidates = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
  ].filter(Boolean) as string[];
  const executablePath = candidates.find((p) => existsSync(p));
  if (!executablePath) return undefined;

  try {
    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      userDataDir: profile,
      args: ["--disable-blink-features=AutomationControlled", "--no-first-run"],
    });
    cached = { browser, owned: true };
    return cached;
  } catch {
    return undefined;
  }
}

export async function closeHhBrowser(): Promise<void> {
  if (!cached) return;
  try {
    if (cached.owned) await cached.browser.close?.();
    else cached.browser.disconnect?.();
  } catch {
    /* already gone */
  }
  cached = null;
}

/** Load `url` in the logged-in profile and return its HTML. */
export async function fetchHhHtmlViaBrowser(
  url: string,
): Promise<{ html?: string; error?: string }> {
  const b = await getBrowser();
  if (!b) {
    return {
      error:
        "puppeteer-core/Chrome недоступны — cd mcp && npm install puppeteer-core",
    };
  }

  let page: PageLike | undefined;
  try {
    page = await b.browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    const html = await page.content();
    return { html };
  } catch (e) {
    return { error: (e as Error)?.message || String(e) };
  } finally {
    await page?.close().catch(() => {});
  }
}
