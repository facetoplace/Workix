import { fetchFreelancerJobs, freelancerConfigured, freelancerPlaceBid, freelancerProjectId, } from "../adapters/freelancer.js";
export const meta = {
    id: "freelancer",
    version: "1.0.0",
    platforms: ["freelancer_com"],
    envKeys: ["FREELANCER_TOKEN", "FREELANCER_ACCESS_TOKEN"],
};
export function configured() {
    return freelancerConfigured();
}
export async function fetchJobs(_ctx, opts) {
    return fetchFreelancerJobs(opts);
}
export async function placeBid(_ctx, opts) {
    return freelancerPlaceBid(opts);
}
export function projectId(job) {
    return freelancerProjectId(job);
}
