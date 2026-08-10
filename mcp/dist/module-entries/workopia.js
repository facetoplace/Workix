import { fetchWorkopiaJobs, workopiaConfigured } from "../adapters/workopia.js";
export const meta = {
    id: "workopia",
    version: "1.0.0",
    platforms: ["workopia"],
    envKeys: ["WORKOPIA_TOKEN", "WORKOPIA_CITY", "WORKOPIA_CALLBACK_PORT"],
};
export function configured() {
    return workopiaConfigured();
}
export async function fetchJobs(_ctx, opts) {
    return fetchWorkopiaJobs({
        keywords: Array.isArray(opts?.keywords)
            ? opts.keywords.filter((k) => typeof k === "string")
            : undefined,
        limit: typeof opts?.limit === "number" ? opts.limit : undefined,
        city: typeof opts?.city === "string" ? opts.city : undefined,
    });
}
