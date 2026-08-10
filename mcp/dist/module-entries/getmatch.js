import { fetchGetmatchJobs } from "../adapters/getmatch.js";
export const meta = {
    id: "getmatch",
    version: "1.0.0",
    platforms: ["getmatch"],
    envKeys: ["GETMATCH_LIMIT"],
};
export async function fetchJobs(_ctx, opts) {
    return fetchGetmatchJobs({
        keywords: Array.isArray(opts?.keywords)
            ? opts.keywords.filter((k) => typeof k === "string")
            : undefined,
        limit: typeof opts?.limit === "number" ? opts.limit : undefined,
    });
}
