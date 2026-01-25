---
description: 단일 포괄 워크플로우 (정본)
---

# Workflow

이 문서는 **작업 진행 순서, 승인 조건, 중단 조건**만을 정의한다.

- 정본(문서 지도): [docs/00_INDEX.md](../../docs/00_INDEX.md)
- 권한/행동 제한 정본: [AGENTS.md](../../AGENTS.md)
- 승인 아티팩트(토큰) 정본: [OVERVIEW.md](../../docs/50_GOVERNANCE/OVERVIEW.md)
- 실행 입력 템플릿: [plan-template.md](plan-template.md)

---

## 적용 범위

- 이 Workflow는 사용자가 명시적으로 “계획(Plan) 작성”을 요청한 경우에만 적용한다.
- 그 외(질문/설명/분석/토론, 또는 파일 변경 요청 포함)는 본 Workflow의 적용 대상이 아니다.

---

## Phase 상태 머신

```text
exploration → draft → negotiation → proposed → accepted → in-progress → implemented
모든 상태 → canceled
```

---

## Plan 상태 규칙 (MUST)

- Plan은 새 작업 시작 시 1회만 생성한다.
- Plan 본문은 `draft | negotiation | proposed` 상태에서만 수정할 수 있다.
- `accepted | in-progress | implemented | canceled` 상태의 Plan 본문은 불변이다.
- Plan 변경이 필요한 경우:
  - `draft | negotiation | proposed`: Plan 본문을 직접 수정한다.
  - `in-progress`: 사용자 승인 아티팩트(토큰) 후 `Plan Changes`에 append-only로 기록한다.

---

## Phase 0: Preflight

아래 항목이 식별되지 않으면 다음 Phase로 이동하면 안 된다.

- 변경 대상
- Public API 변경 여부
- 아키텍처 영향 여부

---

## Phase 1: Exploration

- 요구사항을 질문한다.
- Plan이 없으면 `status: draft`로 생성한다.

---

## Phase 2: Draft

- Scope / Non-Goals / 실행 개요를 채운다.
- 사용자 피드백을 반영한다.

---

## Phase 3: Negotiation

다음 중 하나라도 발생하면 진입한다.

- 설계 선택지가 복수인 경우
- 사용자 이견/재검토 요청
- SSOT 변경 가능성 발견

- 필요 시 ADR을 `status: draft`로 생성한다.

---

## Phase 4: Proposed

- Spec/Architecture 변경이 필요한 경우, **변경 필요성만 명시**한다.
- 실제 변경은 사용자 승인 아티팩트(토큰) 이후에만 가능하다.
- 최종 승인을 요청한다.

---

## Phase 5: Accepted

### 승인 조건 (ALL)

1. 사용자 승인 아티팩트(토큰)
2. Plan `status: accepted`
3. 관련 문서(Spec/ADR) `status: accepted` (있는 경우)

충족되지 않으면 구현을 시작하면 안 된다.

---

## Phase 6: Implementation

- Plan `status`를 `in-progress`로 전환한다.
- 이 Phase에서 실제 파일 변경은 Phase 5의 승인 조건이 충족된 경우에만 허용한다.
- 금지/보호 영역(특히 SSOT) 변경 필요성 발견 시 즉시 중단하고 Phase 3으로 복귀한다.
- Step 단위로 구현 및 최소 검증을 수행한다.
- 설계 위반 발견 시 즉시 중단하고 Phase 3으로 복귀한다.
- `bun run verify` 통과 시 `status: implemented`로 전환한다.

---

## Phase 7: Implemented

### 완료 조건

- Plan 상태 `implemented`
- 관련 문서 상태 `accepted`
- `bun run verify` 통과

---

## verify 실패 처리

- 실패 시 [SAFEGUARDS.md](../../docs/50_GOVERNANCE/SAFEGUARDS.md)를 따른다.
- 추가 수정/재시도 여부는 사용자 판단을 기다린다.

---

## 예외: 단순 작업

다음 조건을 모두 만족해야 한다.

- 단일 파일 또는 명확히 한정된 범위
- Public API 변경 없음
- 아키텍처 영향 없음
- SSOT 문서 변경 없음

예외 적용 여부는 **사용자가 승인**한다.

- 승인 방식은 [OVERVIEW.md](../../docs/50_GOVERNANCE/OVERVIEW.md)의 승인 아티팩트(토큰/PR 승인)로만 판정한다.
