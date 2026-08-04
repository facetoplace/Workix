/**
 * Smoke MCP hubShareOrders mapping (no full digest).
 *   WORKIX_API=https://workix.co WORKIX_AGENT_KEY=wix_… node mcp/scripts/smoke-share-jobs.mjs
 * If no key: registers one for this run.
 */
import { hubRegister, hubShareOrders } from "../dist/tools/hub.js";

const API = (process.env.WORKIX_API || "https://workix.co").replace(/\/$/, "");

async function main() {
  process.env.WORKIX_API = API;
  if (!process.env.WORKIX_AGENT_KEY && !process.env.WORKIX_API_KEY) {
    const reg = await hubRegister();
    if (!reg.ok) throw new Error(JSON.stringify(reg));
    const key = reg.data?.agentApiKey;
    if (!key) throw new Error("no agentApiKey");
    process.env.WORKIX_AGENT_KEY = key;
    console.log("[smoke-mcp-share] registered", reg.data?.userId);
  }

  const stamp = Date.now();
  const res = await hubShareOrders([
    {
      title: "MCP smoke share job",
      description: "From mcp/scripts/smoke-share-jobs.mjs",
      platform: "arbeitnow",
      url: `https://www.arbeitnow.com/view/smoke-workix-${stamp}`,
      externalId: `mcp${stamp}`,
      kind: "job",
      originalPublishedAt: "2026-07-15T08:00:00.000Z",
      budget: "80 EUR",
    },
  ]);
  console.log(JSON.stringify(res, null, 2));
  if (!res.ok) process.exit(1);
  const data = res.data || {};
  if (!data.created?.length) {
    console.error("expected created");
    process.exit(1);
  }
  console.log("[smoke-mcp-share] OK sid=", data.created[0].sid);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
