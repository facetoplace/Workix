import { fetchAijobsJobs } from "../adapters/aijobs.js";
export const meta = {
    id: "aijobs",
    version: "1.0.0",
    platforms: ["aijobs"],
};
export async function fetchJobs(_ctx, opts) {
    return fetchAijobsJobs(opts);
}
