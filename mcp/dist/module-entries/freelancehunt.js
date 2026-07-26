import { fetchFreelancehuntJobs, freelancehuntBid, freelancehuntConfigured, } from "../adapters/freelancehunt.js";
export const meta = {
    id: "freelancehunt",
    version: "1.0.0",
    platforms: ["freelancehunt"],
    envKeys: ["FREELANCEHUNT_TOKEN"],
};
export function configured() {
    return freelancehuntConfigured();
}
export async function fetchJobs(_ctx) {
    return fetchFreelancehuntJobs();
}
export async function bid(_ctx, opts) {
    return freelancehuntBid(opts);
}
