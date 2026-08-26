import { fetchWeb3CareerJobs } from "../adapters/web3career.js";
export const meta = {
    id: "web3career",
    version: "1.0.0",
    platforms: ["web3career"],
};
export async function fetchJobs(_ctx, opts) {
    return fetchWeb3CareerJobs(opts);
}
