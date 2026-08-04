import { fetchGrowthTalentJobs } from "../adapters/growth_talent.js";
export const meta = {
    id: "growth_talent",
    version: "1.0.0",
    platforms: ["growth_talent"],
};
export async function fetchJobs(_ctx, opts) {
    return fetchGrowthTalentJobs({
        q: typeof opts?.q === "string" ? opts.q : undefined,
        remote: typeof opts?.remote === "boolean" ? opts.remote : undefined,
        limit: typeof opts?.limit === "number" ? opts.limit : undefined,
        pages: typeof opts?.pages === "number" ? opts.pages : undefined,
    });
}
