# Provider 接缝(ADR,2026-07-19)

## 现状

当前唯一 provider = Gemini 网页自动化,实现即 `scripts/` 下的脚本族,编排入口 `gemini-gen.mjs` 已是事实上的 Provider 接口形状:

```
generate(type: image|video|music, prompt, outFile, opts{dewatermark, useTool, maxSec, ...})
  → {ok, file, dims, mb, mode, resubmits, seconds} | {ok:false, stage, error, tid?}
```

## 接入 GPT 生图(未来)

**推荐路线 = OpenAI 官方 Images API**,不是 chatgpt.com 网页自动化:

- 无封号风险(网页自动化对 OpenAI 账号同样有 ToS 风险,且 chatgpt.com 反自动化更激进);
- 按 token/张计费透明,质量段位(gpt-image 系)本就领先;
- 实现薄:一个 `providers/openai/gen-image.mjs`(fetch API → 落盘 → 同款一行 JSON),读 `OPENAI_API_KEY` 环境变量,复用 config.mjs 的输出约定即可,无需 CDP。

## 目录演进(v2.0 时执行,当前不动工作中的脚本)

```
providers/
├ gemini/    # 现 scripts/ 的 open/select/wait/download 迁入,共享 lib/cdp.mjs
└ openai/    # gen-image.mjs(官方 API)
lib/         # cdp.mjs(ws+eval+真键鼠样板,现在六脚本各抄一份)· download-watch.mjs
```

迁移原则:先让 `gemini-gen.mjs` 变成纯调度器(按 `--provider` 分发),各 provider 输出同一 JSON 契约;CDP 样板抽 `lib/cdp.mjs` 一次性消灭六份重复。

## 已决定不做的

- **下载事件化(Browser.downloadProgress)暂缓**:目录轮询已加白名单+mtime 门槛,实测稳定;事件化要动 `Browser.setDownloadBehavior` 语义并重新 E2E 全链,收益(消灭"下载目录在哪"配置项)不抵当下风险。留给 v2.0 与 lib/download-watch.mjs 一起做。
