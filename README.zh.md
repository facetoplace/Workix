# Workix

**语言：** [英语](README.md) · [俄语](README.ru.md) · [西班牙语](README.es.md) · [德语](README.de.md) · [法语](README.fr.md) · [土耳其语](README.tr.md) · [乌克兰语](README.uk.md) · [印地语](README.hi.md) · [中文](README.zh.md)

Workix 是一个让人才、项目与工作彼此相遇的平台。

[Workix 中心枢纽](https://workix.co)将三类内容汇集到一个目录中：

- **项目** — 正在招募人才的初创公司、产品和社区。
- **职位与订单** — 包含说明、预算、标签及申请方式的开放工作机会。
- **服务者** — 正在寻找新项目的专业人士。

Workix 并非传统的自由职业市场。它无意取代项目方与专业人士之间的直接关系。每条信息都会引导用户前往项目所有者首选的联系方式或申请表单，而 Workix 则让机会更易于发布、发现和分享。

用户可以在网页上浏览目录。AI 代理可以通过 MCP 或 REST API 搜索目录并管理信息。同一个本地 MCP 还可以从外部平台收集机会，同时将平台凭据保留在用户自己的设备上。

**打开 Workix：** [workix.co](https://workix.co)  
**代理指南：** [workix.co/agent](https://workix.co/agent)  
**API 参考：** [workix.co/api.txt](https://workix.co/api.txt)

## 让你的代理探索 Workix

将以下提示词粘贴到 Cursor、Claude 或其他编程代理中。它会要求代理先了解 Workix，再根据你的具体目标提供帮助。

```text
了解 Workix 的工作方式：

1. 打开 https://workix.co/agent、https://workix.co/llms.txt
   和 https://workix.co/api.txt。
2. 打开 https://github.com/facetoplace/Workix 并阅读 README.zh.md。
3. 用通俗易懂的语言说明：
   - Workix 是什么，以及适合哪些人；
   - 如何浏览项目、职位、订单和服务者；
   - AI 代理可以通过 Workix MCP 和 API 完成哪些操作；
   - 哪些部分在本地运行，以及如何安全保管凭据。
4. 查看我当前的项目，帮助我选择并完成一个有价值的后续步骤：
   - 将 Workix MCP 连接到我的代理；
   - 搜索相关工作或服务者；
   - 发布或更新项目、职位或服务者资料；
   - 在我自己的域名上部署 Workix 店面；
   - 为改进 Workix 做出贡献。

使用 WORKIX_API=https://workix.co 连接中心枢纽。
不要将自由职业平台的密码或令牌上传到中心枢纽。
请根据我的操作系统、工具和项目调整说明。
```

## 此仓库包含什么？

此仓库包含 Workix 的开放客户端和集成。它们使用位于 `https://workix.co` 的中心枢纽 API，因此本地副本无需维护单独的目录，也能展示共享目录。

- [`views/`](views/) 包含店面页面。
- [`assets/`](assets/) 包含浏览器应用、样式、翻译、PWA 文件和公开 API 文档。
- [`mcp/`](mcp/) 包含 TypeScript MCP 服务器、Workix 工具以及受支持工作平台的适配器。
- [`docker/`](docker/) 包含一个用于提供店面服务的小型 nginx 镜像。
- [`docs/`](docs/) 包含面向代理和自行托管的公开指南。

两个主要部分彼此独立：

1. **店面** — 用于浏览 Workix 目录的网页界面。你可以直接访问 [workix.co](https://workix.co)，也可以在自己的域名上托管此 UI。
2. **MCP 服务器** — 一组工具，可让 AI 代理搜索 Workix、管理你的信息和资料、准备提案，以及使用受支持的外部来源。

目录数据由 Workix 中心 API 提供。运行店面或连接 MCP 客户端无需生产环境密钥。

## 通过 AI 代理使用 Workix

设置 `WORKIX_API=https://workix.co` 后，代理可以搜索项目、职位、订单和服务者。设置 `WORKIX_AGENT_KEY` 后，代理还可以创建或更新信息，并管理服务者资料。

在本地运行 MCP 服务器：

```bash
git clone https://github.com/facetoplace/Workix.git
cd Workix/mcp
npm install
npm run build
```

Cursor MCP 配置示例：

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

在 [workix.co](https://workix.co) 注册即可获取代理密钥。公开搜索不需要密钥；执行与你账户关联的操作则必须使用密钥。

外部平台凭据只能存放在本地 MCP 环境中。请勿将 Upwork、Kwork 或其他平台的密码和令牌发送到 Workix 中心枢纽。

有关安装方法、可用工具和各来源的专用设置，请参阅 [`mcp/README.md`](mcp/README.md)。

## 在你的域名上托管店面

项目和社区可以通过 `work.example.com` 等域名提供 Workix UI。该镜像仍会从 `https://workix.co` 读取共享目录。

1. 部署 `views/` 和 `assets/`，或使用 [`docker/`](docker/) 中的镜像。
2. 将 UI 指向中心枢纽：

   ```html
   <meta name="workix-api" content="https://workix.co" />
   ```

   你也可以将 `API_BASE` 或 `WORKIX_API` 设置为 `https://workix.co`。
3. 为所选域名配置 DNS 和托管服务。

与该域名关联的信息可以在镜像访客面前优先展示。实时示例请查看 [work.facetoplace.app](https://work.facetoplace.app/)，详情请参阅 [`docs/self-host.md`](docs/self-host.md)。

## 通过 Workix MCP 使用其他平台

Workix MCP 还是一个用于操作外部自由职业市场和招聘网站的统一界面。代理可以在一份摘要中搜索多个来源、打开特定信息、起草提案，并通过可用 API 提交提案，或为你准备一份浏览器操作清单。

这些集成都在本地运行。API 令牌、平台登录信息和浏览器会话会保留在你的设备上，不会发送到 Workix 中心枢纽。提交提案始终需要用户明确确认。

### 平台就绪度

评分表示目前**预期的 Workix 工作流**有多少已经就绪，而不是对平台本身功能的覆盖程度：

- **5/5** — 可通过受支持的 API 完成搜索和提交。
- **4/5** — 搜索可靠，但提交或身份验证仍有备用方案或限制。
- **3/5** — 集成具备实用价值，但凭据、代理服务器或非官方接口会影响可靠性。
- **2/5** — 由浏览器辅助监看的来源，而非自动化信息流。
- **1/5** — 仅提供链接或操作清单；深度自动化被有意排除在范围之外。

**自动化政策**一栏有意采用保守标准。平台条款和 API 权限可能会发生变化，因此用户还必须遵守各来源当前有效的规则以及自己账户所适用的规则。

| 平台 | 搜索 / 阅读 | 申请 | 就绪度 | 自动化政策 | 发展方向 |
|------|-------------|------|:------:|------------|----------|
| **Freelancehunt** | 官方 API | API | **5/5** | 经批准的 API 和令牌 | 维护完整工作流 |
| **Freelancer.com** | 官方 API | API 竞标 | **4/5** | 经批准的 API 和 OAuth | 稳定身份验证和错误处理 |
| **Upwork** | OAuth GraphQL | 获得许可时使用 API；浏览器备用方案 | **4/5** | 仅使用经批准的 API 权限；禁止未经授权的抓取 | 完成 OAuth 设置和提案备用流程 |
| **FL.ru** | RSS | 浏览器 | **4/5** | 公开 RSS；申请仍由用户控制 | 改进分类和预算解析 |
| **HH.ru** | 官方 API | 浏览器 | **4/5** | 遵守官方 API 规则并使用要求的用户代理 | 改进项目/远程工作筛选；可选支持通过 API 申请 |
| **Remote OK** | 公开 API | 雇主网站 | **4/5** | 公开信息流；跳转后适用雇主规则 | 改进标签和技术筛选 |
| **Kwork** | 使用本地凭据的非官方 API | 浏览器 | **3/5** | 高风险的非官方访问；禁止自动申请 | 改进登录和代理服务器的可靠性 |
| **Freelance.ru** | RSS；可能需要代理服务器 | 浏览器 | **3/5** | 公开 RSS；不得绕过账户限制 | 提高信息流抵御封锁的能力 |
| **Weblancer** | RSS；可能需要代理服务器 | 浏览器 | **3/5** | 公开 RSS；不得绕过账户限制 | 提高信息流抵御封锁的能力 |
| **Habr Career** | 浏览器监看 | 浏览器 | **2/5** | 仅限公开页面/RSS；禁止批量申请 | 将 RSS 添加到共享摘要 |
| **Product Radar / StartupFellows** | 浏览器或 Telegram 监看 | 外部表单或联系渠道 | **2/5** | 精选监看；手动联系 | 保留为精选监看来源 |
| **Contra / BotPool / Wellfound** | 浏览器监看 | 浏览器 | **2/5** | 自动化受限或规则不明确；不使用抓取工具 | 保持浏览器辅助方式；不计划使用抓取工具 |
| **Telegram channels** | 浏览器/用户会话监看 | 手动联系 | **2/5** | 遵守频道规则；禁止未经请求的批量消息 | 保持半手动且可配置 |
| **LinkedIn** | 浏览器操作清单 | 手动 / Easy Apply | **1/5** | **禁止自动抓取或批量申请** | 仅保留半手动方式 |
| **YC Co-Founder Matching / CoFoundersLab** | 非公开浏览器流程 | 手动介绍 | **1/5** | **禁止自动联系或发送垃圾信息** | 保留为手动监看来源 |
| **Profi.ru** | 浏览器操作清单 | 浏览器 | **1/5** | 浏览器/手动使用；官方合作伙伴访问需要 mTLS | 合作伙伴 mTLS 集成不在范围内 |
| **Arc.dev / Magier / Feltsense** | 匹配或招聘动态监看 | 手动 | **1/5** | 仅限匹配/手动流程 | 低优先级监看；不计划深度集成 |

当前开发顺序如下：

1. 稳定 Freelancer.com，并完成 Upwork OAuth/申请工作流。
2. 提升 FL.ru、Freelance.ru、Weblancer 和 Kwork 的可靠性。
3. 为 Remote OK 和 HH.ru 添加更好的筛选功能，然后添加 Habr Career RSS。
4. 对封闭平台和 ToS 敏感平台继续采用浏览器辅助方式，而不是构建脆弱的抓取工具。

来源目录位于 [`mcp/platforms.json`](mcp/platforms.json)。运行 `workix_list_platforms` 可获取机器可读的列表；运行 `workix_sources_status` 可查看当前本地配置中可用的集成。

## 文档与信息流

- [代理指南](https://workix.co/agent)
- [机器可读概览](https://workix.co/llms.txt)
- [API 参考](https://workix.co/api.txt)
- [OpenAPI 文档](https://workix.co/openapi-v1.yaml)
- [支持](https://workix.co/support)
- RSS：[订单](https://workix.co/feed/tasks.xml)、[项目](https://workix.co/feed/projects.xml)、[服务者](https://workix.co/feed/performers.xml)

## 参与贡献

欢迎贡献新的 MCP 适配器、工具、预设、测试、店面改进、文档和翻译。

请从 [CONTRIBUTING.md](CONTRIBUTING.md) 开始。如有产品或 API 方面的问题，请联系 [Workix 支持](https://workix.co/support)。

## 许可证

请参阅 [LICENSE](LICENSE)。修改和再分发时必须明确注明出处。商业性重复使用需事先获得许可。
