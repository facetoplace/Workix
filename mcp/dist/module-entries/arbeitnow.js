import { fetchArbeitnowJobs } from "../adapters/arbeitnow.js";
export const meta = {
    id: "arbeitnow",
    version: "1.0.0",
    platforms: ["arbeitnow"],
};
export async function fetchJobs(_ctx, opts) {
    return fetchArbeitnowJobs({
        pages: typeof opts?.pages === "number" ? opts.pages : undefined,
        remoteOnly: typeof opts?.remoteOnly === "boolean" ? opts.remoteOnly : undefined,
    });
}
