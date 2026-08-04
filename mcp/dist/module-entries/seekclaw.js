import { fetchSeekClawJobs } from "../adapters/seekclaw.js";
export const meta = {
    id: "seekclaw",
    version: "1.0.0",
    platforms: ["seekclaw"],
};
export async function fetchJobs(_ctx, opts) {
    return fetchSeekClawJobs({
        limit: typeof opts?.limit === "number" ? opts.limit : undefined,
        offset: typeof opts?.offset === "number" ? opts.offset : undefined,
    });
}
