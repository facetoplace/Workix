import { fetchOpenworkJobs } from "../adapters/openwork.js";
export const meta = {
    id: "openwork",
    version: "1.0.0",
    platforms: ["openwork"],
};
export async function fetchJobs(_ctx, opts) {
    return fetchOpenworkJobs({
        openOnly: typeof opts?.openOnly === "boolean" ? opts.openOnly : undefined,
    });
}
