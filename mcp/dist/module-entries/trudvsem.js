import { fetchTrudvsemJobs } from "../adapters/trudvsem.js";
export const meta = {
    id: "trudvsem",
    version: "1.0.0",
    platforms: ["trudvsem"],
    envKeys: ["TRUDVSEM_TEXT", "TRUDVSEM_REGION"],
};
export async function fetchJobs(_ctx, opts) {
    return fetchTrudvsemJobs({
        text: typeof opts?.text === "string" ? opts.text : undefined,
        keywords: Array.isArray(opts?.keywords)
            ? opts.keywords
            : undefined,
        region: typeof opts?.region === "string" ? opts.region : undefined,
        limit: typeof opts?.limit === "number" ? opts.limit : undefined,
    });
}
