#!/usr/bin/env node
/**
 * Smoke: hub register → create startup → role → list → apply
 *
 *   WORKIX_API=http://127.0.0.1:8787 node mcp/scripts/smoke-hub.mjs
 */
const API = (process.env.WORKIX_API || "http://127.0.0.1:8787").replace(/\/$/, "");

async function req(path, { method = "GET", body, key } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (key) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  console.log("[smoke-hub] API", API);
  const health = await req("/api/v1/health");
  console.log("[smoke-hub] health", health);

  const reg = await req("/api/v1/auth/register", { method: "POST", body: {} });
  const key = reg.agentApiKey;
  console.log("[smoke-hub] registered", reg.userId);

  const st = await req("/api/v1/startups", {
    method: "POST",
    key,
    body: {
      name: `Smoke ${Date.now()}`,
      description: "Smoke test startup from MCP/hub script",
      status: "pending",
      applyDefaults: { apply_email: "smoke@workix.co" },
    },
  });
  console.log("[smoke-hub] startup", st.slug, st.status);

  const role = await req("/api/v1/roles", {
    method: "POST",
    key,
    body: {
      startupId: st.id,
      title: "Smoke role",
      description: "Role created by smoke-hub",
      tags: ["smoke"],
      status: "pending",
    },
  });
  console.log("[smoke-hub] role", role.id, role.status);

  const list = await req("/api/v1/startups");
  console.log("[smoke-hub] public startups", (list.items || []).length);

  const apply = await req("/api/v1/applies", {
    method: "POST",
    key,
    body: {
      roleId: role.id,
      name: "Smoke Applicant",
      contact: "smoke@example.com",
      message: "Hello from smoke-hub",
    },
  });
  console.log("[smoke-hub] apply", apply);

  console.log("[smoke-hub] OK");
}

main().catch((e) => {
  console.error("[smoke-hub] FAIL", e.message || e);
  process.exit(1);
});
