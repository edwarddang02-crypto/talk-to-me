# persona-hub · 隔世谈站

与历史上那些思维独特的人，隔空谈谈你的问题。

通用人物对话引擎：**代码与人物数据分离**，任何由 [女娲 · Skill造人术](https://github.com/alchaincyf/nuwa-skill) 蒸馏出的人物 Skill，都能以「加文件 + 注册一行」的方式入驻，无需改动代码。

人物 Skill 创建者：[花叔](https://x.com/AlchainHust)

所有对话均由 AI 基于公开著作模拟生成，非本人观点；不构成医疗或心理治疗建议。

## 技术方案（B 方案）

- 纯静态前端（HTML/CSS/JS，零框架依赖）
- Serverless API（`api/`，Vercel 原生结构）：隐藏 API Key、组装系统提示词、流式转发 DeepSeek
- 人物包（`personas/`）：数据驱动，引擎不感知具体人物

## 快速开始

```bash
# 1. 配置 API Key
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY=sk-...

# 2. 本地运行（无需安装依赖，Node >= 18）
node server.mjs
# 打开 http://localhost:3000
```

Windows 且系统 PATH 中没有 Node 时，可直接双击或运行 `dev.cmd`（自动使用 Codex 桌面端打包的 Node 运行时）。

首次启动即包含尼采（`personas/nietzsche/`）。默认模型 `deepseek-v4-flash`，可在 `.env` 或各人物的 `profile.json` 中覆盖。

## 项目结构

```
persona-hub/
├── index.html / chat.html / app.js / styles.css   # 前端
├── config.js            # 前端全局配置（apiBase：API 地址）
├── api/
│   ├── personas.js    # GET /api/personas   人物注册表
│   └── chat.js        # POST /api/chat      对话（SSE 流式）
├── packages/persona-core/  # ★ Vercel 函数共享包（@persona-hub/core）
│   ├── index.mjs          # 人物包 → 系统提示词 / 注册表
│   ├── cors.mjs           # 跨域头
│   └── data.mjs           # 自动生成的人物数据模块（勿手改）
├── personas/           # ★ 人物包（数据）
│   ├── index.json      # 注册表
│   └── <id>/
│       ├── profile.json   # 元数据：名称/主题色/欢迎语/免责声明/模型
│       ├── skill.md       # 女娲蒸馏的 SKILL.md（原样注入）
│       └── quotes.json    # 已核验引语库（约束引用真实性）
├── scripts/
│   ├── import-persona.mjs  # 一键导入女娲 skill
│   ├── build-persona-data.mjs  # personas/ → packages/persona-core/data.mjs
│   └── smoke-test.mjs      # 回归测试（无需 API Key）
└── server.mjs              # 本地开发服务器
```

## 如何新增一个人物（三步，零代码改动）

假设你刚用女娲蒸馏了「荣格」（skill 位于 `~/.codex/skills/jung-perspective/`）：

```bash
node scripts/import-persona.mjs --id jung
```

脚本会自动完成：

1. 复制 `SKILL.md` → `personas/jung/skill.md`
2. 从 `references/research/03-expression-dna.md` 提取已核验引语 → `personas/jung/quotes.json`
3. 生成占位 `profile.json` 并在 `personas/index.json` 注册
4. 重新生成 `packages/persona-core/data.mjs`（Vercel 部署需要，随仓库提交）

然后只需手动补 `profile.json` 里的四项：`tagline`、`description`、`theme`（主题色）、`welcome`。刷新页面即可出现新人物。

手动修改 `personas/` 下的人物数据后，记得运行 `node scripts/build-persona-data.mjs` 重新生成数据模块并提交。

若引语表未自动提取成功（文件格式不同），手动整理 `quotes.json`：
`[{ "text": "原话", "source": "出处" }]`

## 人物包协议

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | 唯一标识，与目录同名 |
| `name` | 是 | 显示名（中文） |
| `period` | 否 | 生卒年代（如 `1844—1900`），用于索引页排版 |
| `role` / `roleEn` | 否 | 身份（如 `哲学家` / `Philosopher`），用于索引页与对话页 |
| `tagline` | 否 | 一句话人设 |
| `description` | 否 | 选人页简介 |
| `theme` | 是 | `primary`/`accent`/`bg` 三色 |
| `welcome` | 是 | 开场白 |
| `disclaimer` | 是 | 免责声明（每次会话首条展示一次） |
| `model` | 否 | 覆盖全局模型（如 `deepseek-v4-pro`） |
| `maxHistory` | 否 | 传入模型的历史消息条数上限（默认 24） |

## API

### `GET /api/personas`

返回启用的全部人物元数据（不含 skill 正文）。

### `POST /api/chat`

```json
{
  "personaId": "nietzsche",
  "messages": [
    { "role": "user", "content": "你好" },
    { "role": "assistant", "content": "……" },
    { "role": "user", "content": "我总在讨好别人" }
  ]
}
```

返回 SSE 流：`data: {"delta":"文本片段"}` … 以 `data: [DONE]` 结束。
若命中危机关键词（自杀/自伤等），返回 `{ "crisis": true, "message": "……求助信息……" }`，不走模型。

## 部署到 Vercel

1. 把 `persona-hub` 推到一个 Git 仓库
2. Vercel 导入该仓库（Framework Preset 选 Other）
3. 在 Vercel 项目设置中添加环境变量：`DEEPSEEK_API_KEY`
4. 部署完成即可访问；`api/*.js` 自动成为 Serverless Function

## 安全说明

- API Key 只存在于服务端环境变量，前端不可见
- 危机话术兜底：自杀/自伤类内容不经过模型，直接返回求助信息
- 来源白名单：`/api/chat` 只接受来自 GitHub Pages、Vercel 生产域名和 localhost 的请求，其他来源返回 403；可用环境变量 `ALLOWED_ORIGINS`（逗号分隔）追加白名单
- 基础限流：每 IP 每分钟 20 次（基于函数实例内存，多实例时尽力而为；需要严格防护请换分布式限流）
- 请求限制：请求体 ≤ 64KB，消息条数 ≤ 100，单条消息 ≤ 16000 字符
- 引语约束：模型只能引用 `quotes.json` 中已核验的原话，防伪造名言
- 现代话题（AI、基因编辑等）：skill 内的回答工作流会强制标注「框架推断」

## 回归测试

```bash
node scripts/smoke-test.mjs
```

检查注册表、人物包完整性、系统提示词组装与引语库格式。设置 `DEEPSEEK_API_KEY` 后可追加真实调用测试。
