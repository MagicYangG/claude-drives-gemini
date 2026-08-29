# claude-drives-gemini

[English](README.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | 한국어

Claude Code 스킬: **Google AI Pro에 이미 로그인된 Chrome**을 AI 에이전트가 조작하여, Gemini 웹에서 **이미지(Nano Banana, 2816×1536) / 영상(Veo) / 음악(Lyria)**을 생성합니다. 결과물은 무손실로 디스크에 저장되며, 미디어 바이트는 에이전트 컨텍스트에 전혀 들어가지 않습니다.

**이미 결제한 Google Gemini 구독을 추가 생산력으로 바꾸세요.**

## 특징

- **명령 한 줄로 처음부터 끝까지**: 전용 Chrome 자동 실행 → Pro + 확장 사고 모드 확인 → 프롬프트 전송 → 단계 인식 대기 → 네이티브 다운로드 → 선택적 워터마크 제거. 반환값은 JSON 한 줄.
- **할당량을 두 번 쓰지 않음**: 명시적 거부일 때만 안전하게 재전송하고, 타임아웃은 대기만 연장하며, 다운로드 실패는 다운로드만 재시도합니다.
- **최대 해상도, 무손실**: 2816×1536 원본을 네이티브로 직접 내려받습니다. `--dewatermark`는 보이는 로고를 수학적으로 무손실 제거합니다(SynthID 제외 — 아래 리스크 절 참조).

## 사전 준비

- Node ≥ 22 + Chrome + **Google AI Pro 이상 구독**(API 키가 아니라 웹 구독 회원).
- Windows에서 실제 검증 완료. macOS / Linux는 골격만 준비되어 있고 미검증입니다(피드백 환영).
- Google에 직접 접속할 수 없는 네트워크라면 로컬 프록시가 필요합니다.
- UI 문구 매칭은 **중국어** 인터페이스 기준으로 검증되었습니다. `locales/en.json`은 검증되지 않은 추정값이므로 실측 보정 제보를 환영합니다.

## 빠른 시작

**추천: Claude Code에게 설치를 맡기세요.** 아래 문장을 그대로 Claude Code에 붙여넣으세요:

> claude-drives-gemini를 설치해줘: https://github.com/MagicYangG/claude-drives-gemini 를 `~/.claude/skills/claude-drives-gemini`에 클론하고, `node setup/init.mjs`로 로컬 설정을 생성한 뒤, 최초 1회 시딩 로그인을 안내하고, start-chrome 런처를 실행한 다음 `node scripts/smoke.mjs`로 환경을 검증해줘.

수동 설치도 세 단계입니다:

```bash
git clone https://github.com/MagicYangG/claude-drives-gemini ~/.claude/skills/claude-drives-gemini
cd ~/.claude/skills/claude-drives-gemini && node setup/init.mjs   # Chrome 탐지, config와 런처 생성
```

1. **시딩 로그인(최초 1회)**: `launchers/login-chrome.cmd|sh`를 실행하고, 열린 깨끗한 창에서 Google에 로그인한 뒤 창을 닫습니다. (반드시 *이 창*에서 로그인하세요. 디버깅 포트가 열린 창에서는 Google이 로그인을 거부합니다.)
2. **자동화용 Chrome 실행**: `launchers/start-chrome.cmd|sh`를 실행합니다.
3. **검증**: `node scripts/smoke.mjs`(할당량 0의 스모크 테스트: 환경 → Chrome → 페이지 열기 → 컨트롤 탐지).
4. **생성**: Claude에게 "Gemini로 이미지 하나 만들어줘…"라고 말하면 됩니다. 또는 명령 한 줄로:

```bash
node scripts/gemini-gen.mjs image "이미지를 바로 생성해줘: 비 갠 해질녘 물의 도시 돌다리, 수채화 스타일. 설명은 필요 없어." out/image.png --dewatermark
```

영상·음악도 동일하게 `image`를 `video` / `music`으로 바꾸면 됩니다. 프롬프트에는 **명확한 생성 동사**("바로 생성/제작해줘" + "설명은 필요 없어")가 반드시 있어야 하며, 그렇지 않으면 Gemini가 잘못 라우팅합니다. 9:16 세로 영상이나 스타일 템플릿이 필요하면 `--use-tool`을 붙이세요. `--dewatermark`는 최초 1회 헬퍼 설치가 필요합니다(`node scripts/setup-gwr.mjs`) — 설치하지 않으면 플래그가 조용히 무시됩니다(결과 JSON에 `dewm:false`). 단계별 명령 체인과 전체 스크립트 사용법은 [`scripts/README.md`](scripts/README.md)에 있습니다.

## ⚠️ 리스크 및 면책(필독)

- 본 프로젝트는 **Google과 무관**합니다. 소비자용 Gemini 웹을 자동화하는 것은 **Google 서비스 약관을 위반할 수 있으며**, 계정(특히 유료 구독)이 제한되거나 정지될 위험이 있습니다. **책임은 사용자 본인에게 있습니다**. 공식 API 대안도 검토하세요.
- 내장된 남용 방지 원칙: 병렬이 아닌 직렬, 스로틀링된 생성, 실제 키보드·마우스 이벤트, 할당량 존중 — 동시 다발 요청으로 개조하지 마세요.
- 워터마크: 보이는 로고만 제거합니다(역 알파 합성, 수학적 무손실). **SynthID 출처 워터마크는 제거되지 않으며 제거할 수도 없습니다** — 생성물은 여전히 추적 가능합니다.

## 디렉터리

```
SKILL.md            # 에이전트 진입점: 약 4KB 핵심 계약(점진적 공개)
setup/init.mjs      # 최초 설치 마법사: Chrome 탐지 → config 작성 → 로컬 런처 생성
launchers/          # 런처 템플릿(*.tpl; init가 start/login-chrome.cmd|sh 생성)
scripts/            # 모든 실행 스크립트 + 운영 매뉴얼 README.md
references/         # runtime-env(환경/로그인/차단 방지) · gemini-ui(셀렉터 살아있는 기록) · quota-tiers · dewatermark
locales/            # UI 문구 매칭(zh-CN 검증 완료; en 보정 대기)
providers/          # v2.0 Provider 리팩터링 ADR
```

## License

MIT
