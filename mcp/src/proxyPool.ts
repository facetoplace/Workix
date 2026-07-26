import { getProxyUrl, loadEnv } from "./env.js";

const CACHE_TTL_MS = 10 * 60_000;
const MAX_POOL = 40;

let cache: { urls: string[]; fetchedAt: number } | null = null;
let rr = 0;

function isUsableProxy(line: string): boolean {
  return (
    /^(socks5?|https?):\/\//i.test(line) ||
    /^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(line)
  );
}

function normalizeProxy(line: string): string {
  const t = line.trim();
  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(t)) return `socks5://${t}`;
  return t;
}

function parseProxyLines(text: string): string[] {
  let body = text;
  const compact = text.replace(/\s/g, "");
  if (/^[A-Za-z0-9+/=]+$/.test(compact) && compact.length > 80) {
    try {
      body = Buffer.from(compact, "base64").toString("utf8");
    } catch {
      /* keep raw */
    }
  }

  const out: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    for (const part of t.split(/[,;|]+/).map((x) => x.trim())) {
      if (isUsableProxy(part)) out.push(normalizeProxy(part));
    }
  }
  return [...new Set(out)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * PROXY_1 may be:
 * - subscription URL (returns vless/ss/vmess/socks5 lines) — берём socks/http
 * - newline/comma list of proxies
 * - single socks5/http proxy
 */
export async function getProxyPool(): Promise<string[]> {
  loadEnv();
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.urls;
  }

  const raw = getProxyUrl();
  if (!raw) {
    cache = { urls: [], fetchedAt: Date.now() };
    return [];
  }

  // Already a socks proxy URL → single entry
  if (/^socks/i.test(raw) && !/[\n,;|]/.test(raw)) {
    cache = { urls: [raw], fetchedAt: Date.now() };
    return cache.urls;
  }

  // Inline multi-list in env value
  if (/[\n,;|]/.test(raw)) {
    const inline = parseProxyLines(raw);
    const socks = inline.filter((u) => /^socks/i.test(u));
    const urls = (socks.length ? socks : inline).slice(0, MAX_POOL);
    cache = { urls, fetchedAt: Date.now() };
    return urls;
  }

  // http(s) URL → try as subscription list first
  if (/^https?:\/\//i.test(raw)) {
    try {
      const res = await fetch(raw, {
        headers: { "User-Agent": "WorkixMCP/0.2 (+https://workix.co)" },
        signal: AbortSignal.timeout(20000),
      });
      const text = await res.text();
      let urls = parseProxyLines(text);
      const socks = urls.filter((u) => /^socks/i.test(u));
      if (socks.length) urls = socks;
      if (urls.length > 0) {
        urls = shuffle(urls).slice(0, MAX_POOL);
        cache = { urls, fetchedAt: Date.now() };
        return urls;
      }
    } catch {
      /* fall through: treat as HTTP CONNECT proxy */
    }
    // No list parsed — use URL itself as HTTP proxy
    cache = { urls: [raw], fetchedAt: Date.now() };
    return cache.urls;
  }

  cache = { urls: [], fetchedAt: Date.now() };
  return [];
}

export async function nextProxy(): Promise<string | undefined> {
  const pool = await getProxyPool();
  if (!pool.length) return undefined;
  const url = pool[rr % pool.length];
  rr += 1;
  return url;
}

export function invalidateProxyCache(): void {
  cache = null;
}

export async function proxyPoolInfo(): Promise<{
  count: number;
  protocols: string[];
  source: string;
}> {
  const pool = await getProxyPool();
  const protocols = [
    ...new Set(
      pool.map((u) => (u.match(/^([a-z0-9]+):/i) || ["", "?"])[1].toLowerCase()),
    ),
  ];
  return {
    count: pool.length,
    protocols,
    source: getProxyUrl() ? "PROXY_1 subscription/list" : "none",
  };
}
