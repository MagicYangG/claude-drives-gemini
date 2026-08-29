# Changelog

## [1.1.0] - 2026-08-29

**去水印链路整体退役**:Gemini 已官方支持关闭可见水印([官方帮助](https://support.google.com/gemini/answer/17405358),网页 设置→媒体水印→关闭,一次设置覆盖图/视频/乐)。

- **移除** gwr 工具链:`scripts/setup-gwr.mjs` 删除;`gemini-download`/`gemini-image-grab` 的 gwr 调用与 `--dewatermark` 处理移除;config 的 `gwrDir`/`GEMINI_STUDIO_GWR` 移除;smoke 不再报 gwr 字段。
- **兼容**:`gemini-gen` 收到旧 `--dewatermark` 参数时提示"已废弃并忽略"后正常出活(不再中断);回执 JSON 不再含 `dewm` 字段。
- **文档**:四语 README/SKILL.md/scripts/README.md 全部改为官方开关指引;`references/dewatermark.md` 重写(开关位置、地区/档位限制、无开关账号的兜底、SynthID 仍在且去不掉的诚实声明);历史 gwr 方案以 git 历史 v1.0.2 为准。
- 已知限制(官方):印度/韩国/越南需 AI Ultra;工作/学校账号不适用。

## [1.0.2] - 2026-08-28

真机端到端回归(会员恢复后首跑)+ 21-agent 对抗审查产出的一揽子修复。

- **修 Gemini 新拒绝话术失配**(真机实锤):「无法提供这方面的帮助/程序代码的局限」(误路由拒绝)与「出现了一些问题」(服务端生成失败)不在 `locales` 失败库里,wait 认不出明确拒绝,「拒绝→同 tab 安全重发」救援链失灵、傻等到超时。zh-CN 补 3 条实锤,en 补对应猜测。
- **修 config `downloadDir` 在一条龙路径失效**(P1):`gemini-gen` 不读 config 的 DOWNLOAD_DIR、恒以自动判断结果显式传给 `gemini-download`,配置项形同虚设(OneDrive 重定向下载目录用户必失败)。统一优先级:显式 `--downloadDir` > config > 自动判断。
- **修 `setup-gwr` 在 Windows 必死**(P1):`execFileSync('npm')` ENOENT(Windows 只有 npm.cmd,Node≥22 spawn .cmd 须 shell)。`--dewatermark` 助手此前在唯一实测平台装不上。
- **修 snap Chromium 必启动失败**(P1):AppArmor 拒写 `$HOME` 下点开头 profile 目录,原味 Ubuntu 必中。init 检测到 snap 自动改用可见目录,显式点目录直接报错;sh 启动器报错不再吞进 /dev/null(落 /tmp 日志)。
- **修启动器「端口绑不上」死局**(真机实锤):登录窗关掉后 Chrome 后台驻留继续占 profile,start 启动器永远绑不上调试口。启动器在端口死时先收割本 profile 的残留 Chrome 进程(不碰主浏览器)。
- **修 Linux 下载目录写死 ~/Downloads**:改按 xdg-user-dirs 解析(zh_CN 桌面是 ~/下载)。
- **加固**:init 模板注入校验补换行与 `%`;`gemini-open` 失败/超时路径收割已建 tab(防孤儿);`gemini-wait` 连续 3 次 eval 失败判 DEADTAB 快速失败(exit 3),拒绝判定加 `!gen` 门(在途生成不误重发);`gemini-gen` 在 gwr 未装时对 `--dewatermark` 给出显式警告(此前静默 `dewm:false`)。
- **文档**:README 四语补 `setup-gwr` 一次性安装说明;zh-CN 示例提示词补「不要解释」(对齐自家契约);runtime-env 修正 proxy 默认值表述(默认直连非 7897)与下载目录优先级;package.json 版本号跟上 tag。

## [1.0.1] - 2026-08-16

- **修 smoke 假绿灯**:`gemini-open` 即使编辑器未水合也退 0(设计如此,留给下游重试),而 smoke 只看退出码就报 `tab: ok(editor 就绪)`——登录过期的新用户会拿到假的通过。改为自己复验编辑器存在,不就绪时明确报 `EDITOR-NOT-READY(登录过期→跑 login 启动器,或代理不通)` 并计入总结论。
- **修启动器模板乱码**:`launchers/*.cmd.tpl` 的中文注释被 cmd.exe 按 ANSI 码页解析,生成的启动器报 `'xxx' is not recognized`。模板改为纯 ASCII 注释(.sh 模板本已是英文,不受影响)。

## [1.0.0] - 2026-08-15(开源发布)

- **发布前清洗**:文档/代码个人痕迹清零(本机路径、代理软件叙事、旧版启动器兜底与自传式注释);LICENSE 署名改为 contributors。
- **安全加固**:`gemini-media-dl` cookie 临时头文件改 0600 权限+随机文件名+进程退出兜底清理,且 cookie 仅随 Google 系 https 主机发送(防 -L 重定向外流);`setup/init.mjs` 对 proxy/路径做启动器模板注入校验。
- **文档校正**(对抗审查产出):下载目录已自动判断的旧说法修正(runtime-env/scripts README);脚本清单补全 `--maxSec`/`--profileDir`/`failBase`;stage 枚举补 `wait-infra`/`run`;高清分辨率表述统一 2816×1536;README 面向新用户重写(AI 辅助安装优先,补齐 start-chrome 步骤)。

## [1.0.0-rc.1] - 2026-07-19(开源四步落地)

- **config 层**:新增 `scripts/config.mjs` 单一真相源(env `GEMINI_STUDIO_*` > `config.json` > 自动探测);全部脚本个人路径/端口/代理硬编码清零;`setup/init.mjs` 首跑向导(探测 Chrome→写 config→按 `launchers/*.tpl` 生成本机启动器)。
- **locales**:`locales/zh-CN.json` + `locales/en.json`(并集匹配,en 待实测校准);select-type/wait/download/gen 的全部 UI 文案匹配 locale 化。
- **跨平台骨架**:launchers cmd/sh 双模板、`scripts/notify.mjs` 三平台通知、Chrome 路径三平台探测、`scripts/smoke.mjs` 零额度冒烟(环境→ws→开tab→控件探测)。
- **收尾**:gemini-image-hires 薄壳化(并入 download image,消灭 90% 重复);media-dl 坏文件 exit 5 + cookie 改临时头文件(防进程列表泄露);gemini-ui.md 考古三层压缩为「当前定稿+教训清单」;新增 `providers/README.md`(GPT 接入 ADR:官方 API 路线;下载事件化暂缓的决策记录)。
- **评审修复**(同日回归审查):locales 并集补回旧硬编码丢失的 `.*` 泛化模式(下载.*视频/下载.*音乐/en 裸 video);config 对 env 空串回落默认(防 NaN 端口/NOMATCH 全灭);genfail 重发保持当前 tool 模式;download 独立裸跑时按 ws 端口判断下载目录(不再误读主 Chrome Preferences);smoke 探测加轮询(模式按钮晚渲染竞态)。

## [1.0.0-beta] - 2026-07-19

- **直发默认**:三模态纯提示词直发(免工具勾选);确立提示词契约(明确生成动词+不要解释,否则误路由)。`--use-tool` 保留为可选增强(视频宽高比 16:9/9:16、18 款风格模板)。
- **模式确保**:提交前自动切到 Pro+扩展思考(新 tab 默认模式不稳定,时而 Flash);回执 JSON 带 `mode`;等待参数按 Pro 思考耗时校准(图 180s+自动延长,思考期无页面迹象不误杀);超时后**最后一搏直接试下载**(Pro 产物常迟到,实测多次救回)。
- **gen v2 阶段感知重试**(修 P0"双倍烧额度"):提交失败(未发出)才重开重试;「无法生成」明确拒绝→同 tab 安全重发(failBase 防旧文案误判);视频直发连拒 2 次→自动降级 `--use-tool`;超时只延长;下载失败只重下载并保留 tab 供补捞(实测补捞有效)。preflight 内置(查/拉专用 Chrome+取 ws)= 一条命令出活。
- **select-type v2**:勾选失败绝不提交;`recheck='gone'` 双义二次校验;按过 Enter 后任何异常一律退 0(焊死重复提交窗口)。
- **wait v2**:失败文案计数(exit 5=GENFAIL,可安全重发)/ TIMEOUT 带 gen 状态 / 全局硬看门狗 / proxy 分支 fetch 超时。
- **download 加固**:按类型扩展名白名单(防并发文件错拷)+ mtime 门槛 + statSync 容态容错 + 容器与扩展名不符自动改写(mp3→mp4)+ DONEJSON 机读行(路径含空格安全)。cdp-eval:30s 看门狗 + 退出码修正。
- **文档重构(渐进式披露)**:SKILL.md 17KB→~4.2KB 核心契约;运行环境/登录/防封号下沉 `references/runtime-env.md`;新增面向陌生人的 README、LICENSE(MIT)、CHANGELOG、package.json。

## [0.9.5] - 2026-07-18

- 深度审查(多维静态审查+逐条对抗核验+真机探针);文档矛盾修复:端口 9223 全量统一(~11 处)、scripts/README 端到端改 gemini-download 主线、dewatermark.md 重写为现行态(油猴版废弃)、真机新知回写(模式档位 3.1/3.5、合成 Escape 失效须真键盘、"Omni" 标注)。
- 取消 7897 代理前置强制自检(降级为故障诊断)。

## [0.9.0] - 2026-06-13/14

- 三模态端到端首通(专用 profile 无人值守定型);原生下载链取代 cookie+curl/canvas 绕路;gwr CLI 去角标;GUID ws 全链脱离 CDP 中间代理。
