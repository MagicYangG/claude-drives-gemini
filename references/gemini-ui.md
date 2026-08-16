# Gemini 网页 UI 选择器档案(会随站点改版过期)

> 最后实测:2026-07-18/19(真机复核:选择器零漂移;模式/直发新知见下)。**Gemini 经常改版;任一步失败时,先重新探测、再按新结果更新本文件(含日期),这就是技能的自我进化。** 文案匹配已 locale 化:改这里之前,先看是不是该改 `locales/*.json`。

## 当前选择器(最后复核 2026-07-18,零漂移)

- 输入框:`div.ql-editor[contenteditable=true]`
- 模式选择器:button,aria-label 完整句式「打开模式选择器,当前模式为"Pro 扩展"」(语义匹配 "模式/Pro" 仍有效);档位菜单 4 项:「3.1 Flash-Lite 极速回答」「3.5 Flash 全方位帮助」「3.1 Pro 高阶数学与代码」「扩展思考 擅长解决复杂问题」
- 工具入口("+"):button,aria-label = "上传和工具"
- 创作工具:`[role=menuitemcheckbox]`,文本含 "制作图片/制作视频/制作音乐/Canvas/Deep Research/学习辅导"
- 图片全尺寸下载钮:button,aria-label = "下载完整尺寸的图片"(带 🍌)→ 合成 click 直接下载
- 视频下载钮:button,aria-label = "下载视频" → 合成 click 直接下载(无菜单)
- 音乐下载钮:button,aria-label = "下载音乐作品" → 合成 click 弹二级菜单,真鼠标选「纯音频MP3 音轨」(默认)或「视频音频和封面图片」(MP4)
- 产物:图 `img.naturalWidth>=256`(blob 同源);视频/乐都是 `<video>` 元素(Lyria 不是 `<audio>`!);出图中=蓝色骨架占位(`repeating-linear-gradient(rgb(51,110,243)…)`,"生成中"最可靠信号)

## ⭐ 真机复核新知(2026-07-18/19)

- **纯提示词直发三模态全通**:不开 + 菜单,insertText+Enter 即自动路由。**提示词契约**:必须带「直接生成/制作…」动词+「不要解释」——描述性措辞被误路由(实测被当点歌弹 YouTube Music)。视频直发偶发「我无法生成该视频」通用失败,同提示词重发一次即成(明确失败=未产出,重发不烧额度);gen 已内置连拒自动降级 `--use-tool`。
- **勾选工具的价值**:视频工具面板 = 18 款风格模板 + 宽高比 16:9/9:16 切换,界面标注用 "Omni" 生成 → 需要竖屏/风格时才勾。
- **模式**:新 tab 默认模式**不稳定**(时而 Pro 扩展、时而 Flash 扩展)→ select-type 已内置提交前确保 Pro+扩展思考;**模式按钮晚于编辑器渲染**(读取要轮询)。**Pro 比 Flash 慢数倍且思考期页面零迹象**(耗时与等待策略见 runtime-env.md)。
- **Escape 坑**:合成 `document.dispatchEvent` 的 Escape 关不掉 + 菜单;必须 `Input.dispatchKeyEvent` 真键盘 Escape。

## 失败时的自愈流程(Claude 执行,不要转人工)

1. **重新探测**(只读小 JSON):`node scripts/cdp-eval.mjs <tid> "[...new Set([...document.querySelectorAll('button,[role=button],[role=menuitemcheckbox]')].map(b=>(b.getAttribute('aria-label')||'').trim()).filter(Boolean))]"`
2. **语义模糊匹配**:按功能找(含 "视频/图片/音乐/下载"),容忍改名,不依赖 CSS class/hash;先 discover 再 act。
3. **回写进化**:跑通后把新文案更新进 `locales/*.json`(选择器结构变了才改本文件+scripts),并刷本文件日期。
4. 图片去水印失灵 → `references/dewatermark.md` 兜底。

## 交互机制要点(实测定论)

- 新 tab 必须 `Page.bringToFront` 激活,否则后台 tab 定时器被节流、Angular 不水合,"+"菜单点不开——视频链路能否跑通的决定性一步。
- 合成 `el.click()` 开"+"菜单可靠;**勾选菜单项必须真鼠标 `Input.dispatchMouseEvent` 且带 `buttons:1`**(Material 不认无 buttons 的合成手势);点前先读 `aria-checked`,已 true 就收手(防 toggle-off);菜单点选后自动关,`recheck=gone` 是双义信号,须重开菜单二次校验(select-type 已内置)。
- 真键盘输入走 `Input.insertText`(UTF-8 干净)+ Enter 提交;不要经任何按 latin1 转码的中转(会乱码)。
- 别用超大 `awaitPromise` eval 回传媒体字节(几 MB dataURL 会把连接卡死);媒体一律走原生下载落盘。

## 历史结论(细节已淘汰,只留教训;运行环境/端口/登录见 runtime-env.md)

- 原生下载钮一直是正解;早年"下载失败"多为**找错目录**——`blob:` 下载无视 CDP downloadPath,一律落 Chrome profile 的默认下载目录,先读 `Preferences.download.default_directory`。
- cookie+curl 直链(gemini-media-dl)与 canvas 截图(gemini-image-grab,仅 1408 半分辨率)是被去水印扩展逼出的旧绕路,现仅作 fallback;**去水印扩展/油猴装上会把下载劫持成 `blob:null` 毁掉自动化高清**,勿安装、装过请卸载(详见 dewatermark.md)。
- 页面 `<img>` 是 1408×768 半分辨率预览;真 2816×1536 只有点「下载完整尺寸的图片」才有。
- 裸 `ws://…/devtools/browser`(无 GUID)不路由会卡 CONNECTING;GUID 一律经 `/json/version` 实时取(`DevToolsActivePort` 文件会陈旧)。
