import { fetchJobicyJobs } from "../adapters/jobicy.js";
export const meta = {
    id: "jobicy",
    version: "1.0.0",
    platforms: ["jobicy"],
};
export async function fetchJobs(_ctx, opts) {
    return fetchJobicyJobs({
        count: typeof opts?.count === "number" ? opts.count : undefined,
        tag: typeof opts?.tag === "string" ? opts.tag : undefined,
        geo: typeof opts?.geo === "string" ? opts.geo : undefined,
    });
}
