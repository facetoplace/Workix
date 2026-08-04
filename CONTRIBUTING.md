# Contributing to Workix

We want **communities and projects** to improve Workix with us — especially the **MCP** (adapters, tools, presets) and the **storefront UI**.

Canonical languages for docs right now: [English](README.md) · [Русский](CONTRIBUTING.ru.md).

## What lives here

| Area | Path | Good first PRs |
|------|------|----------------|
| **MCP** | `mcp/` | New board adapter, better search/digest, presets, docs, tests |
| **Storefront** | `views/`, `assets/` | UX, a11y, i18n strings, empty states |
| **Self-host** | `docker/` | Deploy recipes, CNAME examples |
| **Docs** | `README*.md`, `docs/` | Translations after EN/RU approval, clearer agent guides |

Catalog **data** and moderation stay on the central hub ([workix.co](https://workix.co)). This repo does **not** include the hub database.

## MCP — build with the community

The MCP is the main collaboration surface:

1. **Hub tools** — talk to `https://workix.co` with a `wix_…` key (projects, roles, profile, feedback).
2. **Board adapters** — digest/search/draft on freelance platforms using **local** credentials.

### Add or improve a platform adapter

1. Fork → clone → `cd mcp && npm i && npm run build`
2. Register the platform in [`mcp/platforms.json`](mcp/platforms.json) (`id`, `access`, `tier`, …).
3. Implement `mcp/src/adapters/<id>.ts` (follow `rss.ts` / `freelancehunt.ts` / `upwork.ts`).
4. Wire tools in `mcp/src/index.ts` / `mcp/src/tools/*` if you expose new behavior.
5. Document env vars in `mcp/.env.example` and a short note in `mcp/README.md`.
6. Prefer **mocks** in PRs — never commit real tokens, cookies, or `mcp/data/*` dumps.

### Safe contribution rules

- No platform passwords or OAuth secrets in git.
- `workix_submit_proposal` must keep the human `confirm: true` gate.
- Hub writes should respect moderation (`draft` / `pending`) and field formats from [api.txt](https://workix.co/api.txt).
- Do not add code that uploads board credentials to the hub.

### Test locally

```bash
cd mcp
npm run build
npm run smoke          # if available
# Point Cursor mcp.json at dist/index.js with WORKIX_API=https://workix.co
```

## Storefront PRs

- Keep `meta name="workix-api"` pointing at `https://workix.co` for mirrors.
- Bump `?v=` query on changed `assets/hub/*` when you edit cached JS/CSS.
- Prefer hub wording (“central hub API”), not private infra names.

## Propose job sites and Telegram channels (high value)

We want to **expand coverage**: more boards and channels where agents can discover gigs, roles, and startup hiring.

Open an [Issue](https://github.com/facetoplace/Workix/issues/new) (or a PR) titled roughly `source: …` / `tg-channel: …` and include:

| Suggest | What to send |
|---------|----------------|
| **Website / board** | URL, whether there is a public API or RSS, niche (mobile, freelance, remote…), language |
| **Telegram channel** | Public `https://t.me/username`, niche, that recent posts are vacancies (not only ads/resumes) |

You do **not** have to implement an adapter. Maintainers can triage and wire it later. If you can:

- **Board:** follow “Add or improve a platform adapter” above → [`mcp/platforms.json`](mcp/platforms.json).
- **Telegram:** edit [`mcp/telegram-channels.example.json`](mcp/telegram-channels.example.json) per [mcp/TELEGRAM-CHANNELS.md](mcp/TELEGRAM-CHANNELS.md), then `npm run validate:tg-channels` in `mcp/`.

No private invite links, no spam playbooks, no board passwords in git.

## How to propose other work

1. Open an [Issue](https://github.com/facetoplace/Workix/issues) — bug, adapter request, source suggestion, or “we want to feature our project domain”.
2. Small focused PRs beat giant rewrites.
3. Say which feed/tool you used and how to reproduce.

Projects that mirror UI on `work.yourdomain.com` are welcome to upstream fixes that help featuring and embed UX.

## License

Modifications and redistribution with attribution are allowed. Commercial reuse needs prior agreement. Details: [LICENSE](LICENSE).

## Questions

- Product / API: [workix.co/support](https://workix.co/support)
- Agent overview: [workix.co/agent](https://workix.co/agent)
- Commercial use: [workix.co/support](https://workix.co/support)
