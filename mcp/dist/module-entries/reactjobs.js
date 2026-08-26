import { fetchReactJobs } from "../adapters/reactjobs.js";
export const meta = {
    id: "reactjobs",
    version: "1.0.0",
    platforms: ["reactjobs"],
};
export async function fetchJobs(_ctx, opts) {
    return fetchReactJobs(opts);
}
