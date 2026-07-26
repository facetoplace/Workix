import { fetchUpworkJobs, upworkAuthUrl, upworkCompanySelector, upworkConfigured, upworkCreateProposal, upworkExchangeCode, upworkJobReference, } from "../adapters/upwork.js";
export const meta = {
    id: "upwork",
    version: "1.0.0",
    platforms: ["upwork"],
    envKeys: [
        "UPWORK_CLIENT_ID",
        "UPWORK_CLIENT_SECRET",
        "UPWORK_REDIRECT_URI",
        "UPWORK_ACCESS_TOKEN",
        "UPWORK_REFRESH_TOKEN",
    ],
};
export function configured() {
    return upworkConfigured();
}
export async function fetchJobs(_ctx, opts) {
    return fetchUpworkJobs(opts);
}
export function authUrl(state) {
    return upworkAuthUrl(state);
}
export async function exchangeCode(code) {
    return upworkExchangeCode(code);
}
export async function companySelector() {
    return upworkCompanySelector();
}
export async function createProposal(opts) {
    return upworkCreateProposal(opts);
}
export function jobReference(job) {
    return upworkJobReference(job);
}
