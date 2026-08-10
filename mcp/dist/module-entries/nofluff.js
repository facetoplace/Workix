import { fetchNoFluffJobs } from "../adapters/nofluff.js";
export const meta = {
    id: "nofluff",
    version: "1.0.0",
    platforms: ["nofluff"],
    envKeys: ["NOFLUFF_CATEGORY", "NOFLUFF_REGION", "NOFLUFF_REMOTE_ONLY"],
};
export async function fetchJobs(_ctx, opts) {
    return fetchNoFluffJobs({
        category: typeof opts?.category === "string" ? opts.category : undefined,
        keywords: Array.isArray(opts?.keywords)
            ? opts.keywords
            : undefined,
        limit: typeof opts?.limit === "number" ? opts.limit : undefined,
    });
}
