---
description: 단일 포괄 워크플로우 (분기 없음)
---

# Workflow

이 문서는 이 레포에서 **에이전트의 작업 진행을 통제하는 단일 워크플로우 정본**이다.

이 문서는 설계 철학이나 시스템 구조를 설명하지 않는다.

- 설계/구조의 정본: [ARCHITECTURE.md](../ARCHITECTURE.md)
- 권한/행동 제한의 정본: [AGENTS.md](../AGENTS.md)
- 본 문서는 오직 **작업 진행 순서, 승인 조건, 중단 조건**만을 정의한다.
- 템플릿 인덱스: [templates.md](templates.md)

## 적용 범위

- 단순 작업 예외를 제외한 모든 작업에 적용한다.
- 여러 파일 변경/설계 논의/아키텍처 영향/새 기능 추가를 모두 같은 흐름으로 처리한다.

## 작업 Phase 상태 머신

작업의 진행 단계(Phase)는 아래 상태 머신으로 정의된다.

각 Phase에서 생성되는 문서(Plan / Spec / ADR)는 각각 frontmatter의 `status:`를 가진다.

```text
exploration → draft → negotiation → proposed → accepted → in-progress → implemented

exploration|draft|negotiation|proposed|accepted|in-progress|implemented → canceled
```

- `canceled`: 작업 중단 또는 완료 후 롤백으로 무효화

## Plan 불변/참조 규칙 (MUST)

- Plan은 **새 작업 시작 시에만** 생성할 수 있다.
- Plan의 변경(순서/범위/변경 파일 목록 포함)이 필요해지면, **반드시 사용자 승인(키워드 `ㅇㅇ`)을 먼저** 받아야 한다.
- Plan 수정은 `in-progress`에서만 허용한다.
  - 허용 범위: Plan 본문을 덮어쓰지 않고, Plan의 "Plan Changes" 섹션에 **append-only**로 변경 사항을 추가한다.
  - 사용자가 승인하지 않으면 즉시 중단한다.
- Plan의 `status` 갱신은 상태 머신을 따른다.
- 아래 status의 Plan은 본문이 **불변(immutable)** 이다.
  - `accepted`
  - `implemented`
  - `canceled`
- 사용자의 명시적 지시(참조 대상 경로 지정) 없이는, 현재 작업 Plan이 아닌 Plan(과거 Plan)을 조회/참조/범위에 포함하면 안 된다.

## 운영 규칙

- 에이전트는 작업이 길어지는 경우(여러 파일 변경/여러 도구 실행) 각 응답의 첫 줄에 현재 phase와 대상 Plan/Spec/ADR의 경로 및 status를 1줄로 요약한다(SHOULD).
- 키워드 `ㅇㅇ`는 **승인 증거**이며, 구현 시작 가능 여부의 최종 판정은 아래 Hard Stop Gate 충족 여부로 한다(MUST).

## Phase 0: Preflight (필수 사전 점검)

- 범위가 불명확하면 질문부터 한다.
- 패키지 경계/공개 API/아키텍처 영향 여부를 먼저 식별한다.

- Preflight에서 아래 항목 중 하나라도 판정 불가하면 Phase 1로 진입하면 안 된다(MUST NOT).
  - 변경 대상 파일/패키지 식별
  - Public API/Contract 변경 여부
  - 아키텍처 영향 유무

## Phase 1: Exploration (요구사항 탐색)

1. 목적/범위/제약/우선순위를 질문한다.
2. `docs/plans/<yymmdd>_<seq>_<plan-name>.md` 존재 여부를 확인한다.
3. 없으면 Plan을 `status: draft`로 생성하고 사용자에게 검토를 요청한다.

## Phase 2: Draft (초안 수렴)

1. Plan의 Goal/Non-Goals/Scope/Milestones를 채운다.
2. 사용자 피드백을 반영한다.

### Phase 2 → Phase 3 전환 조건 (MUST)

- 사용자 명시적 피드백 또는 다음 Phase 진행 동의 없이는 Phase 3으로 이동하면 안 된다(MUST NOT).

## Phase 3: Negotiation (논의/대안 비교)

**트리거**:

- 설계 선택지가 2개 이상 존재함이 에이전트에게 인지된 경우
- 사용자 메시지에 반대/우려/재검토 요청 표현이 포함된 경우
- SSOT 변경 또는 예외 적용이 필요해질 수 있음을 **보고해야 하는 경우**

1. `docs/design/<name>.md` (ADR) 또는 합의된 위치에 ADR을 `status: draft`로 만든다.
2. Options에 대안을 정리하고 사용자 선택을 요청한다.

## Phase 4: Proposed (설계 제안)

1. Spec이 필요한 작업이면 `docs/specs/<name>.md`를 `status: draft`로 만들고 내용을 채운다.
2. 아키텍처 영향이 있으면, `ARCHITECTURE.md` 및 관련 SSOT에 **반영이 필요함을 명시하고** 사용자 승인(`ㅇㅇ`)을 전제로 갱신한다.
   - `ARCHITECTURE.md`는 사용자 승인 없이 에이전트가 자의적으로 변경할 수 없다.
3. 사용자에게 최종 승인을 요청한다.

- Phase 4에서 사용자에게 명시적으로 승인 요청을 했음을 기록하지 않았다면 Phase 5로 이동하면 안 된다(MUST NOT).

## Phase 5: Accepted (구현 가능)

### 승인 키워드 (MUST)

이 레포에서 “승인 키워드 `ㅇㅇ`”는 에이전트의 자가 판정이 아니라 **사용자 승인**을 의미한다.

- 승인 증거는 사용자가 남긴 키워드 **`ㅇㅇ`** 로 고정한다.
- 키워드가 명시되지 않았다면, Plan/Spec/ADR의 상태가 정리되어 있더라도 구현을 시작하면 안 된다(MUST NOT).
- 키워드 `ㅇㅇ`는 문서 `status: accepted`를 대체하지 않는다(MUST NOT).

### Hard Stop Gate (MUST)

아래 중 하나라도 충족하지 못하면 구현 코드를 작성하면 안 된다.

Hard Stop Gate는 다음 순서로 평가한다:

1. 사용자 승인 키워드 `ㅇㅇ`
2. Plan `status: accepted`
3. Spec `status: accepted` (해당 시)
4. ADR `status: accepted` (해당 시)
5. 아키텍처 영향이 있는 경우 `ARCHITECTURE.md` 반영 완료 (해당 시)

## Phase 6: Implementation (구현)

1. 코드를 작성한다.
2. 필요하면 테스트를 추가/수정한다.
3. `bun run verify`로 게이트를 통과시킨다.

- 구현(Execution)을 시작하는 시점에 Plan의 `status`를 `in-progress`로 전환한다.
- 구현 중 Plan 변경이 필요하면, Plan 불변/참조 규칙에 따라 사용자 승인(`ㅇㅇ`) 후 "Plan Changes"에 append-only로 기록한다.
- `bun run verify` 통과 시 Plan의 `status`를 `implemented`로 전환한다.

### verify 실패 복구 프로토콜 (MUST)

- `bun run verify`가 실패하면, 자동화/에이전트는 최대 **5회**까지만 복구 시도를 수행할 수 있다(MUST).
- 단, 복구 시도 중이라도 폭주(thrashing) 또는 정책 중단 조건이 충족되면 즉시 중단한다.
  - SSOT: [SAFEGUARDS.md](../docs/governance/SAFEGUARDS.md)
- 5회 내에 통과하지 못하면 더 이상 “추가 수정”을 진행하지 말고, 아래 템플릿으로 복구 보고를 남기고 사용자에게 판단을 요청한다(MUST).
- 복구 보고 이후에는 사용자의 선택이 있기 전까지 추가 수정/추가 실행을 수행하지 않는다(MUST).

#### 복구 보고 템플릿 (MUST)

```text
## verify 실패 복구 보고

**상태**: verify 미통과 (복구 시도 5회 소진)

**실패 요약**:
- [에러/실패 1줄 요약]

**마지막 실패 로그(핵심 발췌)**:
- [대표 에러 3~10줄]

**시도한 복구(최대 5개)**:
1) [무엇을 바꿨는지]
2) ...

**변경 영향 범위(Blast Radius)**:
- 패키지/디렉터리: [...]
- public API/contract 변경: [없음/있음(승인 필요)]

**다음 선택지**:
- 옵션 A: [범위 내에서 더 파고듦 / 추가 정보 필요]
- 옵션 B: [범위 축소/롤백]
- 옵션 C: [범위 밖 수정 승인 요청]
- 옵션 D: [변경 격리(브랜치 유지 등) 후 작업공간 정리 여부 결정]
```

## Phase 7: Implemented (완료)

### DoD (MUST)

- Plan 상태가 `implemented`인지 확인
- Spec/ADR(해당 시) 상태가 `accepted`인지 확인
- 아키텍처 영향이 있었다면 SSOT 반영 완료
- `bun run verify` 통과

## 예외: 단순 작업

다음 조건을 **모두** 만족하면 Phase 1~4를 생략할 수 있다.

- 요청이 명확하고 구체적
- 영향 범위가 단일 파일 또는 명백히 한정
- 아키텍처 영향 없음
- Public API/Contract 변경 아님

### 예외 적용 원칙 (MUST)

- 단순 작업 예외는 **에이전트 편의가 아닌 사용자 편의**를 위한 예외다.
- 판단이 애매한 경우 예외를 적용하지 않는다.

### 예외 적용 시 명시 사항 (MUST)

응답 첫 줄에 다음을 명시해야 한다:

- "Simple Task Exception applied"
- 변경 파일 경로
- 아키텍처 영향 없음에 대한 1줄 근거
