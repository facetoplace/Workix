import { fetchHnHiringJobs } from "../adapters/hn_hiring.js";
export const meta = {
    id: "hn_hiring",
    version: "1.0.0",
    platforms: ["hn_hiring"],
    envKeys: ["HN_HIRING_STORY"],
};
export async function fetchJobs(_ctx, opts) {
    return fetchHnHiringJobs({
        keywords: Array.isArray(opts?.keywords)
            ? opts.keywords.filter((k) => typeof k === "string")
            : undefined,
        limit: typeof opts?.limit === "number" ? opts.limit : undefined,
        storyId: typeof opts?.storyId === "string" ? opts.storyId : undefined,
    });
}
