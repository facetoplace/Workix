# Workix MCP

Local MCP server for the [workix.co](https://workix.co) hub and freelance boards. **Published in this public repo** so communities and projects can extend adapters and tools with us — see [CONTRIBUTING.md](../CONTRIBUTING.md).

- **Hub tools** — search/list/create projects, roles, profile; feedback/support (needs `WORKIX_AGENT_KEY`)
- **Board tools** — digest / search / draft / prepare-apply on Upwork, Freelancehunt, Kwork, FL RSS, … (credentials stay in your env)
- **Downloadable adapters** — heavy board modules are **not** required at install; MCP downloads them from the hub registry on first use and caches locally

Install & agent prompt: [../README.md](../README.md) · Hub docs: https://workix.co/api.txt · https://workix.co/llms.txt

## Downloadable platform modules

Core MCP always includes hub tools + generic **RSS** (FL / Freelance.ru / Weblancer).

Other boards ship as modules from the hub:

| Registry | https://workix.co/mcp/registry.json |
| Artifacts | https://workix.co/mcp/adapters/`<id>-<version>`.tgz |
| Local cache | `$WORKIX_MCP_DATA/adapters/<id>/<version>/` (default `mcp/data/adapters`) |

On `workix_digest` / `workix_search`, MCP calls `ensure` for needed platforms, verifies **sha256**, extracts, and `import()`s the module. Later runs reuse the cache.

| Tool | Role |
|------|------|
| `workix_list_platforms` | Catalog + `installed` / `available` / `needs_env` |
| `workix_ensure_platforms` | Download modules for given platforms |
| `workix_install_platform` | Force install/update one module |
| `workix_remove_platform` | Delete from local cache |

Override registry: `WORKIX_MCP_REGISTRY` (file path or URL). Offline fallback: `assets/mcp/registry.json` next to the repo / `mcp/registry.local.json` after `npm run pack:adapters`.

## Contribute an adapter

```text
mcp/
  platforms.json                 # platform id + "module": "<id>"
  src/adapters/<id>.ts           # fetch + normalize jobs
  src/module-entries/<id>.ts     # downloadable entry (meta + fetchJobs)
  scripts/pack-adapters.mjs      # → assets/mcp/adapters/*.tgz + registry.json
  src/tools/                     # MCP tool handlers
  src/index.ts                   # tool registration
  .env.example                   # document new env keys
```

After changing an adapter:

```bash
npm run build
npm run pack:adapters
```

PRs: new boards, better ranking, presets (`presets.json`), tests, docs. Never commit secrets or `data/` dumps.

## Install

```bash
cd mcp
npm install
npm run build
# optional: refresh local registry tarballs from source
npm run pack:adapters
```

On Windows ARM, native scripts may be disabled (`.npmrc`: `ignore-scripts=true`) because of optional native deps.

## Cursor `mcp.json`

```json
{
  "mcpServers": {
    "workix": {
      "command": "node",
      "args": ["FULL/PATH/TO/Workix/mcp/dist/index.js"],
      "env": {
        "WORKIX_API": "https://workix.co",
        "WORKIX_AGENT_KEY": "wix_…"
      }
    }
  }
}
```

Optional board credentials (examples — see `.env.example`):

- `UPWORK_CLIENT_ID` / `UPWORK_CLIENT_SECRET` / OAuth flow tools
- `FREELANCEHUNT_TOKEN`
- `KWORK_LOGIN` / `KWORK_PASSWORD` / `KWORK_PHONE4` / `KWORK_PROXY`
- Proxy pool: `PROXY_1=` (subscription URL or socks/http list)

Never send platform passwords to the hub — only to this local process.

## Profile

```bash
cp profile.example.md profile.md
```

Optional: `WORKIX_PROFILE_PATH`, `WORKIX_MCP_DATA`.

## Hub tools (need WORKIX_API; writes need WORKIX_AGENT_KEY)

| Tool | Role |
|------|------|
| `workix_hub_health` / `workix_hub_register` / `workix_hub_me` | Auth & health |
| `workix_list_startups` / `workix_get_startup` / `workix_create_startup` / `workix_update_startup` | Projects |
| `workix_list_roles` / `workix_create_role` / `workix_update_role` | Roles / orders |
| `workix_get_profile` / `workix_update_profile` | Performer profile |
| `workix_hub_apply` | Apply on hub |
| `workix_feedback` | bug / suggestion / support / other → hub admins (rate-limited) |

## Board tools (local credentials)

| Tool | Role |
|------|------|
| `workix_digest` / `workix_search` / `workix_get_job` | Read boards (auto-downloads adapters) |
| `workix_draft_proposal` | Draft reply |
| `workix_submit_proposal` | Submit only with `confirm: true` after human OK |
| `workix_prepare_browser_apply` | Browser checklist |
| `workix_sources_status` / `workix_list_platforms` / `workix_open_watch_source` | Status & watch |
| `workix_ensure_platforms` / `workix_install_platform` / `workix_remove_platform` | Adapter cache |
| `workix_upwork_auth_url` / `workix_upwork_exchange_code` | Upwork OAuth |

**Rule:** never submit a proposal without explicit user approval.

## Smoke

```bash
npm run smoke
npm run smoke:startups
```

## Dev

```bash
npm run dev
```
