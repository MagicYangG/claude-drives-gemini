# claude-drives-gemini 脚本运行手册(专用 profile 版)

出图/视频/音乐的完整命令链。**全链路只需专用 Chrome 的 GUID ws,无需任何 CDP 中间代理进程。** 原理与避坑见 `../references/gemini-ui.md`;无人值守正路(专用 profile vs 主 Chrome 的 Chrome 136 限制)见 `../references/runtime-env.md`。

## ⭐ 一条龙(推荐,最省 token)
`gemini-gen.mjs` 把 open→select→wait→**原生下载**→关 tab 一把跑完,**只回一行 JSON**(过程噪音不进上下文):
```bash
cd ~/.claude/skills/claude-drives-gemini/scripts
node gemini-gen.mjs image "<图片提示词>" out/图.png   # → {"ok":true,"dims":"2816x1536","mb":10.6,...}(实际尺寸随宽高比略浮动)
node gemini-gen.mjs video "<视频提示词>" out/片.mp4                  # 视频:原生「下载视频」直接落盘
node gemini-gen.mjs music "<音乐提示词>" out/乐.mp3                  # 乐:原生下载→自动选「纯音频MP3」
# ⚠ 直发提示词契约:必须带「直接生成/制作…」动词+「不要解释」,描述性措辞会被误路由(实测被当点歌弹 YouTube Music)
# 视频直发连拒 2 次自动降级 --use-tool;需要宽高比 9:16/风格模板时显式加 --use-tool
# preflight 已内置(查/拉 9223 Chrome+取 ws);downloadDir 按 ws 端口自动判断无需传
# 复用 ws 省一次握手:WS=$(node gemini-wsurl.mjs); node gemini-gen.mjs image "…" o.png --ws "$WS"
```
下面的「依赖 / 脚本清单 / 分步端到端」仅在**自愈、调试、或想手动控每步**时用。

## 依赖
- **Chrome**:无人值守 → 专用 profile(`../launchers/start-chrome.cmd|sh`,带 `--remote-debugging-port=<port> --remote-allow-origins=*`,免授权);临时有人在场可用主 Chrome(每次重启需手勾远程调试)。已登录 Gemini Pro。
- **无需 CDP 中间代理**:开 tab/轮询/取流全走 GUID ws(`gemini-open`/`gemini-wait "$WS"`/`gemini-media-dl`/`gemini-image-hires`)。
- **本地代理**(config `proxy`)—— `gemini-media-dl` 兜底(cookie+curl 直链,node fetch 不走代理故用 curl --proxy)使用;Chrome 自身访问 Google 走启动器内的 `--proxy-server`;原生下载主线不涉及,也**不做前置代理自检**。
- **水印**:Gemini 网页 设置→媒体水印→**关闭**(一次性,官方功能),之后原生下载直出无可见水印满血产物;SynthID 隐形水印仍在。详见 `../references/dewatermark.md`。
- **勿装去水印类扩展/油猴**(Gemini Watermark Remover 等):会把下载劫持成 `blob:null`,高清自动化失效(需人工点或卸载)。

## 脚本清单
| 脚本 | 作用 |
|---|---|
| ⭐ `gemini-gen.mjs <type> "<prompt>" <out> [--use-tool] [--maxSec N] [--downloadDir DIR] [--ws WS] [--keep] [--no-preflight]` | **一条龙(推荐)**:preflight→open→直发提交→wait(阶段感知重试)→原生下载→关tab,只回一行 JSON(失败含 stage/tid) |
| `gemini-download.mjs <wsUrl> <tid> <type> <out> [--downloadDir DIR] [--profileDir DIR]` | **统一原生下载器**:点原生下载钮→轮询目录落盘(图直接/视频直接/乐选MP3),取代 cookie+curl |
| `gemini-wsurl.mjs [port] [userDataDir]` | 取带 GUID 的 browser-ws 地址:优先 `/json/version`(实时真 GUID),回退 DevToolsActivePort 文件 |
| `gemini-open.mjs <wsUrl> [url] [maxSec]` | **开 tab(替代 proxy /new)**:GUID ws `Target.createTarget`+bringToFront+等水合,stdout 打印 targetId |
| `gemini-select-type.mjs <wsUrl> <tid> <video\|music\|image> "<prompt>" [--use-tool]` | 提交器:默认纯提示词直发;`--use-tool` 真鼠标勾选工具('gone' 二次校验,失败不提交) |
| `gemini-media-dl.mjs <wsUrl> <tid> <outFile> [proxy]` | **fallback**:cookie+curl 取 `<video>` 签名直链;已被 `gemini-download` 原生下载取代,仅原生失灵时备用 |
| `cdp-eval.mjs <tid> "<jsExpr>" [wsUrl]` | 通用 browser-ws eval(调试/探控件;自动走 /json/version 取 GUID) |

## 端到端流程
```bash
# ── proxy-free:全程只需 9223(专用 Chrome)的 GUID ws ──
WS=$(node gemini-wsurl.mjs)                 # /json/version 取真 GUID
DL="$HOME/Downloads"                        # 专用 profile 下载目录=系统默认(主 Chrome 则省略 --downloadDir)

# 图片(高清 2816×1536;可见水印用官方开关一次性关掉)
TID=$(node gemini-open.mjs "$WS")
node gemini-select-type.mjs "$WS" "$TID" image "<图片提示词>"
node gemini-wait.mjs "$TID" image 180 "$WS"                         # 第4参=ws → 脱离 proxy
node gemini-download.mjs "$WS" "$TID" image "out/图片.png" --downloadDir "$DL"   # hires 仅图片兜底

# 视频(每个模态各开一个 tab,避免工具勾选状态串扰)
TIDV=$(node gemini-open.mjs "$WS")
node gemini-select-type.mjs "$WS" "$TIDV" video "<视频提示词>" --use-tool   # 视频手动链建议走工具路径(直发偶发连拒)
node gemini-wait.mjs "$TIDV" video 300 "$WS"
node gemini-download.mjs "$WS" "$TIDV" video "out/视频.mp4" --downloadDir "$DL"   # 原生「下载视频」;media-dl(cookie+curl)仅兜底

# 音乐(Lyria 也是 <video> 元素,prompt 换 music)
TIDM=$(node gemini-open.mjs "$WS")
node gemini-select-type.mjs "$WS" "$TIDM" music "<音乐提示词>"
node gemini-wait.mjs "$TIDM" music 300 "$WS"
node gemini-download.mjs "$WS" "$TIDM" music "out/音乐.mp3" --downloadDir "$DL"   # 原生下载→自动选「纯音频MP3」;media-dl 仅兜底

# 收尾:关掉自己开的 tab(Target.closeTarget,见 gemini-ui.md);备用图片预览=gemini-image-grab(只 1408)
```

## 铁律(详见 gemini-ui.md)
- 媒体字节**绝不**经 eval 回传进上下文;只走 disk(canvas 管道 / curl -o)。
- GUID ws 每条退出路径都 `ws.close()`;别同时开太多 CDP 连接(抢槽会互卡)。**别用超大 awaitPromise eval(会把连接卡死)。**
- 水印走官方开关(设置→媒体水印→关闭),脚本层不做任何去水印处理;**勿安装去水印类扩展/油猴**,装过请卸载(canvas 管道仅备用)。

## 补充脚本(2026-06-14)
| 脚本 | 作用 |
|---|---|
| `gemini-image-hires.mjs <wsUrl> <tid> <out> [--downloadDir DIR] [--profileDir DIR]` | **图片兜底**(功能已被 `gemini-download image` 涵盖):点原生下载→轮询下载目录→真 **2816×1536**;下载目录按 ws 端口自动判断,自定义了目录才需 `--downloadDir` |
| `gemini-image-grab.mjs <wsUrl> <tid> <out>` | 备用(预览):canvas→toDataURL 取无损 PNG,但只 **1408×768** 半分辨率(字节不进上下文) |
| `gemini-wait.mjs <tid> <video\|music\|image> [maxSec] [wsUrl] [failBase]` | 轮询直到媒体就绪;第4参传 `ws://` 走 GUID ws(主线;`http://` 为已废弃的中转模式,新装无需理会);第5参 failBase 供 gen 重发时预扣 prompt 自带的失败词命中 |
| `notify.ps1 "标题" "正文"` | 无人值守完成桌面气泡通知(无依赖) |

简化后图片全自动一条龙(**高清 2816**):
```bash
WS=$(node gemini-wsurl.mjs); TID=$(node gemini-open.mjs "$WS")
node gemini-select-type.mjs "$WS" "$TID" image "<图片提示词>"
node gemini-wait.mjs "$TID" image 180 "$WS"
node gemini-download.mjs "$WS" "$TID" image out/图片.png --downloadDir "$HOME/Downloads"
# 主 Chrome 时省略 --downloadDir(自动读其 Preferences 下载目录);备用预览(只 1408):gemini-image-grab
```
