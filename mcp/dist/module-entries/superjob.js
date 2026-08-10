import { fetchSuperJobJobs, superjobConfigured, } from "../adapters/superjob.js";
export const meta = {
    id: "superjob",
    version: "1.0.0",
    platforms: ["superjob"],
    envKeys: [
        "SUPERJOB_APP_ID",
        "SUPERJOB_KEYWORD",
        "SUPERJOB_TOWN",
        "SUPERJOB_REMOTE_ONLY",
    ],
};
export function configured() {
    return superjobConfigured();
}
export async function fetchJobs(_ctx, opts) {
    const kw = Array.isArray(opts?.keywords) ? opts.keywords : [];
    return fetchSuperJobJobs({
        keyword: typeof opts?.keyword === "string" ? opts.keyword : kw.join(" ") || undefined,
    });
}
