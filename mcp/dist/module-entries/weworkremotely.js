import { fetchWeWorkRemotelyJobs } from "../adapters/weworkremotely.js";
export const meta = {
    id: "weworkremotely",
    version: "1.0.0",
    platforms: ["weworkremotely"],
};
export async function fetchJobs(_ctx, opts) {
    return fetchWeWorkRemotelyJobs({
        category: typeof opts?.category === "string" ? opts.category : undefined,
    });
}
