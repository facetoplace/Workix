import { fetchHhJobs } from "../adapters/hh.js";
export const meta = {
    id: "hh",
    version: "1.0.0",
    platforms: ["hh"],
    envKeys: ["HH_USER_AGENT", "HH_APP_TOKEN"],
};
export async function fetchJobs(_ctx, opts) {
    return fetchHhJobs(opts);
}
