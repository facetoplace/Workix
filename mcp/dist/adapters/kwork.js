import { createRequire } from "node:module";
import { loadEnv } from "../env.js";
import { nextProxy } from "../proxyPool.js";
import { jobId } from "../store.js";
const require = createRequire(import.meta.url);
export function kworkConfigured() {
    return Boolean(process.env.KWORK_LOGIN &&
        process.env.KWORK_PASSWORD &&
        process.env.KWORK_PHONE4);
}
async function client() {
    loadEnv();
    if (!kworkConfigured()) {
        throw new Error("Kwork не настроен. Задайте KWORK_LOGIN, KWORK_PASSWORD, KWORK_PHONE4 (последние 4 цифры телефона).");
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Kwork = require("kwork-api");
    const login = process.env.KWORK_LOGIN;
    const password = process.env.KWORK_PASSWORD;
    const phone4 = process.env.KWORK_PHONE4;
    // kwork-api expects socks URL when proxy set
    const proxy = process.env.KWORK_PROXY ||
        (await nextProxy()) ||
        undefined;
    return proxy
        ? new Kwork(login, password, phone4, proxy)
        : new Kwork(login, password, phone4);
}
function mapProject(p) {
    const idNum = p.id ?? p.project_id;
    const title = String(p.name || p.title || "").trim();
    const description = String(p.description || p.want_description || "").trim();
    if (!title)
        return null;
    const link = typeof p.url === "string" && p.url.startsWith("http")
        ? p.url
        : `https://kwork.ru/projects/${idNum}`;
    const budgetParts = [];
    if (p.price_limit != null)
        budgetParts.push(String(p.price_limit));
    if (p.possible_price_limit != null)
        budgetParts.push(`~${p.possible_price_limit}`);
    const dateRaw = p.date_confirm || p.date_create || p.date || Date.now();
    const date = typeof dateRaw === "number"
        ? new Date(dateRaw * (dateRaw < 1e12 ? 1000 : 1)).toISOString()
        : new Date(String(dateRaw)).toISOString();
    return {
        id: jobId("kwork", link),
        platform: "kwork",
        kind: "gig",
        title,
        description,
        link,
        date,
        budget: budgetParts.length ? budgetParts.join(" / ") : undefined,
        fetchedAt: new Date().toISOString(),
        raw: p,
    };
}
export async function fetchKworkJobs() {
    if (!kworkConfigured()) {
        return {
            jobs: [],
            error: "Kwork credentials missing (optional for digest)",
        };
    }
    try {
        const kw = await client();
        const resp = await kw.getProjects();
        // kwork-api often returns null after failed signIn / broken proxy TLS,
        // then later throws unhandledRejection from getChannel — treat as soft error.
        if (resp == null) {
            return {
                jobs: [],
                error: "Kwork API returned null (auth or proxy TLS failed)",
            };
        }
        const list = (resp?.response || resp || []);
        if (!Array.isArray(list)) {
            return { jobs: [], error: "Kwork API unexpected payload" };
        }
        const jobs = list.map(mapProject).filter(Boolean);
        return { jobs };
    }
    catch (e) {
        return {
            jobs: [],
            error: e instanceof Error ? e.message : String(e),
        };
    }
}
export async function kworkGetMe() {
    try {
        const kw = await client();
        return await kw.getMe();
    }
    catch (e) {
        return {
            error: e instanceof Error ? e.message : String(e),
        };
    }
}
