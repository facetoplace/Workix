import { fetchRemotiveJobs } from "../adapters/remotive.js";
export const meta = {
    id: "remotive",
    version: "1.0.0",
    platforms: ["remotive"],
};
export async function fetchJobs(_ctx, opts) {
    return fetchRemotiveJobs({
        category: typeof opts?.category === "string" ? opts.category : undefined,
    });
}
