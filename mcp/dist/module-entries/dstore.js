import { dstoreGetCard, dstoreGetList, dstorePublish, dstoreQuota, dstoreSearch, dstoreSimilar, DSTORE_DOCS, } from "../adapters/dstore.js";
export const meta = {
    id: "dstore",
    version: "1.1.0",
    platforms: ["dstore"],
    envKeys: ["DSTORE_API_KEY", "DSTORE_API_BASE"],
};
/** Not a job board — use search/publish helpers (or official dstore-mcp). */
export async function fetchJobs(_ctx) {
    return {
        jobs: [],
        error: "optional: dStore is an app catalog. Use workix_dstore_search / _publish / _similar (or dstore-mcp).",
    };
}
export { dstorePublish as publish, dstoreGetCard as getCard, dstoreSearch as search, dstoreSimilar as similar, dstoreQuota as quota, dstoreGetList as getList, DSTORE_DOCS, };
