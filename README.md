# claude-drives-gemini

English | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

A Claude Code skill: let your AI agent drive the Chrome where **your Google AI Pro account is already signed in**, and generate **images (Nano Banana, 2816×1536) / video (Veo) / music (Lyria)** through the Gemini web app. Output lands on disk losslessly, and media bytes never enter the agent's context.

**Make the Google Gemini subscription you already pay for do extra work.**

## Features

- **One command, end to end**: auto-launch the dedicated Chrome → ensure Pro + Extended Thinking → submit the prompt → stage-aware wait → native download → optional watermark removal, returning a single line of JSON.
- **Never burns quota twice**: only an explicit refusal triggers a safe resubmit; a timeout only extends the wait; a failed download only retries the download.
- **Full resolution, lossless**: the native 2816×1536 original is downloaded directly; `--dewatermark` removes the visible corner logo with exact math (SynthID excluded — see the risk section).

## Prerequisites

- Node ≥ 22 + Chrome + a **Google AI Pro (or higher) subscription** — the consumer web subscription, not an API key.
- Verified on Windows; the macOS / Linux scaffolding is in place but untested (feedback welcome).
- A local proxy if your network cannot reach Google directly.
- UI text matching is verified against the **Chinese** Gemini interface; `locales/en.json` is an unverified best guess — calibration reports are very welcome.

## Quick start

**Recommended: let Claude Code install it for you.** Paste this to Claude Code:

> Install claude-drives-gemini for me: clone https://github.com/MagicYangG/claude-drives-gemini into `~/.claude/skills/claude-drives-gemini`, run `node setup/init.mjs` to generate the local config, walk me through the one-time seeding login, then run the start-chrome launcher and verify with `node scripts/smoke.mjs`.

Manual install is three steps:

```bash
git clone https://github.com/MagicYangG/claude-drives-gemini ~/.claude/skills/claude-drives-gemini
cd ~/.claude/skills/claude-drives-gemini && node setup/init.mjs   # detect Chrome, write config, generate launchers
```

1. **Seeding login (one time)**: run `launchers/login-chrome.cmd|sh`, sign in to Google in the clean window that opens, then close it. (You must sign in from *this* window — Google refuses logins in a window that exposes a debugging port.)
2. **Start the automation Chrome**: run `launchers/start-chrome.cmd|sh`.
3. **Verify**: `node scripts/smoke.mjs` (zero-quota smoke test: environment → Chrome → open page → probe controls).
4. **Create**: just tell Claude "generate an image with Gemini…", or run one command:

```bash
node scripts/gemini-gen.mjs image "Generate an image directly: a stone bridge in a riverside town at dusk after rain, watercolor style. No explanation." out/image.png --dewatermark
```

Video and music work the same way — swap `image` for `video` / `music`. The prompt **must contain an explicit generation verb** ("generate/create … directly" + "no explanation"), otherwise Gemini misroutes it. Add `--use-tool` for 9:16 vertical video or the built-in style templates. `--dewatermark` needs a one-time helper install — `node scripts/setup-gwr.mjs` — otherwise the flag is skipped silently (the result JSON reports `dewm:false`). Step-by-step command chains and the full script reference live in [`scripts/README.md`](scripts/README.md).

## ⚠️ Risks and disclaimer (please read)

- This project is **not affiliated with Google**. Automating the consumer Gemini web app **may violate Google's Terms of Service**, and your account (especially a paid subscription) could be restricted or banned. **Use at your own risk**; consider the official API as an alternative.
- Built-in anti-abuse discipline: serial rather than parallel, throttled output, real keyboard/mouse events, quota respected — please do not turn it into a concurrent flood.
- Watermarks: only the visible corner logo is removed (reverse alpha blending, mathematically lossless). **The SynthID provenance watermark is not removed and cannot be**, so generated content remains traceable.

## Layout

```
SKILL.md            # Agent entry point: ~4KB core contract (progressive disclosure)
setup/init.mjs      # First-run wizard: detect Chrome → write config → generate local launchers
launchers/          # Launcher templates (*.tpl; init generates local start/login-chrome.cmd|sh)
scripts/            # All executable scripts + the operations manual README.md
references/         # runtime-env (environment/login/anti-ban) · gemini-ui (living selector archive) · quota-tiers · dewatermark
locales/            # UI text matching (zh-CN verified; en pending calibration)
providers/          # ADR for the v2.0 provider refactor
```

## License

MIT
