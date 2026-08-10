import { fetchUsaJobs, usajobsConfigured } from "../adapters/usajobs.js";
export const meta = {
    id: "usajobs",
    version: "1.0.0",
    platforms: ["usajobs"],
    envKeys: [
        "USAJOBS_API_KEY",
        "USAJOBS_EMAIL",
        "USAJOBS_KEYWORD",
        "USAJOBS_REMOTE_ONLY",
    ],
};
export function configured() {
    return usajobsConfigured();
}
export async function fetchJobs(_ctx, opts) {
    const kw = Array.isArray(opts?.keywords) ? opts.keywords : [];
    return fetchUsaJobs({
        keyword: typeof opts?.keyword === "string" ? opts.keyword : kw.join(" ") || undefined,
    });
}
