import http from "node:http";
import https from "node:https";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import { cookieHeaderFor, mergeSetCookie } from "./cookies.js";
import { getProxyPool, nextProxy } from "./proxyPool.js";

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

/** Cap redirect chains so a redirect loop can't recurse forever. */
const MAX_REDIRECTS = 8;
/** Cap the body we buffer so one giant/hostile response can't OOM the process. */
const MAX_BODY_BYTES = 20 * 1024 * 1024;

export interface FetchResult {
  ok: boolean;
  status: number;
  text: string;
  ms: number;
  viaProxy: boolean;
  error?: string;
  /** Where the request actually landed after redirects — a removed posting
   *  often 200s on the site root, which the status code alone hides. */
  finalUrl?: string;
}

function makeAgent(proxy?: string): http.Agent | undefined {
  if (!proxy) return undefined;
  const p = proxy.trim();
  if (/^socks/i.test(p)) {
    return new SocksProxyAgent(p) as unknown as http.Agent;
  }
  const normalized = /^https?:\/\//i.test(p) ? p : `http://${p}`;
  return new HttpsProxyAgent(normalized) as unknown as http.Agent;
}

export async function fetchText(
  url: string,
  opts?: {
    headers?: Record<string, string>;
    proxy?: string | false;
    timeoutMs?: number;
    retries?: number;
    maxProxies?: number;
    /** When false, never hit origin without PROXY_1 (RU boards / DDoS-Guard). Default true. */
    directFallback?: boolean;
    /** Persistent cookie jar name (see cookies.ts), e.g. "hh". Sends and refreshes it. */
    cookieJar?: string;
  },
): Promise<FetchResult> {
  const timeoutMs = opts?.timeoutMs ?? 20000;
  const maxProxies = opts?.maxProxies ?? 6;
  const directFallback = opts?.directFallback !== false;

  let last: FetchResult = {
    ok: false,
    status: 0,
    text: "",
    ms: 0,
    viaProxy: false,
    error: "no attempt",
  };

  if (opts?.proxy === false) {
    return once(url, { headers: opts?.headers, timeoutMs, cookieJar: opts?.cookieJar });
  }

  if (typeof opts?.proxy === "string") {
    return once(url, {
      headers: opts.headers,
      proxy: opts.proxy,
      timeoutMs,
      cookieJar: opts.cookieJar,
    });
  }

  const pool = await getProxyPool();
  const tryList: Array<string | undefined> = [];
  for (let i = 0; i < Math.min(maxProxies, Math.max(pool.length, 1)); i++) {
    tryList.push(pool.length ? await nextProxy() : undefined);
  }
  // direct fallback last (skip for geo-locked RU boards)
  if (directFallback) tryList.push(undefined);

  const seen = new Set<string>();
  for (const useProxy of tryList) {
    const key = useProxy || "__direct__";
    if (seen.has(key)) continue;
    seen.add(key);

    last = await once(url, {
      headers: opts?.headers,
      proxy: useProxy,
      timeoutMs,
      cookieJar: opts?.cookieJar,
    });
    if (last.ok) return last;
    // 403/404 часто от «плохого» exit — пробуем следующий proxy
    const softFail =
      last.status === 0 ||
      last.status === 403 ||
      last.status === 404 ||
      last.status >= 500;
    if (!softFail) break;
  }

  if (!last.ok && last.status === 403 && !pool.length) {
    last.error = `${last.error || "403"}; задайте PROXY_1 (подписка/socks)`;
  }
  return last;
}

function once(
  url: string,
  opts: {
    headers?: Record<string, string>;
    proxy?: string;
    timeoutMs: number;
    cookieJar?: string;
  },
  redirectCount = 0,
): Promise<FetchResult> {
  const started = Date.now();
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const lib = u.protocol === "http:" ? http : https;
      const agent = makeAgent(opts.proxy);
      const jarHeader = opts.cookieJar
        ? cookieHeaderFor(opts.cookieJar, url)
        : undefined;
      const req = lib.request(
        url,
        {
          method: "GET",
          agent,
          headers: {
            "User-Agent": DEFAULT_UA,
            Accept: "*/*",
            "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
            ...(jarHeader ? { Cookie: jarHeader } : {}),
            ...(opts.headers || {}),
          },
          timeout: opts.timeoutMs,
        },
        (res) => {
          const status = res.statusCode || 0;
          if (opts.cookieJar) {
            mergeSetCookie(opts.cookieJar, url, res.headers["set-cookie"]);
          }
          if (status >= 301 && status <= 308 && res.headers.location) {
            res.resume();
            if (redirectCount >= MAX_REDIRECTS) {
              resolve({
                ok: false,
                status,
                text: "",
                ms: Date.now() - started,
                viaProxy: Boolean(opts.proxy),
                finalUrl: url,
                error: `Too many redirects (>${MAX_REDIRECTS})`,
              });
              return;
            }
            const next = new URL(res.headers.location, url).toString();
            once(next, opts, redirectCount + 1).then(resolve);
            return;
          }
          const chunks: Buffer[] = [];
          let bytes = 0;
          let aborted = false;
          res.on("data", (c: Buffer) => {
            if (aborted) return;
            bytes += c.length;
            if (bytes > MAX_BODY_BYTES) {
              aborted = true;
              req.destroy();
              resolve({
                ok: false,
                status,
                text: "",
                ms: Date.now() - started,
                viaProxy: Boolean(opts.proxy),
                finalUrl: url,
                error: `Response body exceeded ${MAX_BODY_BYTES} bytes`,
              });
              return;
            }
            chunks.push(c);
          });
          res.on("end", () => {
            if (aborted) return;
            const text = Buffer.concat(chunks).toString("utf8");
            resolve({
              ok: status >= 200 && status < 300,
              status,
              text,
              ms: Date.now() - started,
              viaProxy: Boolean(opts.proxy),
              finalUrl: url,
              error:
                status >= 200 && status < 300
                  ? undefined
                  : `Status code ${status}`,
            });
          });
        },
      );
      req.on("timeout", () => {
        req.destroy();
        resolve({
          ok: false,
          status: 0,
          text: "",
          ms: Date.now() - started,
          viaProxy: Boolean(opts.proxy),
          error: `Request timed out after ${opts.timeoutMs}ms`,
        });
      });
      req.on("error", (e) => {
        resolve({
          ok: false,
          status: 0,
          text: "",
          ms: Date.now() - started,
          viaProxy: Boolean(opts.proxy),
          error: e.message,
        });
      });
      req.end();
    } catch (e) {
      resolve({
        ok: false,
        status: 0,
        text: "",
        ms: Date.now() - started,
        viaProxy: Boolean(opts.proxy),
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });
}

export async function fetchJson<T = unknown>(
  url: string,
  opts?: {
    headers?: Record<string, string>;
    proxy?: string | false;
    cookieJar?: string;
  },
): Promise<{ data?: T; error?: string; status: number; ms: number }> {
  const res = await fetchText(url, opts);
  if (!res.ok) {
    return { error: res.error, status: res.status, ms: res.ms };
  }
  try {
    return { data: JSON.parse(res.text) as T, status: res.status, ms: res.ms };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "JSON parse error",
      status: res.status,
      ms: res.ms,
    };
  }
}
