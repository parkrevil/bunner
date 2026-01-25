# Audit Prompt Templates (Docs ↔ Spec ↔ Code)

이 파일은 "전체 문서 품질"과 "규칙 준수"를 자주 점검하는 워크플로우를 원샷으로 수행하기 위한 템플릿입니다.

## 0) 공통 Preflight 8줄 + Handshake

[README.md](README.md)의 Preflight 8줄 + Handshake를 먼저 출력하게 하세요.

---

## 1) Full Docs Audit (전수 문서 품질 감사)

권장 Tool Set: `bunner.audit.docs`

복붙 프롬프트:

```text
# Preflight 8줄 먼저 출력

Task:
- docs/** 전체에서 아래 문제를 전수로 찾아라:
  - 일관성(같은 개념/규칙이 문서마다 다르게 표현됨)
  - 중복(같은 규칙이 여러 곳에 반복됨)
  - 모순(둘을 동시에 만족 불가)
  - 모호(판정 불가능, 경계 조건 불명)
  - 흐름/내비게이션(찾기 어렵고 연결이 끊김)

Hard rules:
- 해결책은 "문제 목록" 이후에만.
- 각 항목은 근거(문서 경로 + 섹션 제목 또는 문장 인용)를 포함.
- 의미 변경(SSOT 변화)이 필요하다고 판단되면 승인 요청 포맷(5필드)으로 요청하고 STOP.

Required reads (MUST):
- docs/10_FOUNDATION/SSOT_HIERARCHY.md
- (문서 감사 시) docs/50_GOVERNANCE/DOCS_WRITING.md

Output (고정):
1) Duplicates
2) Contradictions
3) Ambiguity
4) Flow/Navigation
5) Approval Gate Summary
```

---

## 2) Rules-to-Code Audit (문서 규칙 ↔ 코드 준수)

권장 Tool Set: `bunner.audit.rules` (확정이 필요할 때만 `bunner.implement`로 전환)

복붙 프롬프트:

```text
# Preflight 8줄 먼저 출력

Goal:
- 아래 문서 규칙을 기준으로 코드베이스 준수 여부를 점검하고 위반 후보를 모두 나열해라.

Rule sources (choose applicable):
- docs/40_ENGINEERING/STYLEGUIDE.md
- docs/40_ENGINEERING/TESTING.md
- docs/40_ENGINEERING/VERIFY.md
- 관련 docs/30_SPEC/*.spec.md

Required reads (MUST):
- docs/40_ENGINEERING/STYLEGUIDE.md
- docs/40_ENGINEERING/TESTING.md
- docs/40_ENGINEERING/VERIFY.md
- (해당 시) docs/30_SPEC/SPEC.md + 관련 *.spec.md

Hard rules:
- 추정 금지. 위반 후보는 근거(규칙 문장 + 코드 위치 + 왜 위반인지)를 포함.
- 확정이 필요하면 bun run verify 실행을 제안하되, 실행은 "이 단계에서 실행해도 되는지" 한 줄로 확인받고 진행.

Output format:
- Rule (문서/섹션)
  - Candidates: <paths>
  - Evidence: 1~2줄
  - Fix type: code | tests | docs
  - Approval needed?: yes/no
```

---

## 3) Refactor Compliance Audit (리팩토링 시 문서/스펙 준수 체크)

권장 Tool Set: `bunner.refactor.gate`

복붙 프롬프트:

```text
# Preflight 8줄 먼저 출력

Task:
- <리팩토링 PR/변경 범위>가 문서/스펙/엔지니어링 규율을 준수하는지 점검해라.

Process:
1) 적용 규칙 목록 확정(관련 spec + STYLEGUIDE + TESTING + VERIFY)
2) 변경된 코드가 각 규칙에 대해 위반이 있는지 후보를 나열
3) bun run verify가 통과하는지 확인(또는 통과시킬 수정안을 제시)

Required reads (MUST):
- docs/40_ENGINEERING/STYLEGUIDE.md
- docs/40_ENGINEERING/TESTING.md
- docs/40_ENGINEERING/VERIFY.md
- 관련 docs/30_SPEC/*.spec.md

Output:
- Compliance checklist
- Violations / Suspicions
- Next commands
```
