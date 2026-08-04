import http from "node:http";
import https from "node:https";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import { getProxyPool, nextProxy } from "./proxyPool.js";
const DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
function makeAgent(proxy) {
    if (!proxy)
        return undefined;
    const p = proxy.trim();
    if (/^socks/i.test(p)) {
        return new SocksProxyAgent(p);
    }
    const normalized = /^https?:\/\//i.test(p) ? p : `http://${p}`;
    return new HttpsProxyAgent(normalized);
}
export async function fetchText(url, opts) {
    const timeoutMs = opts?.timeoutMs ?? 20000;
    const maxProxies = opts?.maxProxies ?? 6;
    const directFallback = opts?.directFallback !== false;
    let last = {
        ok: false,
        status: 0,
        text: "",
        ms: 0,
        viaProxy: false,
        error: "no attempt",
    };
    if (opts?.proxy === false) {
        return once(url, { headers: opts?.headers, timeoutMs });
    }
    if (typeof opts?.proxy === "string") {
        return once(url, {
            headers: opts.headers,
            proxy: opts.proxy,
            timeoutMs,
        });
    }
    const pool = await getProxyPool();
    const tryList = [];
    for (let i = 0; i < Math.min(maxProxies, Math.max(pool.length, 1)); i++) {
        tryList.push(pool.length ? await nextProxy() : undefined);
    }
    // direct fallback last (skip for geo-locked RU boards)
    if (directFallback)
        tryList.push(undefined);
    const seen = new Set();
    for (const useProxy of tryList) {
        const key = useProxy || "__direct__";
        if (seen.has(key))
            continue;
        seen.add(key);
        last = await once(url, {
            headers: opts?.headers,
            proxy: useProxy,
            timeoutMs,
        });
        if (last.ok)
            return last;
        // 403/404 часто от «плохого» exit — пробуем следующий proxy
        const softFail = last.status === 0 ||
            last.status === 403 ||
            last.status === 404 ||
            last.status >= 500;
        if (!softFail)
            break;
    }
    if (!last.ok && last.status === 403 && !pool.length) {
        last.error = `${last.error || "403"}; задайте PROXY_1 (подписка/socks)`;
    }
    return last;
}
function once(url, opts) {
    const started = Date.now();
    return new Promise((resolve) => {
        try {
            const u = new URL(url);
            const lib = u.protocol === "http:" ? http : https;
            const agent = makeAgent(opts.proxy);
            const req = lib.request(url, {
                method: "GET",
                agent,
                headers: {
                    "User-Agent": DEFAULT_UA,
                    Accept: "*/*",
                    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
                    ...(opts.headers || {}),
                },
                timeout: opts.timeoutMs,
            }, (res) => {
                const status = res.statusCode || 0;
                if (status >= 301 && status <= 308 && res.headers.location) {
                    const next = new URL(res.headers.location, url).toString();
                    res.resume();
                    once(next, opts).then(resolve);
                    return;
                }
                const chunks = [];
                res.on("data", (c) => chunks.push(c));
                res.on("end", () => {
                    const text = Buffer.concat(chunks).toString("utf8");
                    resolve({
                        ok: status >= 200 && status < 300,
                        status,
                        text,
                        ms: Date.now() - started,
                        viaProxy: Boolean(opts.proxy),
                        error: status >= 200 && status < 300
                            ? undefined
                            : `Status code ${status}`,
                    });
                });
            });
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
        }
        catch (e) {
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
export async function fetchJson(url, opts) {
    const res = await fetchText(url, opts);
    if (!res.ok) {
        return { error: res.error, status: res.status, ms: res.ms };
    }
    try {
        return { data: JSON.parse(res.text), status: res.status, ms: res.ms };
    }
    catch (e) {
        return {
            error: e instanceof Error ? e.message : "JSON parse error",
            status: res.status,
            ms: res.ms,
        };
    }
}
