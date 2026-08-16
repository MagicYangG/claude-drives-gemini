# 去水印(Gemini 可见角标)

## 🟢 现行策略(以此为准)
- **图片(自动化主线)**:**不装任何去水印扩展/油猴**——装上会把 CDP 触发的下载劫持成 `blob:null`,自动化拿不到 2816 高清。主线 = 原生「下载完整尺寸的图片」直出**带水印 2816 原图** → **gwr CLI 去角标**(`gemini-gen … --dewatermark` / `gemini-download image --dewatermark` 内部自动跑,CLI 用法见下文)。
- 仅纯人工场景(完全不走自动化)装油猴点下载最省事;但装上后自动化高清失效——二选一,本技能选自动化。
- **视频**:**不去水印**,保留"veo"角标。实测去后画质明显变差,不值;且 gwr 视频 CLI 路线跑不通(见文末)。
- **SynthID**(图隐形 + 音频)**去不掉**,也不去(溯源用),诚实告知用户。
- 下面的公式 / ffmpeg 内容**仅作极端兜底**,常规流程用不到。

---

## 工具
`GargantuaX/gemini-watermark-remover`(MIT)。**纯本地 JS,反向 Alpha 混合**(数学无损,非 AI inpainting),**只去可见角标 logo,不去 SynthID**。支持图片 + 视频(mediabunny,无需 ffmpeg,保留音轨)。因为是本地算法,"网站过期"风险基本不存在。

## 安装位置
config `gwrDir`(默认 `~/gemini-watermark-remover`)。`node scripts/setup-gwr.mjs` 自动 clone + 装依赖(幂等,防误删自愈);手动等价:
```bash
git clone --depth 1 https://github.com/GargantuaX/gemini-watermark-remover.git
cd gemini-watermark-remover && npm install sharp mediabunny
```

## 用法(已实测)
```bash
cd <gwrDir>
node bin/gwr.mjs remove "<input.png 或 .mp4>" --output "<out>" --json
```
返回 JSON 含 `applied` / `position` / `residualVisibility.visible`。实测 2816×1536 图:`visible:false`,分辨率不变 = 无损。

## 失效兜底(项目/依赖将来挂了)
核心公式:`original = (watermarked − α·logo) / (1 − α)`(α、logo = Gemini 角标的已知 alpha 图)。
1. **Python NumPy ~10 行**复现:先取 logo 的 alpha 图(白底/黑底两张带水印图采样差值推算 α),再按公式逐像素逆算。
2. `ffmpeg -vf "delogo=x=W-160:y=H-160:w=96:h=96"`(位置固定;边缘略糊)。
3. 裁剪边角(零画质损失,丢边角)。
4. IOPaint / LaMa 本地 inpainting(背景复杂时更好,需 GPU、慢)。

## 注意
- SynthID(图隐形水印 + 音频水印)**去不掉**,也不建议去(溯源用)。
- Ultra 会员的视频才原生无可见水印;Pro 视频有可见"veo"角标。

## ⚠ gwr 视频 CLI 不可用(实测定论)
图片 CLI 开箱即用;**视频 CLI 跑不通**:需 `npm run build`(esbuild)+ 无头浏览器(playwright)跑客户端 JS,实测 build 后仍 `Failed to fetch`,发布版 `npx @pilio/...` 报 `preview unavailable`,装 playwright 也无解——**放弃**。若确需视频去水印,改用:
1. repo 的 **userscript / Chrome 扩展**(Gemini 页面内去,反向 alpha 无损;⚠ 与自动化高清互斥,见现行策略):`geminiwatermarkremover.io/userscript/gemini-watermark-remover.user.js`;
2. **在线版**:`geminiwatermarkremover.io/video`;
3. **ffmpeg delogo**(纯 CLI 可自动化,边缘略糊):`ffmpeg -i in.mp4 -vf "delogo=x=W-180:y=H-100:w=150:h=60" out.mp4`(坐标按实际"veo"角标微调)。

图片仍用 gwr CLI 最佳。
