# Workix

**Languages:** [English](README.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [हिन्दी](README.hi.md) · [中文](README.zh.md)

Workix is a place where people, projects, and work find each other.

The [Workix hub](https://workix.co) brings three things into one catalog:

- **Projects** — startups, products, and communities looking for people.
- **Roles and orders** — open work with a description, budget, tags, and a way to apply.
- **Performers** — specialists who are open to new projects.

Workix is not a traditional freelance marketplace. It does not try to replace the relationship between a project and a specialist. A listing leads to the project owner's preferred contact or application form, while Workix makes the opportunity easy to publish, discover, and share.

People can browse the catalog on the web. AI agents can search it and manage listings through MCP or the REST API. The same local MCP can also collect opportunities from external platforms while keeping platform credentials on the user's machine.

**Open Workix:** [workix.co](https://workix.co)  
**Guide for agents:** [workix.co/agent](https://workix.co/agent)  
**API reference:** [workix.co/api.txt](https://workix.co/api.txt)

## Ask your agent to explore Workix

Paste this prompt into Cursor, Claude, or another coding agent. It asks the agent to study Workix and then help with your specific goal.

```text
Learn how Workix works:

1. Open https://workix.co/agent, https://workix.co/llms.txt,
   and https://workix.co/api.txt.
2. Open https://github.com/facetoplace/Workix and read README.md.
3. Explain in plain language:
   - what Workix is and who it is for;
   - how I can browse projects, roles, orders, and performers;
   - what an AI agent can do through the Workix MCP and API;
   - which parts run locally and how credentials are kept safe.
4. Look at my current project and help me choose and complete one useful next step:
   - connect Workix MCP to my agent;
   - search for relevant work or performers;
   - publish or update a project, role, or performer profile;
   - deploy the Workix storefront on my own domain;
   - contribute an improvement to Workix.

Use WORKIX_API=https://workix.co for the central hub.
Do not upload freelance-platform passwords or tokens to the hub.
Adapt the instructions to my operating system, tools, and project.
```

## What is in this repository?

This repository contains the open clients and integrations for Workix. They use the central hub API at `https://workix.co`, so a local copy can display the shared catalog without maintaining a separate catalog.

- [`views/`](views/) contains the storefront pages.
- [`assets/`](assets/) contains the browser application, styles, translations, PWA files, and public API documents.
- [`mcp/`](mcp/) contains the TypeScript MCP server, Workix tools, and adapters for supported job platforms.
- [`docker/`](docker/) contains a small nginx image for serving the storefront.
- [`docs/`](docs/) contains public guides for agents and self-hosting.

The two main parts are independent:

1. **Storefront** — a web interface for browsing the Workix catalog. You can use it at [workix.co](https://workix.co) or host the UI on your own domain.
2. **MCP server** — tools that let an AI agent search Workix, manage your listings and profile, prepare proposals, and work with supported external sources.

Catalog data is served by the central Workix API. Production secrets are not required to run the storefront or connect the MCP client.

## Use Workix with an AI agent

With `WORKIX_API=https://workix.co`, an agent can search projects, roles, orders, and performers. With a `WORKIX_AGENT_KEY`, it can also create or update listings and manage a performer profile.

**Recommended:** install MCP from this repository’s source (freshest tools and adapters). npm/`npx` is optional and may lag behind git.

```bash
git clone https://github.com/facetoplace/Workix.git
cd Workix/mcp
npm install
npm run build
```

Example Cursor MCP configuration (from source):

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

Optional shortcut: `npx -y @workix/mcp` · npm [`@workix/mcp`](https://www.npmjs.com/package/@workix/mcp) · Official Registry [`co.workix/mcp`](https://registry.modelcontextprotocol.io/v0.1/servers?search=co.workix/mcp) · install UI: [workix.co/agent](https://workix.co/agent)

Register at [workix.co](https://workix.co) to get an agent key. The key is optional for public search and required for actions tied to your account.

External platform credentials belong only in the local MCP environment. Do not send Upwork, Kwork, or other platform passwords and tokens to the Workix hub.

See [`mcp/README.md`](mcp/README.md) for installation, available tools, and source-specific settings.

## Host the storefront on your domain

Projects and communities can serve the Workix UI from a domain such as `work.example.com`. The mirror still reads the shared catalog from `https://workix.co`.

1. Deploy `views/` and `assets/`, or use the image in [`docker/`](docker/).
2. Point the UI to the hub:

   ```html
   <meta name="workix-api" content="https://workix.co" />
   ```

   You can also set `API_BASE` or `WORKIX_API` to `https://workix.co`.
3. Configure your DNS and hosting for the chosen domain.

Listings associated with that domain can be featured for visitors to the mirror. See [work.facetoplace.app](https://work.facetoplace.app/) for a live example and [`docs/self-host.md`](docs/self-host.md) for details.

## Use other platforms through Workix MCP

Workix MCP is also a single interface for working with external freelance marketplaces and job boards. An agent can search several sources in one digest, open a specific listing, draft a proposal, and either submit it through an available API or prepare a browser checklist for you.

These integrations run locally. API tokens, platform logins, and browser sessions stay on your machine and are not sent to the Workix hub. Proposal submission always requires explicit human confirmation.

### Platform readiness

The score describes how much of the **intended Workix workflow** is ready today, not how much of the platform itself is covered:

- **5/5** — search and submission work through a supported API.
- **4/5** — reliable search; submission or authentication still has a fallback or limitation.
- **3/5** — useful integration, but credentials, proxies, or an unofficial interface affect reliability.
- **2/5** — browser-assisted watch source rather than an automated feed.
- **1/5** — link/checklist only; deep automation is intentionally out of scope.

The **Automation policy** column is deliberately conservative. Platform terms and API permissions can change, so users must also follow the current rules of each source and their own account.

| Platform | Search / read | Apply | Ready | Automation policy | Direction |
|----------|---------------|-------|:-----:|-------------------|-----------|
| **Freelancehunt** | Official API | API | **5/5** | Approved API and token | Maintain the full workflow |
| **Freelancer.com** | Official API | API bid | **4/5** | Approved API and OAuth | Stabilize authentication and error handling |
| **Upwork** | OAuth GraphQL | API when permitted; browser fallback | **4/5** | Only approved API permissions; no unauthorized scraping | Finish OAuth setup and proposal fallback |
| **FL.ru** | RSS | Browser | **4/5** | Public RSS; apply remains human-controlled | Improve categories and budget parsing |
| **HH.ru** | Official API | Browser | **4/5** | Official API rules and required user agent | Improve project/remote filters; API apply is optional |
| **Remote OK** | Public API | Employer's site | **4/5** | Public feed; employer rules apply after redirect | Improve tag and technology filters |
| **Kwork** | Unofficial API with local credentials | Browser | **3/5** | High-risk unofficial access; no automatic apply | Improve login and proxy reliability |
| **Freelance.ru** | RSS; proxy may be needed | Browser | **3/5** | Public RSS; no bypass of account restrictions | Make feeds more resilient to blocking |
| **Weblancer** | RSS; proxy may be needed | Browser | **3/5** | Public RSS; no bypass of account restrictions | Make feeds more resilient to blocking |
| **Habr Career** | Browser watch | Browser | **2/5** | Public pages/RSS only; no mass apply | Add RSS to the shared digest |
| **Product Radar / StartupFellows** | Browser or Telegram watch | External form or contact | **2/5** | Curated watch; manual contact | Keep as curated watch sources |
| **Contra / BotPool / Wellfound** | Browser watch | Browser | **2/5** | Restricted or unclear automation; no scraper | Keep browser-assisted; no scraper planned |
| **Telegram channels** | Browser/user-session watch | Manual contact | **2/5** | Follow channel rules; no unsolicited bulk messaging | Keep semi-manual and configurable |
| **LinkedIn** | Browser checklist | Manual / Easy Apply | **1/5** | **No automated scraping or mass apply** | Keep semi-manual only |
| **YC Co-Founder Matching / CoFoundersLab** | Private browser flow | Manual introduction | **1/5** | **No automated outreach or spam** | Keep as a manual watch source |
| **Profi.ru** | Browser checklist | Browser | **1/5** | Browser/manual use; official partner access requires mTLS | Partner mTLS integration is out of scope |
| **Arc.dev / Magier / Feltsense** | Matching or careers watch | Manual | **1/5** | Matching/manual flow only | Low-priority watch; no deep integration planned |

The current development order is:

1. Stabilize Freelancer.com and complete the Upwork OAuth/apply workflow.
2. Improve FL.ru, Freelance.ru, Weblancer, and Kwork reliability.
3. Add better filters for Remote OK and HH.ru, then add Habr Career RSS.
4. Keep closed and ToS-sensitive platforms browser-assisted instead of building fragile scrapers.

The source catalog is [`mcp/platforms.json`](mcp/platforms.json). Run `workix_list_platforms` for the machine-readable list and `workix_sources_status` to see which integrations are available with your current local configuration.

## Documentation and feeds

- [Agent guide](https://workix.co/agent)
- [Machine-readable overview](https://workix.co/llms.txt)
- [API reference](https://workix.co/api.txt)
- [OpenAPI document](https://workix.co/openapi-v1.yaml)
- [Support](https://workix.co/support)
- RSS: [orders](https://workix.co/feed/tasks.xml), [projects](https://workix.co/feed/projects.xml), [performers](https://workix.co/feed/performers.xml)

## Contributing — help grow the job & channel coverage

Workix gets better when the community points us at **more places to collect work**.

**Please open a GitHub [Issue](https://github.com/facetoplace/Workix/issues) or PR if you know:**

- a **website / job board / hiring feed** (public API, RSS, or a clear HTML list) worth wiring into MCP digests;
- a **Telegram channel or chat** where people regularly post IT/mobile/freelance/startup vacancies (public `@username` only).

Even a short note helps: URL or `t.me/…`, what niche it covers, and that posts are recent. You do not need to ship a full adapter — a proposal is enough. PRs that add an adapter or a channel to [`mcp/telegram-channels.example.json`](mcp/telegram-channels.example.json) are especially welcome.

Also welcome: MCP tools, presets, tests, storefront improvements, docs, and translations.

Start with [CONTRIBUTING.md](CONTRIBUTING.md) · Telegram catalog: [mcp/TELEGRAM-CHANNELS.md](mcp/TELEGRAM-CHANNELS.md). Product questions: [Workix support](https://workix.co/support).

## License

See [LICENSE](LICENSE). Modification and redistribution require clear attribution. Commercial reuse requires prior agreement.
