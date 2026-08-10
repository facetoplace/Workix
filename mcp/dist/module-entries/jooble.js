import { fetchJoobleJobs, joobleConfigured } from "../adapters/jooble.js";
export const meta = {
    id: "jooble",
    version: "1.0.0",
    platforms: ["jooble"],
    envKeys: ["JOOBLE_API_KEY", "JOOBLE_KEYWORDS", "JOOBLE_LOCATION"],
};
export function configured() {
    return joobleConfigured();
}
export async function fetchJobs(_ctx, opts) {
    const kw = Array.isArray(opts?.keywords) ? opts.keywords : [];
    return fetchJoobleJobs({
        keywords: typeof opts?.query === "string" ? opts.query : kw.join(" ") || undefined,
    });
}
