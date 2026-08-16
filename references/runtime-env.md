# 运行环境(Chrome / 登录 / 端口 / 代理 / 防封号)

> 从 SKILL.md 下沉的细节档案;按需读,平时 `gemini-gen` 的 preflight 已自动处理大半。

## 专用 Chrome = 无人值守正路(E2E 实测定稿)
- **端口默认 9223**(专用出图 Chrome 独占,config `port`);若主 Chrome 也开着调试端口(常见 9222,config `mainPort`),两者必须分开——同端口时 IPv4 被主 Chrome 占、脚本会连错。
- 启动器:`launchers/start-chrome.cmd|sh`(由 `node setup/init.mjs` 按 config 生成;幂等,端口活着就复用)。独立 profile 默认 `~/.gemini-automation-chrome`(config `profileDir`),启动参数含 `--remote-debugging-port=<port> --remote-allow-origins=*` 与可选 `--proxy-server`。`*` 白名单在隔离专用 profile 上可接受(Node 24 原生 WebSocket 可能带 Origin,单 origin 白名单反而挡脚本)。
- **🔑 Chrome 136+ 硬限制**:主/默认 profile 上远程调试端口被静默忽略,须每次重启后手勾 `chrome://inspect/#remote-debugging`——**主 Chrome 无法无人值守**,仅人在场临时用。非默认 `--user-data-dir` 不受限,免勾选、重启依旧可调试——**专用 profile 是唯一持久免授权的路**。`--remote-allow-origins` 治不了这个(它管 origin,不是 136 的 profile 限制)。
- **🚫 别折腾「复用主 Chrome 登录态+免授权」**:两者互斥,无参数可绕。正解永远是专用 profile。

## 登录(播种/续期)
- 专用 profile 会话过期 → 跑 `launchers/login-chrome.cmd|sh`(纯净窗口、**无调试端口=无自动化信号**,Google 才不拦)→ 手动登录/一键「继续以…身份」→ 关窗 → 再跑 start 启动器。**绝不在带调试端口的窗口交互登录**(Google 判"浏览器不安全"拒登)。
- 自动化中撞登录墙的判别:editor 迟不就绪 → 探 tab,URL 跳 `accounts.google` / 页面含「登录/Sign in」= 登录问题;「继续以 <你> 身份」一键续期可替点;要账密/2FA 的**绝不自动输**(防风控),提醒用户人工。
- **⚠ 代理节点坑**:`gemini.google.com` 通 ≠ `accounts.google.com` 通!部分代理节点只通前者 → 登录页打不开。登录前确认 accounts 能过代理(不行就换节点/切全局);出图本身只需 gemini 通。

## 代理(不做前置自检)
- 专用 Chrome 靠启动器里的 `--proxy-server`(config `proxy`,默认 `http://127.0.0.1:7897`)访问 Google;代理常开时无需任何检查。网络可直连 Google 的环境把 config `proxy` 留空即可(启动器不带代理参数)。
- **页面 ERR/空白、gemini 打不开** → 多半本地代理没开:提醒用户启动代理后重试;仍不通(代理失效/没选对节点)→ 停,报告用户,勿盲目重试。
- 判别:editor 迟不就绪时探一次 tab——accounts/登录字样=登录问题;页面 ERR/空白=代理问题。

## ws / 下载目录
- ws 地址必须带 GUID:`ws://127.0.0.1:<port>/devtools/browser/<GUID>`,由 `gemini-wsurl.mjs` 走 `/json/version` 实时取(`DevToolsActivePort` 文件会留旧 GUID);专用端口优先,主 Chrome 仅兜底。无需任何 CDP 中间代理进程。
- 下载目录:专用 profile 落**系统默认下载目录**(如 `~/Downloads`);主 Chrome 落其 Preferences 里配置的自定义目录。`gemini-gen` 与裸跑的 `gemini-download`/`gemini-image-hires` 都按 ws 端口自动判断(连专用 Chrome 自动落系统默认目录);自定义了下载目录才需显式 `--downloadDir`。"下载没出来"先查真实目录,别想当然。

## 分步自检(调试用;gemini-gen preflight 已内置等价逻辑)
1. `curl -s --noproxy '*' http://127.0.0.1:9223/json/version` 有 `webSocketDebuggerUrl` = 活着。⚠ Git Bash 的 curl 会走代理环境变量,查 localhost 必带 `--noproxy '*'`(否则空返回=假阴性);Node fetch/PowerShell 不走代理可直连。
2. 没活着 → 跑 start 启动器(约 3–8s 起),回一句"已拉起专用 Chrome"告知用户。
3. `WS=$(node gemini-wsurl.mjs)`。

## 模式与耗时(实测)
- 新 tab 默认模式**不稳定**(时而 Pro 扩展、时而 Flash 扩展)→ `gemini-select-type` 已内置提交前确保 Pro+扩展思考(质量优先),回执 JSON 带 `mode`。
- **Pro 扩展思考比 Flash 慢数倍**(图:Flash ~40s vs Pro ~150s+;乐可到 8 分钟+),且思考期页面**无任何"正在生成"迹象**——不是卡死。gen 默认 maxSec:图 180s、视频/乐 300s,超时自动延长一轮;仍超时会**最后一搏直接试下载**(产物常已悄然出现,实测多次靠这救回),再不行才保留 tab 报失败。

## 防封号守则(必守;专用 profile 属新设备登录,风控更敏感)
出活节流、**串行不并行**(多 CDP 连接抢槽=封号风险)、勿爆发连发;尊重额度(Veo 3条/天);真键鼠模拟(脚本已是);只用受信任会话。

## 无人值守(用户不在场)
preflight 拉起专用 Chrome → 后台串行出活 → 产物落交付文件夹 → 完事 `scripts/notify.mjs` 桌面通知(Win/macOS/Linux 三平台);失败优先自愈(重探选择器/bringToFront/重开 tab),真不行才通知+留现场,绝不空等阻塞。

## 杂项坑
- Flow 视频服务器仅留约 2 天,生成后及时下载。
- tab 可能被用户关掉:报 "No target" 就重开 tab。
- 真鼠标点击必须带 `buttons:1`(Material 不认),详见 gemini-ui.md。
