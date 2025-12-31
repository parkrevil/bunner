---
description: Feature 개발 시 상태 머신 기반 워크플로우
---

# Feature Workflow

작업 요청 시 사용하는 상태 머신 기반 워크플로우.

정본: [docs/automation/AGENTS.md](../../docs/automation/AGENTS.md) 11~16장

## When to Use

- 단순 작업 예외 조건에 해당하지 않는 모든 작업
- 아키텍처 영향이 있는 변경
- 설계 논의가 필요한 변경

## 상태 머신 (State Machine)

```text
exploration → draft → negotiation → proposed → accepted → implemented
```

## Phase 1: Exploration (탐색)

1. 사용자 요청 파악
2. `docs/plans/<name>.md` 존재 여부 확인
3. 없으면 → Plan 초안 자동 생성 (템플릿: `../templates/plan.md`)
4. 사용자에게 검토 요청 (notify_user)

## Phase 2: Draft (초안)

1. Plan 문서의 목표/범위/마일스톤 채우기
2. 사용자 피드백 반영
3. 논의 발생 시 → negotiation으로 전이

## Phase 3: Negotiation (논의)

**트리거**: 2개 이상 대안 존재 또는 설계 불만

1. `docs/decisions/ADR-<name>.md` 생성 (템플릿: `../templates/adr.md`)
2. 대안들을 Options 섹션에 정리
3. 사용자에게 선택 요청 (notify_user)
4. 사용자가 선택하면 → proposed로 전이

## Phase 4: Proposed (제안)

1. Spec 문서 작성 (`docs/specs/<name>.md`)
2. 아키텍처 영향 여부 식별
3. 사용자에게 설계 최종 승인 요청
4. 승인 시 → accepted로 전이

## Phase 5: Accepted (확정)

**하드 스탑 체크 (MUST)**:

- [ ] Plan 문서 존재 + status: accepted
- [ ] Spec 필요 시 존재 + status: accepted
- [ ] 아키텍처 영향 시 ARCHITECTURE.md 업데이트 완료
- [ ] ADR 필요 시 accepted 상태

모두 통과 시 구현 시작 가능.

## Phase 6: Implementation (구현)

1. 코드 작성
2. 테스트 작성
3. `bun run verify` 통과 확인

## Phase 7: Implemented (완료)

**DoD 체크리스트 (MUST)**:

- [ ] Plan/Spec 문서 accepted 상태
- [ ] ADR 필요 시 accepted 상태
- [ ] ARCHITECTURE.md 변경 필요 시 반영됨
- [ ] `bun run verify` 통과
- [ ] 변경 사항에 테스트 존재

모두 통과 시 작업 완료.

## 예외: 단순 작업

다음 조건 **모두** 만족 시 워크플로우 생략 가능:

- 요청이 명확하고 구체적
- 영향 범위가 단일 파일 한정
- 아키텍처 영향 없음
- 버그 수정 또는 리팩토링

예: "이 함수 이름 바꿔줘", "이 버그 고쳐줘"
