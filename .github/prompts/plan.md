# Plan Prompt Templates

## 0) 공통 Preflight 8줄 + Handshake

[README.md](README.md)의 Preflight 8줄 + Handshake를 먼저 출력하게 하세요.

---

## 1) Run Plan 초안 작성 (plans/\*, 코딩 금지)

사용 시 권장 Tool Set: `bunner.plan`

복붙 프롬프트:

```text
# Preflight 8줄 먼저 출력

Task:
- plans/<yymmdd>_<seq>_<name>.md 파일을 생성하고, .agent/plan-template.md 구조를 그대로 사용해 Run Plan을 작성해라.

Rules:
- status: draft
- Persona/Handshake는 AGENTS.md 형식을 그대로 포함
- 코드를 수정하지 말고, 계획 파일만 작성
- 승인 토큰이 필요한 변경이 포함될 가능성이 있으면 명시하고(어디서 필요한지), 그 지점에서 STOP 조건을 둔다

Required reads (MUST):
- AGENTS.md
- .agent/plan-template.md
- .agent/workflow.md

Verification:
- 완료 조건에 `bun run verify`를 명시한다.
```

---

## 2) Plan 상태 전이/변경 기록 (append-only 규칙)

사용 시 권장 Tool Set: `bunner.plan`

복붙 프롬프트:

```text
# Preflight 8줄 먼저 출력

Task:
- .agent/workflow.md의 상태 머신 규칙에 따라 plan frontmatter의 status를 갱신하거나,
  in-progress 상태에서 변경이 필요하면 "Plan Changes" 섹션에 append-only로 기록해라.

Required reads (MUST):
- .agent/workflow.md
- docs/50_GOVERNANCE/OVERVIEW.md (승인 토큰 규칙)

Rules:
- draft/negotiation/proposed에서만 본문 수정 가능
- in-progress에서 계획 변경은 Plan Changes에만 기록 + 승인 토큰 필요

Output:
- 변경된 status
- 변경 요약 5줄 이내
- (Plan Changes를 쓴 경우) 사용한 승인 토큰
```

---

## 3) 단순 작업 예외 적용 판정

사용 시 권장 Tool Set: `bunner.plan`

복붙 프롬프트:

```text
# Preflight 8줄 먼저 출력

Question:
- 이 작업이 "단순 작업" 예외로 처리 가능한지 판정해라.

Criteria:
- 단일 파일 또는 명확히 한정된 범위
- Public Facade 변경 없음
- 아키텍처 영향 없음
- SSOT 문서 변경 없음

Output:
- Yes/No
- 근거 3줄
- Yes라면: 사용자에게 예외 적용 승인 요청
```
