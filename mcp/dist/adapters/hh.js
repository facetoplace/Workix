import { hasJar, loadCookies } from "../cookies.js";
import { loadEnv } from "../env.js";
import { fetchJson, fetchText } from "../http.js";
import { fetchHhHtmlViaBrowser } from "./hhBrowser.js";
import { jobId } from "../store.js";
const JAR = "hh";
function cookieValue(jar, name) {
    return loadCookies(jar).find((c) => c.name === name)?.value;
}
function hhHeaders() {
    loadEnv();
    const ua = process.env.HH_USER_AGENT ||
        "WorkixMCP/0.1 (dev@workix.co; +https://workix.co)";
    const headers = {
        "User-Agent": ua,
        Accept: "application/json",
    };
    const token = process.env.HH_APP_TOKEN?.trim();
    if (token)
        headers.Authorization = `Bearer ${token}`;
    return headers;
}
/**
 * Full browser header set for hh.ru web pages.
 *
 * Not cosmetic: with a minimal header set DDoS-Guard answers /search/vacancy
 * with a 403 JS challenge even when the session cookies are valid.
 */
function webHeaders() {
    return {
        "User-Agent": process.env.HH_USER_AGENT ||
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        Referer: "https://hh.ru/",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
    };
}
/** hh escapes the payload with numeric entities (&#34;), not named ones. */
function decodeEntities(s) {
    return s
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&"); // last, so decoded text is not re-decoded
}
/** hh.ru embeds its SSR payload in a <template id="HH-Lux-InitialState"> tag. */
function extractInitialState(html) {
    const m = html.match(/<template[^>]+id="HH-Lux-InitialState"[^>]*>([\s\S]*?)<\/template>/i);
    if (!m)
        return undefined;
    try {
        return JSON.parse(decodeEntities(m[1]));
    }
    catch {
        return undefined;
    }
}
function isChallenge(html) {
    return /<title>DDoS-Guard<\/title>|ddos-guard\/js-challenge/i.test(html);
}
/** Fetch an hh.ru page with the saved session and return its SSR state. */
export async function fetchHhState(url) {
    if (!hasJar(JAR)) {
        return { status: 0, error: "Нет сессии hh — cd mcp && npm run hh:login" };
    }
    const res = await fetchText(url, {
        headers: webHeaders(),
        proxy: false,
        cookieJar: JAR,
    });
    if (res.ok && !isChallenge(res.text)) {
        const state = extractInitialState(res.text);
        if (state)
            return { state, status: res.status, via: "http" };
    }
    // Challenged or unparseable — replay it in the logged-in Chrome profile.
    const { html, error } = await fetchHhHtmlViaBrowser(url);
    if (!html) {
        return {
            status: res.status,
            via: "browser",
            error: error || `HTTP ${res.status}`,
        };
    }
    const state = extractInitialState(html);
    return state
        ? { state, status: 200, via: "browser" }
        : {
            status: res.status,
            via: "browser",
            error: "HH-Lux-InitialState не найден/не распарсился",
        };
}
export async function verifySession() {
    const jar = hasJar(JAR);
    if (!jar) {
        return {
            authorized: false,
            status: 0,
            jar: false,
            hint: "cd mcp && npm run hh:login",
        };
    }
    // The cookie is the source of truth: hh issues hhrole=applicant only to a
    // logged-in account. A challenged HTTP probe says nothing about the session,
    // so it must not be read as "logged out".
    const role = cookieValue(JAR, "hhrole");
    const roleAuthorized = Boolean(role) && role !== "anonymous";
    const res = await fetchText("https://hh.ru/", {
        headers: webHeaders(),
        proxy: false,
        cookieJar: JAR,
    });
    if (!res.ok || isChallenge(res.text)) {
        return {
            authorized: roleAuthorized,
            userType: role,
            status: res.status,
            jar: true,
            hint: roleAuthorized
                ? "Сессия жива (hhrole), но HTTP словил DDoS-Guard — читаю через браузерный профиль"
                : res.error || "DDoS-Guard challenge",
        };
    }
    const state = extractInitialState(res.text);
    const userType = state?.userType ||
        state?.session?.userType ||
        // The payload is huge; a targeted match avoids parsing ~1.5 MB of JSON.
        res.text.match(/&#34;userType&#34;:&#34;([a-z]+)&#34;|"userType":"([a-z]+)"/i)?.slice(1).find(Boolean) ||
        undefined;
    const authorized = roleAuthorized || Boolean(userType && userType !== "anonymous");
    return {
        authorized,
        userType: userType || role,
        status: res.status,
        jar: true,
        hint: authorized ? undefined : "Сессия истекла — cd mcp && npm run hh:login",
    };
}
function normalize(v) {
    const id = String(v.id ?? v.vacancyId ?? "");
    if (!id)
        return undefined;
    const link = v.alternate_url || v.links?.desktop || `https://hh.ru/vacancy/${id}`;
    const desc = [v.snippet?.requirement, v.snippet?.responsibility]
        .filter(Boolean)
        .join(" ");
    const pay = v.salary || v.compensation;
    let budget;
    if (pay) {
        const parts = [pay.from, pay.to].filter((x) => x != null);
        const cur = pay.currency ||
            pay.currencyCode ||
            "RUR";
        budget = parts.length ? `${parts.join("–")} ${cur}` : undefined;
    }
    const published = v.published_at ||
        (typeof v.publicationTime === "string"
            ? v.publicationTime
            : v.publicationTime?.$) ||
        new Date().toISOString();
    const employer = v.employer?.name || v.company?.visibleName || v.company?.name;
    return {
        id: jobId("hh", link),
        platform: "hh",
        kind: "job",
        title: v.name,
        description: `${employer ? employer + ". " : ""}${desc}`,
        link,
        date: published,
        budget,
        fetchedAt: new Date().toISOString(),
        raw: v,
    };
}
/** Logged-in web search — works when api.hh.ru refuses anonymous callers. */
async function fetchViaSession(text, pages) {
    const jobs = [];
    let lastError;
    for (let page = 0; page < pages; page++) {
        const url = `https://hh.ru/search/vacancy?text=${encodeURIComponent(text)}` +
            `&schedule=remote&items_on_page=50&page=${page}`;
        // fetchHhState replays the request in the logged-in Chrome profile when
        // DDoS-Guard answers plain HTTP with a challenge.
        const { state, status, error } = await fetchHhState(url);
        if (!state) {
            lastError = error || `HH web HTTP ${status}`;
            break;
        }
        const result = state?.vacancySearchResult;
        const items = result?.vacancies;
        if (!items?.length) {
            if (page === 0)
                lastError = "HH web: vacancySearchResult empty (вёрстка/сессия)";
            break;
        }
        for (const v of items) {
            const job = normalize(v);
            if (job)
                jobs.push(job);
        }
        if (items.length < 50)
            break;
    }
    return { jobs, error: jobs.length === 0 ? lastError : undefined };
}
async function fetchViaApi(text, pages) {
    const perPage = 50;
    const jobs = [];
    let lastError;
    // remote + project; second pass part-time remote
    const queries = [
        `schedule=remote&employment=project&text=${encodeURIComponent(text)}`,
        `schedule=remote&employment=part&text=${encodeURIComponent(text)}`,
    ];
    for (const q of queries) {
        for (let page = 0; page < pages; page++) {
            const url = `https://api.hh.ru/vacancies?${q}&per_page=${perPage}&page=${page}`;
            const { data, error, status } = await fetchJson(url, { headers: hhHeaders(), proxy: false });
            if (error || !data?.items) {
                lastError = error || `HH HTTP ${status}`;
                break;
            }
            for (const v of data.items) {
                const job = normalize(v);
                if (job)
                    jobs.push(job);
            }
            if (data.items.length < perPage)
                break;
        }
    }
    return { jobs, error: jobs.length === 0 ? lastError : undefined };
}
export async function fetchHhJobs(opts) {
    loadEnv();
    const text = opts?.text || "разработчик";
    const maxPages = opts?.pages ?? 1;
    // api.hh.ru rejects anonymous callers ({"errors":[{"type":"forbidden"}]}), so
    // prefer the saved browser session; fall back to the API when a token exists.
    const attempts = [];
    if (hasJar(JAR))
        attempts.push(() => fetchViaSession(text, maxPages));
    attempts.push(() => fetchViaApi(text, maxPages));
    let lastError;
    for (const attempt of attempts) {
        const r = await attempt();
        if (r.jobs.length) {
            const map = new Map(r.jobs.map((j) => [j.id, j]));
            return { jobs: [...map.values()] };
        }
        lastError = r.error || lastError;
    }
    return {
        jobs: [],
        error: hasJar(JAR)
            ? lastError
            : `${lastError || "HH forbidden"}; залогинься: cd mcp && npm run hh:login`,
    };
}
