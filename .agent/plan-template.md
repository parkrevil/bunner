---
description: 단일 Run Plan 템플릿 (에이전트 실행 입력)
---

# Run Plan

> 이 문서는 에이전트가 작업을 시작하기 전에 반드시 채워야 하는 **실행 입력 템플릿**이다.
>
> - 본 문서는 **입력 양식**만을 정의한다.
> - 모든 규칙·판정·승인·중단의 정본은 아래 문서를 따른다.
>   - 정본(문서 지도): [docs/00_INDEX.md](../../docs/00_INDEX.md)
>   - 권한/행동 제한: [AGENTS.md](../../AGENTS.md)
>   - 프로세스: [workflow.md](workflow.md)

## 작성 가이드

- 저장 위치: `plans/<yymmdd>_<seq>_<plan-name>.md`
- 상태(status): [workflow.md](workflow.md)의 상태 머신을 따른다.
- 승인/중단/전이 규칙: [workflow.md](workflow.md)를 따른다.

### Mechanical Filling Rules (기계 판정, MUST)

이 템플릿으로 작성된 `plans/**.md`는 아래 규칙을 만족해야 한다.
규칙은 “사람이 읽기 좋게”가 아니라 “도구가 실패/통과를 판정”하기 위한 것이다.

- Status 기반 판정:
  - `status: draft | negotiation | proposed`:
    - placeholder / 체크박스 미완료가 존재해도 허용한다.
  - `status: accepted | in-progress | implemented`:
    - 문서 어디에도 `{{...}}` placeholder가 남아있으면 실패한다.
    - 문서 어디에도 `- [ ]` 형태의 미체크 체크박스가 남아있으면 실패한다.
    - `Open Questions`는 `none`이어야 한다.
  - `status: canceled`:
    - 취소는 “완결된 구현 산출물”이 아닐 수 있으므로,
      placeholder / 미체크 체크박스 / Open Questions에 대해 `draft`와 동일 규칙을 적용한다.

- Spec → Plan 연결(형식, MUST):
  - Primary/Secondary SPEC 좌표는 반드시 `docs/30_SPEC/.../*.spec.md#...` 또는 `docs/30_SPEC/SPEC.md#...` 형태여야 한다.

- Plan → Step → Evidence 연결(형식, MUST):
  - `SPEC MUST SNAPSHOT`의 MUST ID 목록과 `검증 매트릭스`의 MUST ID 목록은 1:1로 일치해야 한다.
  - 각 Step은 “충족되는 MUST IDs”와 “File → MUST IDs 매핑”을 포함해야 한다.

  - Note:
    - “File → MUST IDs 매핑”은 아래 `Plan → Task → Code 연결`의 MUST tagging 규칙으로 검증 가능한 형태로 유지한다.

- Plan → Task → Code 연결(형식, MUST):
  - Code 변경의 정의(기계 판정, MUST):
    - Code 변경은 확장자 기준으로 판정한다: `.ts`, `.js`, `.mjs`, `.cjs`
  - Code 변경이 존재하면, 최소 1개 이상의 `tasks/**.md`가 함께 변경되어야 한다.
  - Task는 반드시 `plans/<...>.md#Step-N` 링크를 포함해야 한다.
  - Task는 반드시 `Allowed paths` 목록을 포함해야 한다.
  - Task(Status=done)에서 다루는 MUST IDs는 실제 변경 파일 안에 `MUST:` 태그로 존재해야 한다.

### Plan → Task 분해 규칙 (필수)

> Plan은 "무엇을 만족해야 하는가"를 고정하고,
> Task는 "어떻게 실행할 것인가"를 기계적으로 수행한다.
>
> - Plan은 설계/판정 문서다.
> - Task는 실행 체크리스트 문서다.
> - Task에서 설계 결정이 필요해지면 즉시 STOP 후 Plan으로 되돌린다.

- Task 템플릿: [task-template.md](task-template.md)
- 권장 저장 위치: `tasks/<yymmdd>_<seq>_<task-name>.md`
- 원칙:
  - 각 Step은 1개 이상의 Task로 분해된다.
  - Task는 반드시 어떤 Step에 바인딩되어야 한다(Plan ID + Step N).
  - Task는 Spec Binding을 "대체"하지 않고, Plan의 Spec Satisfaction을 "실행"한다.
  - Task는 SSOT(docs/10..50/\*\*) 변경을 포함하지 않는다.
  - Task에는 Spec 좌표/설계 판단을 작성할 수 없다.
  - Task는 새로운 MUST ID를 생성/재번호 매길 수 없다.
    - 단, Plan(§4 Snapshot)에서 이미 발급된 MUST ID 및 Plan(§10)에서 발급된 Evidence ID(MUST-EVID-\*)를 "참조"하는 것은 허용한다.

### 필수 헤더 (Plan 파일)

Plan 파일은 frontmatter에 최소한 아래 필드를 포함해야 한다.

```yaml
---
status: draft
allowed_paths:
  - packages/<name>/**
  - tooling/<name>/**
---
```

> `status` 값은 [workflow.md](workflow.md)의 상태 머신을 따른다.

---

## 0) Metadata (필수)

> 이 섹션은 계획의 **식별/추적/게이트 판정**을 위한 메타데이터다.
> 모호하면 Plan을 진행하지 말고, 이 섹션부터 먼저 채운다.

- Plan ID: `{yymmdd}_{seq}_{plan-name}`
- Created at (UTC): `{YYYY-MM-DD}`
- Owner: `{user | team}`
- Related: `{issue/pr/link | none}`
- Target branch: `{main | ...}`
- Tooling constraints (선택): `{bun version / node version / none}`

---

## 1) 원문(사용자 입력) (필수)

- 원문:
  - "<사용자가 최초로 입력한 문장 그대로>"

- 사용자 입력을 구조화(해석 금지):
  - Change target:
  - Success condition:
  - Explicit constraints:

- SSOT 충돌 여부:
  - [ ] 없음
  - [ ] 있음 → [workflow.md](workflow.md)의 중단/논의 절차로 이관

---

## 2) Spec Binding (필수)

> Plan은 "무엇을 구현해야 하는가"를 **Spec**에 바인딩한다.
> Plan의 모든 결정/범위/AC/Step은 이 바인딩을 근거로 한다.
>
> 금지:
>
> - Spec 요약/의역/재해석
> - Plan에서 새로운 설계(=Spec에 없는 설계) 생성

이 Plan이 구현하려는 SPEC:

- Primary SPEC:
  - `docs/30_SPEC/.../xxx.spec.md#section`

- Secondary SPEC (참조):
  - `docs/30_SPEC/.../yyy.spec.md#section`

이 Plan에서의 SPEC 변경:

- [ ] 없음(게이트)

> SPEC 변경이 필요하면 이 Plan으로 진행하지 않는다.
> 즉시 STOP 후 "SPEC 변경 전용 Plan"을 별도로 생성하고 Phase 3(negotiation)로 되돌린다.

- [ ] Section Gate: 이 섹션은 위 규칙을 모두 만족한다.

---

## 3) Open Questions (STOP 후보)

> 규칙(필수): Open Questions가 1개라도 존재하면 Step 시작 금지.
> 진행이 필요하면, 먼저 Q를 해소하거나 STOP 조건에 의해 Phase 3으로 되돌린다.

- Step Start Gate:
  - [ ] Open Questions가 비어 있음

- none | {질문 목록}

- Q1: {결정되지 않으면 진행 불가한 질문}
- Q2: {...}

---

## 4) SPEC MUST SNAPSHOT (필수, 원문 복사)

> 이 섹션은 Plan이 만족해야 하는 MUST의 **원문 스냅샷**이다.
>
> 규칙:
>
> - 반드시 원문 그대로 복사한다(요약/의역/번역 금지).
> - MUST ID는 이 Plan 내부에서만 쓰는 참조 키다.
> - Quote 편집 금지 (공백/줄바꿈 포함)
> - MUST 원문이 애매하거나 충돌하면, 해석하지 말고 `Open Questions`로 올리고 STOP 조건을 건다.
>
> MUST ID 발급/유지 규칙 (필수):
>
> - MUST ID는 이 Snapshot 섹션에서만 생성한다.
> - Snapshot 밖(다른 섹션/Step/Task)에서는 MUST ID를 새로 만들거나 재번호 매기면 안 된다.
> - MUST를 중간에 추가해야 하면 `MUST-2a`, `MUST-2b`처럼 접미사만 허용한다.
> - MUST를 제거해야 하는 경우에도 ID를 삭제하지 않는다(해당 MUST는 `REMOVED`로 표기하고 ID 유지).

이 Plan이 만족해야 하는 SPEC MUST 원문 목록:

### Snapshot Metadata (권장)

- Captured at (UTC): {YYYY-MM-DD}
- Captured by: {user | agent}
- SPEC revision:
  - none | {git commit hash | tag | ref}

- MUST-1:
  - Source: `docs/30_SPEC/.../xxx.spec.md#must-...`
  - Quote:

    ```text
    {원문 그대로}
    ```

- MUST-2:
  - Source: `docs/30_SPEC/.../xxx.spec.md#must-...`
  - Quote:

    ```text
    {원문 그대로}
    ```

  - [ ] Section Gate: 이 섹션은 위 규칙을 모두 만족한다.

---

## 5) 목적 / 기대효과 (필수)

- One-liner goal: {한 줄}
- 기대효과:
  - {기대효과 1}
  - {기대효과 N}
- Success definition(간단): {"무엇이 되면 성공" 1~2줄}

---

## 6) 범위(Scope) / 비범위(Non-Goals) (필수)

### Scope

### Spec Scope (필수)

> Spec Scope는 "검증 범위 확장"만 선언한다.
>
> 규칙:
>
> - `Spec Binding`의 Primary/Secondary를 반복 기재하지 않는다.
> - 여기에 들어간 좌표는 "추가로 읽어야 하는 Spec"일 뿐, 구현 대상 선언을 대체하지 않는다.

- Additional SPEC for verification (optional):
  - `docs/30_SPEC/.../error-handling.spec.md#section`
  - `docs/30_SPEC/.../diagnostics.spec.md#section`

### Code Scope

- 변경 대상 (예상/참고: Gate 아님):
  - path/to/file

- Allowed paths (MUST, SSOT):
  - frontmatter의 `allowed_paths`를 그대로 복사한다.
  - 예:
    - packages/<name>/\*\*
    - tooling/<name>/\*\*

- 변경 유형:
  - [ ] 생성
  - [ ] 수정
  - [ ] 삭제
  - [ ] 이동/병합

- 영향/허용 게이트 (체크, 추정/단정 금지):
  - 영향 가능 패키지/모듈: {나열 | none}
  - Public Facade 변경:
    - [ ] 없음(게이트)
    - [ ] 있음 → Approval Ledger 필요
  - deps 변경:
    - [ ] 없음(게이트)
    - [ ] 있음 → Approval Ledger 필요
  - 런타임 동작 변경(사용자 관점):
    - [ ] 금지(게이트)
    - [ ] 허용 → 변경점/영향을 Task에 명시
  - 설정/CLI 인터페이스 변경:
    - [ ] 금지(게이트)
    - [ ] 허용 → 변경점/호환성/마이그레이션을 Task에 명시
  - 마이그레이션 필요:
    - [ ] 금지(게이트)
    - [ ] 허용 → 마이그레이션 절차/체크리스트를 Task에 명시

### 승인 원장 (Approval Ledger, Gate)

> 승인 아티팩트가 필요한 변경이 포함되는 경우에만 사용한다.
> 승인 없이는 해당 항목을 실행 계획에 넣지 않는다.

- Need approval?: yes | no

#### Approval Requests (작성 후 STOP)

- Request #1:
  - 유형: {SSOT 변경 | Public Facade 변경 | deps 변경 | Scope Override}
  - 현재 상황(1~2줄):
  - 요청 범위(파일/패키지):
  - 대안: none | {대안 목록}
  - 리스크(영향 범위):

#### Approvals (승인 받은 뒤에만 채움)

- Approval #1:
  - 승인 증거: `<Y | OK | 승인 | 진행해 | ㅇㅇ | PR Approved 링크>`
  - 승인 범위: {파일/패키지/기능}
  - 일시: {YYYY-MM-DD}

### Non-Goals

- {이번 작업에서 의도적으로 하지 않는 것}

- [ ] Section Gate: 이 섹션은 위 규칙을 모두 만족한다.

---

## 7) 제약 / 운영 노트 (Gate, 필수)

> 여기서 정한 불변조건은 이후 Step에서 깨지면 **즉시 STOP**이다.

### Hard Constraints (승인 없이는 절대 수행 금지)

- [ ] SSOT(docs/10..50/\*\*) 의미 변경 없음 (필요해지면 승인 요청 후 STOP)
- [ ] Public Facade(packages/\*/index.ts export) 변경 없음 (필요해지면 승인 요청 후 STOP)
- [ ] deps(package.json deps) 변경 없음 (필요해지면 승인 요청 후 STOP)

### Operational Notes (Spec 외부 주의점)

> 이번 Plan에서 추가로 주의해야 할 검증/운용 포인트를 기록한다.
> (Spec MUST/Acceptance Criteria를 대체하지 않는다)

- NOTE-1: {주의점 1}
- NOTE-2: {주의점 N}

### Stop Conditions (불확실성/충돌)

> Stop condition은 반드시 아래 3필드를 가진다:
>
> - Trigger: (무슨 조건에서)
> - Action: STOP
> - Escalation target: (Open Questions의 Qn)

- STOP-1: Trigger={문서 충돌/판정 불가}, Action=STOP, Escalation=Q1
- STOP-2: Trigger={범위 확장 필요}, Action=STOP, Escalation=Q2

#### MUST-Linked STOP (권장)

- STOP-SPEC-AMB-1: Trigger=MUST-2 해석 불가, Action=STOP, Escalation=Q1
- STOP-SPEC-CONFLICT-1: Trigger=MUST-3 ↔ MUST-4 충돌, Action=STOP, Escalation=Q2

---

## 8) 요구사항 / 수용 기준 (Acceptance Criteria, 필수)

> 전부 **검증 가능**한 문장으로 작성한다.

### Spec Compliance (필수)

- AC-SPEC-1: 구현이 `SPEC MUST SNAPSHOT`의 모든 MUST를 만족한다.
- AC-SPEC-2: `SPEC MUST SNAPSHOT`과 모순되는 구현이 없다.

### Functional

- AC1: {Given/When/Then 또는 boolean 형태}
- AC2: {...}

### Error/Edge

- AC-E1: {...}

### Compatibility

- AC-C1: {예: 기존 옵션/동작 유지}

### Observability (로그/진단/에러 메시지)

- AC-O1: {...}

- [ ] Section Gate: 이 섹션은 위 규칙을 모두 만족한다.

---

## 9) 실행 계획 (Step Gates, 필수)

> 주의: 이 Plan은 설계/선택지 결정을 기록하지 않는다.
> 결정이 필요해지면, Step의 Stop conditions에 STOP을 명시하고 `workflow.md`의 Phase 3(negotiation)로 되돌린다.

> 각 Step은 **작고 닫혀있어야** 하며, 다음 Step으로 넘어가기 위한 Gate를 명시한다.
> Step마다 “무엇을 바꾸고 / 어떻게 검증하고 / 실패하면 어떻게 롤백하는지”가 있어야 한다.

<a id="Step-1"></a>

### Step 1) {단계명}

- Objective:
  - {이 Step이 끝나면 무엇이 달라지는가}
- Inputs:
  - {의존하는 기존 동작/규칙/데이터}
- Outputs:
  - {생성/수정되는 산출물}
- Change set (예상):
  - Files:
    - path/to/file
- Spec Satisfaction (필수):
  - Covered SPEC coordinates (좌표만):
    - `docs/30_SPEC/.../xxx.spec.md#must-...`
  - 충족되는 MUST IDs (요약/의역 금지):
    - MUST-1
    - MUST-2

- File → MUST IDs 매핑 (요약/정당화 금지):
  - path/to/file: MUST-1, MUST-2

- Step ↔ File ↔ MUST Gate (필수):
  - [ ] 이 Step의 Files는 frontmatter `allowed_paths` 범위 안에 있다.
  - [ ] 이 Step의 MUST IDs는, 이 Step의 "File → MUST IDs 매핑"에 포함된 MUST IDs를 모두 포함한다.
  - [ ] 위 조건을 만족하지 못하면 STOP + Open Questions로 승격
- Tasks (필수):
  - 이 Step을 수행하기 위한 Task 목록:
    - `tasks/{yymmdd}_{seq}_{task-name}.md`: {무엇을 실행하는 Task인지}
  - Step→Task Gate:
    - [ ] 위 Task 파일이 모두 생성됨
  - Implementation notes:
    - (금지) Plan에는 설계를 쓰지 않는다. 실행 상세는 각 Task에만 적는다.
- Verification (Gate):
  - Command(s): {예: bun run tsc | bun run test -t ... | bun run verify}
  - Expected result: {무엇이 통과여야 하는가}

- Drift/Plan Change Log Gate (Verification 직후, 다음 Step 진행 전 필수):
  - [ ] Spec Drift 징후가 있었는가?
    - [ ] 없음
    - [ ] 있음 → §13에 append 하지 않으면 다음 Step 진행 금지
  - [ ] Plan 변경이 있었는가?
    - [ ] 없음
    - [ ] 있음 → §14에 append 하지 않으면 다음 Step 진행 금지
- Spec Drift Check (Step 후 필수):
  - 이번 Step에서 SPEC을 암묵적으로 바꿨는가?
    - [ ] 아니다
    - [ ] 그렇다 → STOP 후 "SPEC 변경 전용 Plan" 분기 + (docs/10..50/\*\* 변경이면) 승인 아티팩트 필요
- Stop conditions (ID 참조만, 새로 작성 금지):
  - STOP-1
  - STOP-2
- Rollback:
  - {되돌리는 방법}

<a id="Step-2"></a>

### Step 2) {단계명}

- (Step 1과 동일 포맷)

- [ ] Section Gate: 이 섹션은 위 규칙을 모두 만족한다.

---

## 10) 검증 매트릭스 (MUST → Evidence, 필수)

> 규칙(필수): 모든 MUST-\*는 Evidence와 1:1로 연결되어야 한다.

| MUST ID | Evidence ID | Evidence (test/log/snapshot) | Step | Notes |
| ------- | ----------- | ---------------------------- | ---- | ----- |
| MUST-1  | MUST-EVID-1 | <무엇으로 확인?>             | N    | <...> |
| MUST-2  | MUST-EVID-2 | <...>                        | N    | <...> |

- [ ] Section Gate: 이 섹션은 위 규칙을 모두 만족한다.

---

## 11) 리스크 / 롤백 (필수)

- 리스크:
  - {...}
  - 탐지 방법(증상/메트릭/로그): {...}
  - 완화책: {...}

- 롤백:
  - {방법}

- 실패 시 의사결정:
  - verify 실패: [docs/50_GOVERNANCE/SAFEGUARDS.md](../../docs/50_GOVERNANCE/SAFEGUARDS.md)
  - 반복 시도 한도/중단 조건: {예: 3회 실패 시 STOP}

---

## 12) 검증 / 완료 조건 (필수)

- [ ] `bun run verify` 통과
- [ ] Acceptance Criteria 전부 Evidence로 연결됨
- [ ] 모든 MUST-\*가 Evidence와 1:1로 연결됨(§10)
- [ ] Open Questions가 비어 있음(§3)
- [ ] [workflow.md](workflow.md) 절차 준수

---

## 13) Spec Drift Log (append-only)

> 드리프트(암묵적 Spec 변경) 징후를 발견했을 때 기록한다.
> Spec을 실제로 바꾸는 행위는 승인 게이트에 의해 차단될 수 있다.

- Drift #1:
  - Date (UTC): {YYYY-MM-DD}
  - Trigger step: {Step N}
  - Summary: {무엇이 Spec Drift로 판단되었는지}
  - Action: STOP | {Plan 분기} | {승인 요청}
  - Approval evidence: `{Y | OK | 승인 | 진행해 | ㅇㅇ | PR Approved 링크 | none}`
  - Scope impact: {docs/30_SPEC/... | packages/... | ...}

- [ ] Section Gate: 이 섹션은 위 규칙을 모두 만족한다.

---

## 14) Plan Changes (append-only)

> `in-progress` 상태에서만 기록한다.
> 본문 수정 금지. 변경이 필요하면 여기로만 append 한다.

- Change #1:
  - Date (UTC): {YYYY-MM-DD}
  - Summary: {무엇이 왜 바뀌었는지 1~3줄}
  - Trigger: {verify 실패 | 요구사항 변경 | 버그 발견 | 리스크 현실화 | ...}
  - Approval evidence: `<Y | OK | 승인 | 진행해 | ㅇㅇ | PR Approved 링크>`
  - Scope impact: {파일/패키지/기능}
  - Updated gates: {추가/변경된 검증}

- [ ] Section Gate: 이 섹션은 위 규칙을 모두 만족한다.
