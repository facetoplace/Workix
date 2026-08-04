import { fetchAidevboardJobs } from "../adapters/aidevboard.js";
export const meta = {
    id: "aidevboard",
    version: "1.0.0",
    platforms: ["aidevboard"],
    envKeys: ["AIDEV_API_KEY", "AIDEV_Q", "AIDEV_TAGS", "AIDEV_WORKPLACE"],
};
export async function fetchJobs(_ctx, opts) {
    return fetchAidevboardJobs({
        pages: typeof opts?.pages === "number" ? opts.pages : undefined,
        limit: typeof opts?.limit === "number" ? opts.limit : undefined,
        q: typeof opts?.q === "string" ? opts.q : undefined,
        tags: typeof opts?.tags === "string" ? opts.tags : undefined,
        workplace: typeof opts?.workplace === "string" ? opts.workplace : undefined,
    });
}
