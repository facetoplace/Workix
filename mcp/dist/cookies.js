/**
 * Persistent cookie jars for board sessions (hh, fl_ru, kwork, …).
 *
 * Jars live in `mcp/data/cookies/<jar>.json` and never leave the machine —
 * same rule as the Telegram session (see TELEGRAM.md). Login itself happens in
 * a real browser via `npm run hh:login`; nothing here ever asks for a password.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./store.js";
export function cookiesDir() {
    const dir = join(dataDir(), "cookies");
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
    return dir;
}
export function jarPath(jar) {
    return join(cookiesDir(), `${jar}.json`);
}
export function loadCookies(jar) {
    const file = jarPath(jar);
    if (!existsSync(file))
        return [];
    try {
        const parsed = JSON.parse(readFileSync(file, "utf8"));
        return Array.isArray(parsed.cookies) ? parsed.cookies : [];
    }
    catch {
        return [];
    }
}
export function saveCookies(jar, cookies) {
    const body = {
        jar,
        updated: new Date().toISOString(),
        cookies,
    };
    writeFileSync(jarPath(jar), JSON.stringify(body, null, 2), "utf8");
}
export function hasJar(jar) {
    return loadCookies(jar).length > 0;
}
function domainMatches(cookieDomain, host) {
    const d = cookieDomain.replace(/^\./, "").toLowerCase();
    const h = host.toLowerCase();
    return h === d || h.endsWith(`.${d}`);
}
function pathMatches(cookiePath, urlPath) {
    const c = cookiePath || "/";
    if (c === "/")
        return true;
    if (urlPath === c)
        return true;
    return urlPath.startsWith(c.endsWith("/") ? c : `${c}/`);
}
function notExpired(c, nowSec) {
    if (c.expires == null || c.expires <= 0)
        return true; // session cookie
    return c.expires > nowSec;
}
/** `Cookie:` header value for `url`, or undefined when the jar has nothing to send. */
export function cookieHeaderFor(jar, url) {
    let u;
    try {
        u = new URL(url);
    }
    catch {
        return undefined;
    }
    const nowSec = Math.floor(Date.now() / 1000);
    const secure = u.protocol === "https:";
    const matched = loadCookies(jar).filter((c) => domainMatches(c.domain, u.hostname) &&
        pathMatches(c.path, u.pathname) &&
        notExpired(c, nowSec) &&
        (secure || !c.secure));
    if (!matched.length)
        return undefined;
    // Longer paths win, per RFC 6265 ordering.
    matched.sort((a, b) => (b.path || "/").length - (a.path || "/").length);
    const seen = new Set();
    const parts = [];
    for (const c of matched) {
        if (seen.has(c.name))
            continue;
        seen.add(c.name);
        parts.push(`${c.name}=${c.value}`);
    }
    return parts.join("; ");
}
function parseSetCookie(line, url) {
    const [pair, ...attrs] = line.split(";");
    const eq = pair.indexOf("=");
    if (eq < 1)
        return undefined;
    let host;
    let defaultPath = "/";
    try {
        const u = new URL(url);
        host = u.hostname;
        defaultPath = u.pathname.replace(/\/[^/]*$/, "") || "/";
    }
    catch {
        return undefined;
    }
    const cookie = {
        name: pair.slice(0, eq).trim(),
        value: pair.slice(eq + 1).trim(),
        domain: host,
        path: defaultPath,
    };
    for (const raw of attrs) {
        const [k, ...rest] = raw.split("=");
        const key = k.trim().toLowerCase();
        const val = rest.join("=").trim();
        if (key === "domain" && val)
            cookie.domain = val.replace(/^\./, "");
        else if (key === "path" && val)
            cookie.path = val;
        else if (key === "secure")
            cookie.secure = true;
        else if (key === "httponly")
            cookie.httpOnly = true;
        else if (key === "max-age" && val) {
            const secs = Number(val);
            if (Number.isFinite(secs)) {
                cookie.expires = Math.floor(Date.now() / 1000) + secs;
            }
        }
        else if (key === "expires" && val && cookie.expires == null) {
            const t = Date.parse(val);
            if (!Number.isNaN(t))
                cookie.expires = Math.floor(t / 1000);
        }
    }
    return cookie;
}
/** Merge `Set-Cookie` response headers back into the jar so sessions stay fresh. */
export function mergeSetCookie(jar, url, setCookie) {
    if (!setCookie)
        return;
    const lines = Array.isArray(setCookie) ? setCookie : [setCookie];
    if (!lines.length)
        return;
    const existing = loadCookies(jar);
    let changed = false;
    for (const line of lines) {
        const parsed = parseSetCookie(line, url);
        if (!parsed)
            continue;
        const idx = existing.findIndex((c) => c.name === parsed.name &&
            c.domain.replace(/^\./, "") === parsed.domain &&
            c.path === parsed.path);
        // Deletion: empty value with a past expiry.
        const deleted = !parsed.value && parsed.expires != null && parsed.expires <= Math.floor(Date.now() / 1000);
        if (deleted) {
            if (idx >= 0) {
                existing.splice(idx, 1);
                changed = true;
            }
            continue;
        }
        if (idx >= 0)
            existing[idx] = parsed;
        else
            existing.push(parsed);
        changed = true;
    }
    if (changed)
        saveCookies(jar, existing);
}
export function jarStatus(jar) {
    const file = jarPath(jar);
    const cookies = loadCookies(jar);
    let updated;
    try {
        updated = JSON.parse(readFileSync(file, "utf8")).updated;
    }
    catch {
        /* jar missing or unreadable — reported via exists/count */
    }
    const future = cookies
        .map((c) => c.expires)
        .filter((e) => typeof e === "number" && e > 0)
        .sort((a, b) => a - b);
    return {
        jar,
        path: file,
        exists: existsSync(file),
        count: cookies.length,
        updated,
        expires_soonest: future.length
            ? new Date(future[0] * 1000).toISOString()
            : undefined,
        names: cookies.map((c) => c.name),
    };
}
