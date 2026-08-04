# Contributing to Workix MCP

Source: [facetoplace/Workix](https://github.com/facetoplace/Workix) → `mcp/`.  
Product / hub: [workix.co](https://workix.co) · agent docs: [workix.co/agent](https://workix.co/agent).

PRs welcome for adapters, presets, docs, and the **Telegram channels catalog**.

## Telegram channels catalog

Community-maintained list of public chats/channels for job and startup search.

- File: [`telegram-channels.example.json`](./telegram-channels.example.json)
- Guide: [`TELEGRAM-CHANNELS.md`](./TELEGRAM-CHANNELS.md)
- Validate: `node scripts/validate-telegram-channels.mjs`

Do **not** commit personal `telegram-channels.json` or Telegram sessions under `data/`.

## Board adapters

See [README.md](./README.md) → “Contribute an adapter”.

```bash
npm run build
npm run pack:adapters
```

Never commit secrets, `.env`, or `data/` dumps.

## PR checklist

- [ ] No secrets / sessions / personal channel lists  
- [ ] `telegram-channels.example.json` passes `validate-telegram-channels.mjs` (if you touched it)  
- [ ] New adapter: build + pack adapters  
- [ ] Short PR description: why this change helps agents or humans using Workix  
