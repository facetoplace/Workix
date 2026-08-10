import { fetchGetOnBrdJobs } from "../adapters/getonbrd.js";
export const meta = {
    id: "getonbrd",
    version: "1.0.0",
    platforms: ["getonbrd"],
    envKeys: ["GETONBRD_QUERY", "GETONBRD_REMOTE_ONLY"],
};
export async function fetchJobs(_ctx, opts) {
    const kw = Array.isArray(opts?.keywords) ? opts.keywords : [];
    return fetchGetOnBrdJobs({
        query: typeof opts?.query === "string" ? opts.query : kw.join(" ") || undefined,
    });
}
