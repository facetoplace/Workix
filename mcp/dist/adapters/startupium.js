import { fetchText } from "../http.js";
import { jobId } from "../store.js";
const BASE = "https://startupium.ru";
function decode(s) {
    return s
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'");
}
function text(html) {
    return decode(html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}
function title(html, fallback) {
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
    const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    return text(h1 || t || fallback).replace(/\s*[|—-]\s*Startupium.*$/i, "").trim();
}
function description(html) {
    const meta = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1];
    return text(meta || html).slice(0, 2500);
}
function links(html, kind) {
    const out = new Set();
    const re = new RegExp(`href=["'](\\/${kind}\\/[^"'#?]+)`, "gi");
    for (const m of html.matchAll(re))
        out.add(`${BASE}${m[1]}`);
    return [...out];
}
export async function fetchStartupiumLeads(opts) {
    const kind = opts?.kind || "all";
    const limit = Math.min(Math.max(opts?.limit ?? 30, 1), 80);
    const words = (opts?.keywords || []).map((x) => x.trim().toLowerCase()).filter(Boolean);
    const paths = kind === "projects" ? ["/projects"] : kind === "profiles" ? ["/users"] : ["/"];
    const listing = await Promise.all(paths.map((path) => fetchText(`${BASE}${path}`, { proxy: false, timeoutMs: 20000 })));
    const detailLinks = [...new Set(listing.flatMap((r) => [...links(r.text, "project"), ...links(r.text, "profile")]))].slice(0, limit * 2);
    const jobs = [];
    for (const link of detailLinks) {
        const isProject = /\/project\//i.test(link);
        if (kind === "projects" && !isProject)
            continue;
        if (kind === "profiles" && isProject)
            continue;
        const r = await fetchText(link, { proxy: false, timeoutMs: 15000 });
        if (!r.ok)
            continue;
        const name = title(r.text, link.split("/").pop() || "Startupium");
        const desc = description(r.text);
        if (words.length && !words.some((w) => `${name} ${desc}`.toLowerCase().includes(w)))
            continue;
        const now = new Date().toISOString();
        jobs.push({
            id: jobId("startupium", link),
            platform: "startupium",
            kind: "lead",
            title: `${isProject ? "Проект" : "Участник"}: ${name}`.slice(0, 200),
            description: desc,
            link,
            date: now,
            fetchedAt: now,
            raw: { source: isProject ? "startupium_project" : "startupium_profile" },
        });
        if (jobs.length >= limit)
            break;
    }
    return jobs.length ? { jobs } : { jobs, error: "startupium: no public project/profile cards parsed" };
}
