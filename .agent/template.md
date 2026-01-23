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

### 필수 헤더 (Plan 파일)

Plan 파일은 frontmatter에 최소한 아래 필드를 포함해야 한다.

```yaml
---
status: draft
---
```

> `status` 값은 [workflow.md](workflow.md)의 상태 머신을 따른다.

---

## 0) Metadata (필수)

> 이 섹션은 계획의 **식별/추적/게이트 판정**을 위한 메타데이터다.
> 모호하면 Plan을 진행하지 말고, 이 섹션부터 먼저 채운다.

- Plan ID: `<yymmdd>_<seq>_<plan-name>`
- Created at (UTC): `<YYYY-MM-DD>`
- Owner: `<user | team>`
- Related: `<issue/pr/link | none>`
- Target branch: `<main | ...>`
- Tooling constraints (선택): `<bun version / node version / none>`

---

## 0) Persona / Handshake (필수)

- Persona:
  - `@Architect` | `@Implementer` | `@Reviewer`

- Handshake (AGENTS.md 형식 그대로):
  - "<여기에 AGENTS.md의 Handshake 문구를 그대로 붙여넣는다>"

---

## 0) 원문(사용자 입력) (필수)

- 원문:
  - "<사용자가 최초로 입력한 문장 그대로>"

- 에이전트 해석(검증 가능하게):
  - 무엇을 변경하는가
  - 성공 조건은 무엇인가
  - 명시적 제약은 무엇인가

- SSOT 충돌 여부:
  - [ ] 없음
  - [ ] 있음 → [workflow.md](workflow.md)의 중단/논의 절차로 이관

---

## 1) 목적 / 기대효과 (필수)

- One-liner goal: <한 줄>
- 기대효과:
  - <기대효과 1>
  - <기대효과 N>
- Success definition(간단): <"무엇이 되면 성공" 1~2줄>

---

## 2) 범위(Scope) / 비범위(Non-Goals) (필수)

### Scope

- 변경 대상과 이유:
  - path/to/file: <이유>

- 변경 유형:
  - [ ] 생성
  - [ ] 수정
  - [ ] 삭제
  - [ ] 이동/병합

- 영향 범위 선언(사실 기술):
  - 영향 가능 패키지/모듈: <나열>
  - Public Facade 변경: 없음 | 있음
  - 패키지 의존 변경: 없음 | 있음
  - 런타임 동작 변경(사용자 관점): 없음 | 있음
  - 설정/CLI 인터페이스 변경: 없음 | 있음
  - 마이그레이션 필요: 없음 | 있음

### Non-Goals

- <이번 작업에서 의도적으로 하지 않는 것>

---

## 3) 불변조건 / 제약 (Gate, 필수)

> 여기서 정한 불변조건은 이후 Step에서 깨지면 **즉시 STOP**이다.

### Hard Constraints (승인 없이는 절대 수행 금지)

- [ ] SSOT(docs/10..50/**) 의미 변경 없음 (필요해지면 승인 요청 후 STOP)
- [ ] Public Facade(packages/*/index.ts export) 변경 없음 (필요해지면 승인 요청 후 STOP)
- [ ] deps(package.json deps) 변경 없음 (필요해지면 승인 요청 후 STOP)

### Invariants (이번 작업 불변식)

- API/계약(spec) 불변식:
  - <불변식 1>
  - <불변식 N>
- 동작/에러/로그 불변식:
  - <불변식 1>
  - <불변식 N>
- 성능/복잡도/비기능 불변식(해당 시):
  - <불변식 1>

### Stop Conditions (불확실성/충돌)

- 문서 충돌/판정 불가 발견 시: <어디서 멈추고 무엇을 질문할지>
- 범위 확장 필요 시: <승인 토큰 요청 후 STOP>

---

## 4) SSOT 확인 기록 (필수)

> 아래 항목은 **판정이 아니라 확인 기록**이다.
> 각 항목에 대해 참조한 문서/섹션만 기재한다.

- SPEC: <문서/섹션>
- ARCHITECTURE: <문서/섹션>
- STRUCTURE: <문서/섹션>
- STYLEGUIDE: <문서/섹션>

---

## 5) 요구사항 / 수용 기준 (Acceptance Criteria, 필수)

> 전부 **검증 가능**한 문장으로 작성한다.

### Functional

- AC1: <Given/When/Then 또는 boolean 형태>
- AC2: <...>

### Error/Edge

- AC-E1: <...>

### Compatibility

- AC-C1: <예: 기존 옵션/동작 유지>

### Observability (로그/진단/에러 메시지)

- AC-O1: <...>

---

## 6) 작업 설계(선택지/결정) (필수)

- 선택지:
  - 요약: <...>
  - 리스크: <...>

- 최종 결정:
  - <선택>
  - 근거(참조 문서): <...>

---

## 7) 승인 원장 (Approval Ledger, Gate)

> 승인 아티팩트가 필요한 변경이 포함되는 경우에만 사용한다.
> 승인 없이는 해당 항목을 실행 계획에 넣지 않는다.

- Need approval?: yes | no

### Approval Requests (작성 후 STOP)

- Request #1:
  - 유형: <SSOT 변경 | Public Facade 변경 | deps 변경 | Scope Override>
  - 현재 상황(1~2줄):
  - 요청 범위(파일/패키지):
  - 대안: none | <대안 목록>
  - 리스크(영향 범위):

### Approvals (승인 받은 뒤에만 채움)

- Approval #1:
  - 승인 증거: `<Y | OK | 승인 | 진행해 | ㅇㅇ | PR Approved 링크>`
  - 승인 범위: <파일/패키지/기능>
  - 일시: <YYYY-MM-DD>

---

## 8) 실행 계획 (Step Gates, 필수)

> 각 Step은 **작고 닫혀있어야** 하며, 다음 Step으로 넘어가기 위한 Gate를 명시한다.
> Step마다 “무엇을 바꾸고 / 어떻게 검증하고 / 실패하면 어떻게 롤백하는지”가 있어야 한다.

### Step 1) <단계명>

- Objective:
  - <이 Step이 끝나면 무엇이 달라지는가>
- Inputs:
  - <의존하는 기존 동작/규칙/데이터>
- Outputs:
  - <생성/수정되는 산출물>
- Change set (예상):
  - Files:
    - path/to/file: 생성|수정|삭제|이동, 요약 1줄
- Implementation notes (필요한 만큼 과하게):
  - <세부 설계/알고리즘/흐름>
- Verification (Gate):
  - Command(s): <예: bun run tsc | bun run test -t ... | bun run verify>
  - Expected result: <무엇이 통과여야 하는가>
- Stop conditions:
  - <불확실성/스코프 증가/문서 충돌 등>
- Rollback:
  - <되돌리는 방법>

### Step 2) <단계명>

- (Step 1과 동일 포맷)

---

## 9) 검증 매트릭스 (Requirement → Evidence)

| Acceptance Criteria | Evidence (test/log/snapshot) | Step | Notes |
| --- | --- | --- | --- |
| AC1 | <무엇으로 확인?> | Step N | <...> |
| AC2 | <...> | Step N | <...> |

---

## 10) 리스크 / 롤백 (필수)

- 리스크:
  - <...>
  - 탐지 방법(증상/메트릭/로그): <...>
  - 완화책: <...>

- 롤백:
  - <방법>

- 실패 시 의사결정:
  - verify 실패: [docs/50_GOVERNANCE/SAFEGUARDS.md](../../docs/50_GOVERNANCE/SAFEGUARDS.md)
  - 반복 시도 한도/중단 조건: <예: 3회 실패 시 STOP>

---

## 11) 검증 / 완료 조건 (필수)

- [ ] `bun run verify` 통과
- [ ] Acceptance Criteria 전부 Evidence로 연결됨
- [ ] Invariants 유지 확인
- [ ] [workflow.md](workflow.md) 절차 준수

---

## 12) Open Questions (STOP 후보)

- Q1: <결정되지 않으면 진행 불가한 질문>
- Q2: <...>

---

## Plan Changes (append-only)

> `in-progress` 상태에서만 기록한다.
> 본문 수정 금지. 변경이 필요하면 여기로만 append 한다.

- Change #1:
  - Date (UTC): <YYYY-MM-DD>
  - Summary: <무엇이 왜 바뀌었는지 1~3줄>
  - Trigger: <verify 실패 | 요구사항 변경 | 버그 발견 | 리스크 현실화 | ...>
  - Approval evidence: `<Y | OK | 승인 | 진행해 | ㅇㅇ | PR Approved 링크>`
  - Scope impact: <파일/패키지/기능>
  - Updated gates: <추가/변경된 검증>
