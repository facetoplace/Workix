# Telegram channels catalog (jobs / startups)

Curated watch list for Workix MCP (`workix_tg_search` / digest with platform `telegram`).

**Machine-readable source of truth:** [`telegram-channels.example.json`](./telegram-channels.example.json)

Copy to a local (gitignored) file for personal overrides:

```bash
cp telegram-channels.example.json telegram-channels.json
```

Login / BYO Telegram API: [`TELEGRAM.md`](./TELEGRAM.md).  
Hub docs: [workix.co/agent](https://workix.co/agent).

## Contribute a channel (PRs welcome)

We want more **live** Telegram channels and chats where people post:

- freelance gigs / one-off work  
- IT / mobile / product jobs  
- startup hiring, cofounder, “building a team”

### How to add

1. Fork [facetoplace/Workix](https://github.com/facetoplace/Workix).
2. Edit **`mcp/telegram-channels.example.json`** only (do **not** commit `telegram-channels.json` — that file is personal).
3. Add one object to `channels[]`:

```json
{
  "id": "example_channel",
  "title": "Short human title",
  "url": "https://t.me/example_channel",
  "kind": "jobs_feed",
  "priority": "medium",
  "note": "Optional: niche, language, antispam"
}
```

| Field | Required | Values |
|-------|----------|--------|
| `id` | yes | Usually the `@username` (unique in the file) |
| `title` | yes | Display name |
| `url` | yes | `https://t.me/<username>` (public invite links only if no username) |
| `kind` | yes | `gigs` · `roles` · `startups` · `jobs_feed` · `bots` · `community` |
| `priority` | yes | `high` · `medium` · `low` |
| `note` | no | Short hint for agents / humans |
| `lang` | no | e.g. `ru`, `en` |
| `verified_at` | no | ISO date `YYYY-MM-DD` when you last opened the channel |

4. Validate locally:

```bash
cd mcp
node scripts/validate-telegram-channels.mjs
```

5. Open a PR with:
   - why the channel fits (1–2 sentences)
   - that the username resolves and recent posts are job/startup-related (not only ads / resume spam)
   - your `verified_at` date

### Rules for PRs

- **Public channels/chats only** — no private invite hashes, no personal DMs.
- Prefer channels with **recent** hiring posts (last ~30–60 days).
- Do not re-add usernames listed under `removed_dead` / `checked_skip` in the JSON without new evidence they are alive and useful.
- No spam instructions; Workix outreach stays opt-in and human-confirmed.
- Keep notes product-focused (hub / MCP). Do not document private infra.

### Optional: human catalog

After changing the JSON, you may update the tables in this file to match. The JSON is what MCP loads by default when `telegram-channels.json` is missing.

## Default high-priority set (summary)

| id | kind | Note |
|----|------|------|
| siliconpravdachat | startups | Antispam chat |
| productradar_official | startups | Products |
| startupfellows | startups | RU startup roles |
| startup_job_russia | roles | Startup jobs |
| dartlang_jobs | jobs_feed | Flutter / Dart |
| mobjobskz | jobs_feed | Mobile (iOS/Android/Flutter/RN) |
| fintech_vacancy | jobs_feed | Fintech |
| it_vakansii_jobs | jobs_feed | Broad RU IT |
| remocate | jobs_feed | Remote / relocate |
| theyseeku_it | jobs_feed | Finder IT remote |
| jobs_in_it_remoute | jobs_feed | Aggregator (typo in username) |
| digital_hr | jobs_feed | DigitalHR agency |
| getitrussia | jobs_feed | Get IT |
| forallmobile | jobs_feed | Mobile: iOS / Android / RN / Flutter |
| Remoteit | jobs_feed | Remote IT (Inflow) |

A digest run reads the first **12** channels by priority (`WORKIX_TG_MAX_CHANNELS`, max 40), so
entries at the end of the `high` group stay out of the default digest until the limit is raised.

Full list: see `channels` in [`telegram-channels.example.json`](./telegram-channels.example.json).
