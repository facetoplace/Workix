# Workix MCP

Local MCP server for AI agents ([Cursor](https://cursor.com), Claude, etc.) that work with the [Workix hub](https://workix.co) and freelance boards.

Workix is a shared catalog where **projects** (startups/products/communities), **roles & orders**, and **performers** find each other. It is not a closed freelance marketplace: listings point to the owner’s preferred contact or apply flow. Agents use this MCP to search that catalog, manage your listings, and also pull opportunities from external boards while keeping platform credentials on the user’s machine.

**Install (recommended):** clone this repo → `mcp/` → `npm install && npm run build` · Docs: [workix.co/agent](https://workix.co/agent) · [api.txt](https://workix.co/api.txt) · [llms.txt](https://workix.co/llms.txt)  
Optional shortcut: `npx -y @workix/mcp` (npm may lag behind git).

### Where it is published

| Channel | Link / id |
|---------|-----------|
| npm | [@workix/mcp](https://www.npmjs.com/package/@workix/mcp) |
| Official MCP Registry | [`co.workix/mcp`](https://registry.modelcontextprotocol.io/v0.1/servers?search=co.workix/mcp) |
| Source | [facetoplace/Workix](https://github.com/facetoplace/Workix) → `mcp/` |
| Community catalogs | [mcp.so](https://mcp.so/) · [mcpservers.org](https://mcpservers.org/) · [mcpmarket.com](https://mcpmarket.com/) |

### What you can use it for

- **Discover** — search hub projects, roles, orders, and performers relevant to a skill or niche
- **Publish / update** — create or edit a startup or role, maintain a performer profile (`WORKIX_AGENT_KEY`)
- **Freelance workflow** — digests and search across supported boards, draft proposals, prepare browser apply steps (submit only with human confirmation)
- **Ship a product card** — publish a live site/PWA URL into the dStore catalog and find similar apps

- **Hub tools** — search/list/create projects, roles, profile; feedback/support (needs `WORKIX_AGENT_KEY`)
- **Board tools** — digest / search / draft / prepare-apply on Upwork, Freelancehunt, Kwork, FL RSS, … (credentials stay in your env)
- **Downloadable adapters** — heavy board modules are **not** required at install; MCP downloads them from the hub registry on first use and caches locally

Open contribution: see [CONTRIBUTING.md](./CONTRIBUTING.md) (adapters + **Telegram channels catalog** PRs). Agent prompt & storefront: [../README.md](../README.md).

**Telegram channels:** shared list [`telegram-channels.example.json`](./telegram-channels.example.json) — how to add via PR: [TELEGRAM-CHANNELS.md](./TELEGRAM-CHANNELS.md).

## Downloadable platform modules

Core MCP always includes hub tools + **RSS** (FL / Weblancer), Freelance.ru HTML (`/task` via RU SOCKS5), and Product Radar hiring HTML (`/category/hiring/?page=N`, direct).

Other boards ship as modules from the hub:

| Registry | https://workix.co/mcp/registry.json |
| Artifacts | https://workix.co/mcp/adapters/`<id>-<version>`.tgz |
| Local cache | `$WORKIX_MCP_DATA/adapters/<id>/<version>/` (default `mcp/data/adapters`) |

On `workix_digest` / `workix_search`, MCP calls `ensure` for needed platforms, verifies **sha256**, extracts, and `import()`s the module. Later runs reuse the cache.

**Trust model:** a module is executable code inside the MCP process. Downloads are limited to **https** hosts on an allowlist (`workix.co` + registry host; override with `WORKIX_MCP_TRUSTED_HOSTS`). Size is capped; tarball paths cannot escape the install dir. `sha256` in the registry only proves integrity against that registry — if the hub itself is compromised, treat it as RCE on every client that installs. Mitigations: keep registry on a host you control, prefer bundled `assets/mcp/adapters/*.tgz` when present, set `WORKIX_MCP_REGISTRY` to a local file for air‑gapped installs. Opt-out for custom registries: `WORKIX_MCP_ALLOW_UNTRUSTED_REGISTRY=1`.

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

Recommended (from source — always the freshest build):

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

Optional npm shortcut: `"command": "npx"`, `"args": ["-y", "@workix/mcp"]` (may lag behind the GitHub `mcp/` tree).

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
| `workix_hub_health` / `workix_hub_register` / `workix_hub_me` / `workix_hub_rotate_key` | Auth & health (`rotate_key` needs `confirm:true`; writes `mcp/.env` by default) |
| `workix_list_startups` / `workix_get_startup` / `workix_create_startup` / `workix_update_startup` | Projects — products, startups, early ideas OK (`pending` = publish) |
| `workix_list_performers` / `workix_get_performer` | Performers (builders + bloggers/creators) + their listings |
| `workix_list_hub_orders` / `workix_get_hub_order` | Hub orders (`scraped` / `external` → no personal publisher card; detail may include `external`) |
| `workix_list_roles` / `workix_create_role` / `workix_update_role` | Roles / orders (concrete asks; paid or cofounder) |
| `workix_share_jobs` | Mirror local board job ids → hub catalog (`POST /orders/share`; prefer digest flag) |
| `workix_get_profile` / `workix_update_profile` | Create/update own performer card via MCP; claim vanity `slug` → shareable `https://workix.co/{slug}` + free CV PDF `https://workix.co/{slug}/pdf` (also `/{slug}.json`) |

Write tools echo a short **who can publish** guide: early stage welcome; moderation (`pending`) is normal — do not discourage listing.
| `workix_hub_apply` | Apply on hub |
| `workix_feedback` | bug / suggestion / support / other → hub admins (rate-limited) |

**Rate limits (429):** hub and dStore errors include `rateLimited: true`, human `message`, `retryAfterSec`, optional `limits`, and an agent `hint` — do not retry until the cooldown passes.

## Board tools (local credentials)

| Tool | Role |
|------|------|
| `workix_dstore_search` / `_similar` / `_get` / `_publish` / `_list` / `_quota` | [dStore](https://dstore.one) catalog — same REST as official **dstore-mcp** ([api.txt](https://dstore.one/api.txt)) |
| _(optional)_ separate MCP `dstore` | `search_catalog`, `get_app`, `get_similar`, `add_url`, `get_list`, `quota_status` — see api.txt §0 |
| `workix_digest` / `workix_search` / `workix_get_job` | Read boards (auto-downloads adapters). `share_to_hub:true` on digest batch-mirrors cards to hub (no per-item confirm; needs `WORKIX_AGENT_KEY`) |
| `workix_draft_proposal` | Draft reply |
| `workix_outreach_log` / `workix_outreach_list` | Local log: contact, channel, full text, status (`draft`/`sent`/`ok`…). Mirror into `docs/apply-log-*.md` |
| `workix_checkpoint_set` / `workix_checkpoint_get` | Search pause/resume: where stopped, next, surfaces. Mirror CHECKPOINT in apply-log |
| `workix_hub_share_status` / `workix_history` | What is already on workix.co vs local-only; unified hubShares + outreach + checkpoints |
| `workix_submit_proposal` | Submit only with `confirm: true` after human OK |
| `workix_prepare_browser_apply` | Browser checklist |
| `workix_sources_status` / `workix_list_platforms` / `workix_open_watch_source` | Status & watch |
| `workix_ensure_platforms` / `workix_install_platform` / `workix_remove_platform` | Adapter cache |
| `workix_upwork_auth_url` / `workix_upwork_exchange_code` | Upwork OAuth |
| `workix_tg_status` / `workix_tg_auth` / `workix_tg_search` | Optional Telegram (GramJS; TDLib where native works). Install: `npm install telegram`. Env: `TG_APP_API_ID` + `TG_APP_API_HASH`. Login: `npm run tg:login`. |

### Optional Telegram

Полная инструкция: **[TELEGRAM.md](./TELEGRAM.md)**. На **Windows ARM64** — только GramJS (`telegram`), не `prebuilt-tdlib`.

```bash
cd mcp
npm install telegram
# TG_APP_API_ID + TG_APP_API_HASH in .env
npm run tg:login          # phone/code в терминале
# restart MCP → workix_tg_status → workix_tg_search
```

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
