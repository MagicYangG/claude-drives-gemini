# claude-drives-gemini

[English](README.md) | 简体中文 | [日本語](README.ja.md) | [한국어](README.ko.md)

一个 Claude Code 技能:让 AI Agent 驱动你已登录 **Google AI Pro 会员**的 Chrome,用 Gemini 网页版生成**图片(Nano Banana,2816×1536)/ 视频(Veo)/ 音乐(Lyria)**。产物无损落盘、媒体字节零进上下文。

**充分利用 Google Gemini 会员,让它变成额外的生产力。**

![演示:一条命令经你的 Gemini 会员生成 2816×1536 图片](docs/demo.gif)

## 特性

- **一条命令端到端**:自动拉起专用 Chrome → 确保 Pro+扩展思考模式 → 直发提示词 → 阶段感知等待 → 原生下载,回执一行 JSON。

- **重试策略**:明确拒绝才安全重发;超时只延长等待;下载失败只重下载。

- **高清原图**:2816×1536 满血原图原生直下。

  注：在 Gemini 里一次性关掉可见水印(设置→媒体水印→关闭,官方功能),之后产物全部直出干净(隐形 SynthID 仍在,见风险节)。

## 前置条件

- Node ≥ 22 + Chrome + **Google AI Pro 及以上订阅**(网页版会员,非 API Key)。
- Windows 实测跑通;macOS / Linux 骨架已备、待实测(欢迎反馈)。
- 网络需能正常访问 Google。

## 快速开始

**推荐:让 Claude Code 帮你装。**把下面这段直接发给 Claude Code:

> 帮我安装 claude-drives-gemini:克隆 https://github.com/MagicYangG/claude-drives-gemini 到 `~/.claude/skills/claude-drives-gemini`,跑 `node setup/init.mjs` 生成本机配置,指导我完成一次性登录,再跑 start-chrome 启动器,最后用 `node scripts/smoke.mjs` 验证环境。

手动装有三步:

```bash
git clone https://github.com/MagicYangG/claude-drives-gemini ~/.claude/skills/claude-drives-gemini
cd ~/.claude/skills/claude-drives-gemini && node setup/init.mjs   # 探测 Chrome,生成 config 与启动器
```

1. **登录(一次性)**:跑 `launchers/login-chrome.cmd|sh`,在弹出的纯净窗口登录 Google,关窗。(必须用这个窗口登录;带调试端口的窗口 Google 会拒登。)
2. **起自动化 Chrome**:跑 `launchers/start-chrome.cmd|sh`。
3. **验证**:`node scripts/smoke.mjs`(零额度冒烟:环境 → Chrome → 开页 → 控件探测)。
4. **出活**:对 Claude 说「用 Gemini 生成一张…」即可;或直接一条命令:

```bash
node scripts/gemini-gen.mjs image "直接生成一张图片:雨后黄昏的江南古镇石桥,水彩风格;不要解释" out/图.png
```

视频/音乐同款,把 `image` 换成 `video` / `music`。提示词**必须带明确生成动词**(「直接生成/制作…」+「不要解释」),否则会被 Gemini 误路由;视频要 9:16 竖屏或风格模板时加 `--use-tool`。不想要可见水印?在 Gemini 里一次性关掉:设置(左下角齿轮)→ 媒体水印 → 关闭——官方功能,图/视频/乐全覆盖。分步命令链与全部脚本用法见 [`scripts/README.md`](scripts/README.md)。

## ⚠️ 风险与免责(必读)

- 本项目**与 Google 无隶属关系**。自动化操作消费者版 Gemini 网页**可能违反 Google 服务条款**,账号(尤其付费订阅)存在被限制或封禁的风险,**后果自负**;建议评估官方 API 替代。
- 内置防风控纪律:串行不并行、节流出活、真键鼠模拟、尊重额度——请勿改成并发轰炸。
- 水印:可见水印由 Gemini 官方设置控制(设置→媒体水印);**SynthID 隐形溯源水印不受该开关影响、也去除不了**,生成内容仍可被溯源识别。

## 目录

```
SKILL.md            # Agent 入口:核心契约 ~4KB(渐进式披露,细节按需加载)
setup/init.mjs      # 首装向导:探测 Chrome → 写 config → 生成本机启动器
launchers/          # 启动器模板(*.tpl;init 据此生成本机 start/login-chrome.cmd|sh)
scripts/            # 全部执行脚本 + 运行手册 README.md
references/         # runtime-env(环境/登录/防封号)· gemini-ui(选择器活档案)· quota-tiers · dewatermark
locales/            # UI 文案匹配(zh-CN 实测;en 待校准)
providers/          # v2.0 Provider 重构 ADR
```

## License

MIT
