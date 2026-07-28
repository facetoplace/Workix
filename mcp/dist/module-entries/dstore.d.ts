import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import { dstoreGetCard, dstoreGetList, dstorePublish, dstoreQuota, dstoreSearch, dstoreSimilar, DSTORE_DOCS } from "../adapters/dstore.js";
export declare const meta: AdapterMeta;
/** Not a job board — use search/publish helpers (or official dstore-mcp). */
export declare function fetchJobs(_ctx: AdapterContext): Promise<{
    jobs: never[];
    error: string;
}>;
export { dstorePublish as publish, dstoreGetCard as getCard, dstoreSearch as search, dstoreSimilar as similar, dstoreQuota as quota, dstoreGetList as getList, DSTORE_DOCS, };
