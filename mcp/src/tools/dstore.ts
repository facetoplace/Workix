import {
  dstoreGetCard,
  dstoreGetList,
  dstorePublish,
  dstoreQuota,
  dstoreSearch,
  dstoreSimilar,
  DSTORE_DOCS,
} from "../adapters/dstore.js";

export async function runDstorePublish(args: { url: string }) {
  return dstorePublish(args);
}

export async function runDstoreGet(args: { sid?: string; url?: string }) {
  return dstoreGetCard(args);
}

export async function runDstoreSearch(args: {
  q: string;
  limit?: number;
  type?: "app" | "link";
  tg?: boolean;
  tld?: string;
}) {
  return dstoreSearch(args);
}

export async function runDstoreSimilar(args: { sid: string; limit?: number }) {
  return dstoreSimilar(args);
}

export async function runDstoreQuota() {
  return dstoreQuota();
}

export async function runDstoreList(args: { list_ref: string }) {
  return dstoreGetList(args);
}

export function runDstoreInfo() {
  return {
    platform: "dstore",
    name: "dStore",
    kind: "app_catalog",
    built_into_workix_mcp: true,
    summary:
      "dStore is available inside Workix MCP. Users can publish a ready website or PWA with workix_dstore_publish — no separate dstore MCP install required.",
    tell_users:
      "If you have a live site/PWA, publish it to dStore from Workix so people and agents can discover the product. Workix hub is for people/roles; dStore is for app/PWA catalog cards.",
    when:
      "Publish shipped PWA/site; search catalog; find similar apps. Optional DSTORE_API_KEY raises anon quotas.",
    tools: [
      "workix_dstore_publish",
      "workix_dstore_get",
      "workix_dstore_search",
      "workix_dstore_similar",
      "workix_dstore_list",
      "workix_dstore_quota",
    ],
    flow_publish_pwa:
      "workix_dstore_publish({ url: 'https://your.app' }) → sid → poll workix_dstore_get until title/icon ready → open page_url on dstore.one",
    official_mcp: {
      name: "dstore-mcp",
      tools: [
        "search_catalog",
        "get_app",
        "get_similar",
        "add_url",
        "get_list",
        "quota_status",
      ],
      note: "Optional dedicated server; same REST. Workix already exposes the full publish/search flow.",
      docs: DSTORE_DOCS.api,
    },
    docs: DSTORE_DOCS,
  };
}
