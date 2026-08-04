import { loadEnv } from "../env.js";
export function tgApiId() {
    loadEnv();
    const n = Number(process.env.TELEGRAM_API_ID ||
        process.env.TG_APP_API_ID ||
        process.env.TG_API_ID ||
        0);
    return Number.isFinite(n) ? n : 0;
}
export function tgApiHash() {
    loadEnv();
    return String(process.env.TELEGRAM_API_HASH ||
        process.env.TG_APP_API_HASH ||
        process.env.TG_API_HASH ||
        "").trim();
}
export function tgCredentialsConfigured() {
    return tgApiId() > 0 && tgApiHash().length >= 16;
}
