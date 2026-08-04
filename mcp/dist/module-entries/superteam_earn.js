import { fetchSuperteamEarnJobs, superteamEarnConfigured, } from "../adapters/superteam_earn.js";
export const meta = {
    id: "superteam_earn",
    version: "1.0.0",
    platforms: ["superteam_earn"],
    envKeys: ["SUPERTEAM_EARN_API_KEY"],
};
export function configured() {
    return superteamEarnConfigured();
}
export async function fetchJobs(_ctx, opts) {
    return fetchSuperteamEarnJobs({
        take: typeof opts?.take === "number" ? opts.take : undefined,
        type: typeof opts?.type === "string" ? opts.type : undefined,
    });
}
