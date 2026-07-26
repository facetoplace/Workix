import { fetchRemoteOkJobs } from "../adapters/remoteok.js";
export const meta = {
    id: "remoteok",
    version: "1.0.0",
    platforms: ["remoteok"],
};
export async function fetchJobs(_ctx) {
    return fetchRemoteOkJobs();
}
