# Copilot Prompt Library (Bunner)

이 디렉토리는 Bunner 저장소에서 Copilot(Chat/Agent Mode)을 **최소 왕복 + 최대 정확도**로 쓰기 위한
복붙용 프롬프트 템플릿을 제공합니다.

추가로, 이 저장소는 `.github/copilot-instructions.md`에서 이 디렉토리를 **작업 유형에 따라 자동 참조(auto-routing)**하도록 구성할 수 있습니다.
즉, 매번 사용자가 프롬프트를 수동 적용하지 않아도 되도록 하는 운영 레이어입니다.

- 이 문서는 SSOT가 아닙니다.
- SSOT 문서: `docs/**` (L1~L5) 및 `AGENTS.md`가 우선합니다.

## 공통 규칙 (모든 작업 프롬프트 맨 위)

### Preflight 8줄 (필수)

아래 보고 2줄 + 기존 Preflight 6줄(총 8줄)을 Copilot에게 **항상 먼저** 출력하게 하세요.
이 8줄이 없으면 답변을 시작하지 말라고 지시합니다.

0) Prompt: <적용 중인 템플릿 경로 | none>
0) Toolset: <bunner.* | manual-limited>

1) 변경 대상(문서/코드) 후보 경로
2) SSOT 변경(`docs/10..50/**`) 포함? (예면 승인 토큰 요청 후 STOP)
3) Public Facade 변경(`packages/*/index.ts` export) 포함? (예면 승인 토큰 요청 후 STOP)
4) 의존성 변경(`package.json` deps) 포함? (예면 승인 토큰 요청 후 STOP)
5) 적용 규율 링크(해당만):
   - `docs/50_GOVERNANCE/DOCS_WRITING.md`
   - `docs/30_SPEC/TEMPLATE.md`
   - `docs/40_ENGINEERING/STYLEGUIDE.md`
   - `docs/40_ENGINEERING/TESTING.md`
   - `docs/40_ENGINEERING/VERIFY.md`
6) 검증 기준: `bun run verify` (주의: `eslint . --fix` 포함이라 파일 변경 가능)

### 승인 토큰(Decision Artifact)

승인이 필요한 변경은 토큰 없이 진행하면 안 됩니다.
허용 토큰은 `Y`, `OK`, `승인`, `진행해`, `ㅇㅇ` 입니다.

## 템플릿

- 문서 작업: [docs.md](docs.md)
- 스펙 작업: [spec.md](spec.md)
- 계획 작업: [plan.md](plan.md)
- 코딩 작업: [coding.md](coding.md)
- 감사(Audit): [audit.md](audit.md)

## Tool Sets

VS Code Copilot Tool Sets 정의 예시는 [toolsets.bunner.jsonc](toolsets.bunner.jsonc)를 참고하세요.
(사용자 프로필/설정 위치는 VS Code 버전에 따라 다를 수 있으니, 필요하면 해당 파일 내용을 복사해 Tool Sets 설정 파일에 붙여넣습니다.)
