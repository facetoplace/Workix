import { fetchWorkingNomadsJobs } from "../adapters/working_nomads.js";
export const meta = {
    id: "working_nomads",
    version: "1.0.0",
    platforms: ["working_nomads"],
};
export async function fetchJobs(_ctx, opts) {
    return fetchWorkingNomadsJobs({
        category: typeof opts?.category === "string" ? opts.category : undefined,
    });
}
