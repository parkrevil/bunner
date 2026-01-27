---
description: Task 템플릿 (Plan → 실행 단위)
---

# Task

> 이 문서는 Plan의 Step을 **실행 가능한 작업 단위(Task)**로 쪼갠 템플릿이다.
>
> 이 템플릿의 목표는 “읽는 사람(또는 CI/리뷰어)이 추론 없이도” 아래를 판정할 수 있게 만드는 것이다:
>
> - 이 Task가 **Plan의 어떤 Step을** 실행하는지
> - 이 Task가 **허용된 범위 안에서만** 움직였는지
> - 이 Task가 **검증 게이트를 통과했는지**
> - 이 Task가 **Spec Drift를 유발했는지**
>
> Hard rule (MUST):
>
> - Task는 **새로운 설계 결정을 만들지 않는다.** 결정이 필요하면 STOP 후 Plan으로 되돌린다.
> - Task는 **Spec 좌표/설계 판단을 작성하지 않는다.** (Plan만이 이를 보유한다.)
> - Task는 **새로운 MUST ID를 생성/재번호**하지 않는다.
>   - 단, Plan(§4 Snapshot)의 MUST ID와 Plan(§10)의 Evidence ID(MUST-EVID-\*)를 **참조**하는 것은 허용한다.
> - Task는 **Spec/SSOT를 변경하지 않는다.** 변경이 필요하면 승인 게이트에 따라 별도 Plan으로 전환한다.
>
> 참고 링크:
>
> - 정본(문서 지도): [docs/00_INDEX.md](../../docs/00_INDEX.md)
> - 프로세스: [workflow.md](workflow.md)
> - 입력(Plan 템플릿): [plan-template.md](plan-template.md)

---

## A) Mechanical Status (필수)

- Status: `<draft | blocked | in-progress | done>`
- Blocked reason (status=blocked): `<한 줄로>`
- Review mode: `<self-review | peer-review | both>`

Filling rules (MUST):

- 이 문서 어디에도 아래 placeholder가 남아있으면 `Status=done` 금지.
  - `{{...}}`
  - `<...>`
  - `<... | ...>`
  - 예외: 아래 “`<none>` 허용 필드”에 한해서만 `<none>` 사용 가능.
- `<none>` 허용 필드(그 외 사용 시 `Status=done` 금지):
  - `Reviewer`
  - `PR`
  - `Tooling constraints`
  - `Approval token used`
  - `Approval evidence link`
  - `Node (if used)`
  - `Baseline skip reason`
- 체크박스가 “Gate” 성격이면 빈 채로 두지 않는다.
  - [ ] 를 유지한 채 제출 금지. 반드시 [x] 또는 이유를 함께 기입(아래 예시).

체크박스 기입 예시:

- [x] pass
- [ ] (skip) not applicable because: <한 줄 근거>

STOP 조건 (MUST):

- Status가 `done`인데, 아래 “Verification Gate” 또는 “Evidence” 또는 “Completion Criteria”가 비어있으면 STOP.
- 이 Task 안에서 설계 결정을 해야 한다고 느껴지면 STOP 후 Plan으로 회귀.

MUST tagging (Status=done, MUST):

- 이 Task에서 다루는 모든 MUST ID는 실제 변경 파일 내부에 `MUST:` 태그로 존재해야 한다.
  - 예: `// MUST: MUST-1`
- 테스트/스냅샷/로그 Evidence에도 MUST ID를 포함하는 것을 권장한다.

## 0) Metadata (필수)

- Task ID: `<yymmdd>_<seq>_<task-name>`
- Created at (UTC): `<YYYY-MM-DD>`
- Updated at (UTC): `<YYYY-MM-DD>`
- Owner: `<user | team>`
- Reviewer: `<user | team | none>`
- Target branch: `<main | ...>`
- PR: `<url | none>`
- Related Plan:
  - Plan ID: `<yymmdd>_<seq>_<plan-name>`
  - Link: `plans/{{...}}.md#Step-N`
- Plan Step:
  - Step name: `<...>`
  - Step gate: `<통과해야 하는 Gate>`
- Tooling constraints (선택): `<bun version / node version / none>`

Metadata invariants (MUST):

- Task ID는 파일명과 동일해야 한다.
- Task 파일 경로는 반드시 `tasks/<plan-id>/<task-id>.md` 형태여야 한다.
- 날짜는 UTC 기준 `YYYY-MM-DD` 고정.
- PR이 존재하면 URL을 반드시 포함한다.

---

## 0.1) Decision / Approval Ledger (필수)

- Approval token used (if any): `<none | Y | OK | 승인 | 진행해 | ㅇㅇ>`
- Approval evidence link (if any): `<PR approval link | chat message permalink | none>`

Mechanical note:

- 승인 토큰이 필요한 변경이 아닌데 `Approval token used`를 채우는 것은 허용(정보용)하되,
  `Approval evidence link`가 `none`이면 토큰 값도 `none`이어야 한다.

STOP 조건 (MUST):

- 아래 “Hard Constraints (Gate)”에서 **승인이 필요한 변경**이 감지되면, 승인 증거가 없을 때 STOP.

---

## 1) Task Binding (필수)

### Plan Binding

- 이 Task의 근거 Plan:
  - `plans/<...>.md`
- 이 Task가 수행하는 Plan Step:
  - `Step N: <...>`

Mechanical check (MUST):

- Plan 링크는 반드시 `plans/{{...}}.md#Step-N` 형태로 구체 링크를 포함해야 한다.
  - Plan의 Step에는 `Step-N` 고정 앵커가 존재해야 한다.

---

## 1.1) Plan ↔ Task Traceability (Gate, 필수)

이 섹션은 “Plan → Task → Evidence → Plan 검증 매트릭스(§10)”의 폐회로를 만들기 위한 연결 고리다.
단, Task가 Plan의 완전성을 ‘감사’하지 않도록, 이 Task 안에 **Plan 발췌(원문 복사)**를 포함한다.

### Plan Extract (원문 복사, 필수)

- Plan §4 Snapshot에서 이 Task가 다루는 MUST 원문 블록을 그대로 복사:

```text
MUST-1:
<Plan의 원문 블록 그대로>
```

- Plan §10(검증 매트릭스)에서 해당 MUST에 대응하는 행을 그대로 복사:

| MUST ID | Evidence ID | Step   |
| ------- | ----------- | ------ |
| MUST-1  | MUST-EVID-1 | Step N |

### Plan Code Scope Cross-check (Gate, 필수)

Doc-verify compatibility note (do not use this as a task heading):

- Required snippet string for `.agent/task-template.md` checks: `### Plan Code Scope Cross-check (참고, Non-gate)`

- Plan 링크(`plans/{{...}}.md#Step-N`)의 유효성 확인은 필수이며, 이 섹션 헤딩은 `plan-task-verify`의 기계 게이트에 사용된다.
- 실제 범위 판정은 아래 `## 2) Scope`의 `Allowed paths (MUST, copy from Plan)`와 Plan Step의 `File → MUST IDs` 매핑 정합으로 한다.

### Claimed IDs (참조만)

- MUST IDs covered by this Task (필수):
  - MUST-1
- Evidence IDs produced by this Task (필수):
  - MUST-EVID-1

MUST ↔ Evidence Gate (필수):

- [ ] 위 MUST IDs와 Evidence IDs가 1:1로 대응된다(위 Plan Extract 표 기준).
- [ ] 이 Task §6 Evidence에 각 Evidence ID별로 정확히 1개의 증거가 존재한다.

STOP 조건 (MUST):

- MUST ↔ Evidence 1:1을 만들 수 없으면 STOP.

STOP 후 회귀 패킷(Plan에 기록할 내용, 복붙용):

```text
Task blocked: MUST↔Evidence 1:1 불가
- Task: tasks/<...>.md
- Missing mapping: <예: MUST-2 → (no Evidence ID)>
- Required Plan change: Plan §10 검증 매트릭스 정렬
```

---

## 2) Scope (필수)

### Code Scope

- Packages/Areas:
  - `<packages/<name> | examples | tooling | ...>`
- Files to change (expected):
  - `path/to/file`
- Files to read (required to understand change):
  - `path/to/file`
- Allowed paths (MUST, copy from Plan):
  - `packages/<name>/**`
  - `tooling/<name>/**`

- File → MUST IDs 매핑 (MUST, copy from Plan Step):
  - 이 Task가 변경하는 파일에 대해, Plan Step의 “File → MUST IDs 매핑” 중 해당 파일 행을 그대로 복사한다.
  - 형식:
    - `path/to/file: MUST-1, MUST-2`
- Public API impact:
  - `<none | internal-only | public-facade-risk>`

### Directory Plan (필수)

- `none`
- 또는 아래 형식 중 하나 이상(기계 판정용):
  - `create: path/to/dir/` (디렉토리 생성)
  - `remove: path/to/dir/` (디렉토리 제거)
  - `move: path/from/ -> path/to/` (이동)
  - `rename: path/from/ -> path/to/` (리네임)

### File Relations (필수)

관계는 “추론 없이” 판정 가능해야 한다.

- 형식(기계 판정용):
  - `` `path/to/a` -> `path/to/b`: <import | call | type-ref | runtime-dep | test> ``
- 규칙(MUST):
  - `Files to change (expected)`에 2개 이상 파일이 있으면, 위 형식의 관계 라인이 최소 1개 이상 존재해야 한다.
  - 관계 라인의 좌/우 경로는 반드시 백틱(`)으로 감싼다.

Scope delta rule (MUST):

- 실제 변경 파일(6절 Diff evidence)이 2절 expected와 다르면, 아래를 반드시 채운다.
  - Delta summary: `<무엇이 추가/제거됐는가>`
  - Delta reason: `<왜 필요한가>`
  - Plan impact: `<Plan Step 범위 내인지 여부 + 근거>`

### Non-Goals

- <이 Task에서 하지 않는 것>

### Plan Code Scope Cross-check (Gate, 필수)

- Plan §6의 “변경 대상(예상/참고)”는 보조 근거다.
- 기계 게이트는 2절의 `Allowed paths (MUST, copy from Plan)`로 판정하며,
  Plan link가 유효할 때는 `tasks/<plan-id>/**` 경로 규칙도 함께 판정된다.

STOP 조건 (MUST):

- `Allowed paths` 범위를 벗어나면 STOP.

---

## 3) Hard Constraints (Gate, 필수)

- [ ] SSOT(docs/10..50/\*\*) 변경 없음 (필요 시 승인 요청 후 STOP)
- [ ] Public Facade(packages/\*/index.ts export) 변경 없음 (필요 시 승인 요청 후 STOP)
- [ ] deps(package.json deps) 변경 없음 (필요 시 승인 요청 후 STOP)
- [ ] `bun run verify` 통과(단일 검증 게이트)
  - Evidence: `bun run verify`
  - Expected: exit=0

Mechanical note:

- 위 체크박스는 “문장”이 아니라 “체크박스”로 판정한다. 체크 없이 진행 금지.

---

## 4) Preconditions (필수)

- Plan 상태:
  - [ ] `status: accepted` 또는 `status: in-progress`
- 필요한 승인(있는 경우):
  - [ ] Approval Ledger의 승인 증거가 존재
- 작업 전 상태 확인:
  - [ ] 현재 브랜치가 Target branch 기반
  - [ ] 작업 시작 전 “예상 변경 목록(§2 Files to change)”이 확정되어 있음

Baseline 기록 (필수):

- Baseline required by Plan Step gate?: `<yes | no>`
- Baseline verify: `<not-run | pass | fail>`
- Baseline skip reason (if required=no and not-run): `<none | 한 줄>`

Environment snapshot (권장, 기계 판정 강화):

- OS: `<linux | macos | windows>`
- Bun: `<bun --version>`
- Node (if used): `<node --version | none>`

---

## 5) Execution Checklist (필수)

> 체크리스트는 **명령/파일 단위**로 작게 쪼갠다.

Draft quality gate (MUST):

- `Status=draft`라도 아래는 “(skip)”로 미체크인 상태를 허용할 뿐, 내용 자체를 비워두거나 추상적으로 쓰는 것을 허용하지 않는다.
  - Recon: 최소 2개 이상, 각 항목에 확인 대상(경로/심볼/명령)을 포함
  - Implementation: 최소 3개 이상, 각 항목에 파일(또는 디렉토리) + 변경 요약을 포함
- 아래와 같은 추상 표현만으로 구성되면 이 Task는 “구체화 실패”로 판정한다(리뷰어/CI 기준).
  - 예: “구조 설계”, “구현”, “확정”, “정리”, “리포트 추가”
  - 예외: 해당 추상 표현이 바로 뒤에 구체 항목(파일/심볼/포맷)이 동반될 때만 허용

Decidable execution plan rule (MUST):

- `## 2) Scope`의 `Files to change (expected)`에 나열된 각 경로는, `### Implementation` 체크리스트 항목 중 최소 1개에 **동일한 백틱 경로**로 반드시 등장해야 한다.
  - 예: Files to change에 `packages/core/src/module/module.ts`가 있으면, Implementation에 `packages/core/src/module/module.ts`가 포함된 체크박스 1개 이상이 있어야 한다.
- 위 조건을 만족하지 못하면 이 Task는 “구체적 실행 계획 부재”로 판정한다.

### Recon (변경 전 필수)

- [ ] 엔트리포인트/사용처(usages) 확인 완료 (근거를 아래 Evidence에 남김)
- [ ] 변경 대상 파일 목록이 Scope와 일치

### Implementation

- [ ] <구현 작업 1: `file` + change summary>
- [ ] <구현 작업 2: `file` + change summary>
- [ ] (선택) 테스트 추가/수정: `file` + what

### Verification (Gate)

- Gate command(s) (필수):
  - [ ] `bun run verify`
- Expected result (필수):
  - [ ] Exit code 0
  - [ ] 실패 시: 원인/조치/재실행 결과를 Evidence에 남김

---

## 6) Evidence (필수)

Evidence는 “외부 추론 없이” 판정 가능해야 한다.

Evidence completeness rule (MUST):

- `Diff evidence`에는 최소 1개 이상의 `Changed files (actual)` 경로가 존재해야 한다.
- `Verification evidence`에는 `bun run verify`의 `exit=0`이 확인 가능한 형태로 존재해야 한다.
- `MUST-EVID mapping`의 각 Evidence ID는:
  - Source log(예: `LOG-VERIFY`) 1개를 지정하고
  - Excerpt에 해당 MUST를 판정 가능한 최소 라인(또는 메시지)을 포함해야 한다.

Evidence format (MUST):

- 커맨드 출력은 아래 포맷 중 하나로 남긴다.

Option A (paste):

```text
$ <command>
exit=<0|nonzero>
<relevant output>
```

Option B (log file):

- Log file path: `<path>`
- Log snippet (first/last 20 lines): `<붙여넣기>`

- Recon evidence:
  - Entry points/usages (필수): `<paths + 짧은 메모>`
  - Evidence types (필수, 형식 충족용이 아닌 목적 충족용):
    - Usage proof: `<어떤 심볼/핸들러/함수의 사용처를 어떻게 확인했는가 + 상위 결과 경로>`
    - Entry proof: `<엔트리포인트(또는 호출 루트)를 어떻게 확인했는가 + 경로>`
- Diff evidence:
  - Changed files (actual):
    - `<path>`

  - Collection method (no VCS / no file-compare, 필수):
    - `manual` (Changed files (actual) 목록을 사람이 선언)
    - 또는 “도구 출력이 변경 파일 경로를 직접 출력하는 경우” 해당 출력의 발췌를 Evidence로 남김
- Verification evidence (단일 규칙으로 고정):
  - Command logs (필수):
    - LOG-VERIFY: `<Option A 또는 Option B>`
  - MUST-EVID mapping (필수, 1:1):
    - MUST-EVID-1:
      - Source log: `LOG-VERIFY`
      - Excerpt: `<LOG-VERIFY에서 MUST를 확인 가능한 최소 발췌>`

Rule (MUST):

- MUST-EVID-\*는 반드시 위 Command logs 중 하나를 Source로 삼아야 한다(중복 로그 재포장 금지).

---

## 7) Spec Drift Check (필수, 완료 전)

- 이번 Task에서 SPEC을 암묵적으로 바꿨는가?
  - [ ] 아니다
  - [ ] 그렇다 → STOP 후 "SPEC 변경 전용 Plan" 분기 + (docs/10..50/\*\* 변경이면) 승인 아티팩트 필요

Mechanical check (MUST):

- “그렇다”를 체크한 순간, 이 Task는 status를 `blocked`로 바꾸고 Plan 분기로 이동한다.

---

## 7.1) Plan Drift Check (필수, 완료 전)

이번 Task가 Plan 범위를 암묵적으로 확장했는가?

- [ ] 아니다
- [ ] 그렇다

If yes (필수 기록):

- Drift type: `<scope-expansion | must-mapping-gap | verification-gap | other>`
- Summary: `<한 줄>`
- Trigger: `<어떤 변경/발견 때문인가>`
- Required Plan action:
  - [ ] Plan §6 Code Scope 수정
  - [ ] Plan §10 검증 매트릭스 수정
  - [ ] Plan §14 Plan Changes append

STOP 조건 (MUST):

- “그렇다”이면, 이 Task는 `Status=blocked`로 전환하고 Plan 변경이 기록되기 전까지 `Status=done` 금지.

Drift 분기 규칙 (MUST, 기계 판정):

- Spec Drift로 분류해야 하는 경우(=§7 “그렇다”):
  - SPEC 문장/계약을 바꿔야만 통과할 때
  - Plan §4 Snapshot(MUST 원문)을 바꿔야만 정합할 때
- Plan Drift로만 분류 가능한 경우(=§7은 “아니다”, §7.1은 “그렇다”):
  - Plan §6(Code Scope) 또는 Plan §10(검증 매트릭스)만 정렬하면 되는 경우

---

## 8) Rollback (필수)

- 되돌리기 방법:
  - `<manual restore strategy | other>`

Rollback proof (선택):

- 되돌리기 커맨드를 실제로 실행해볼 수 없다면, 최소한 “적용 대상 파일”을 명시한다.

---

## 9) Completion Criteria (필수)

- [ ] Hard Constraints 4개 모두 체크됨
- [ ] Scope의 “Files to change (expected)”와 실제 변경 파일이 일치(또는 차이가 있으면 근거 포함)
- [ ] Verification Gate 통과 (`bun run verify`)
- [ ] Evidence가 충분함(출력/로그/경로가 존재)
- [ ] Spec Drift Check 완료
- [ ] MUST-EVID mapping이 1:1이며, 각 Evidence ID가 Source log + Excerpt로 판정 가능

Completion lock (MUST):

- 아래 조건 중 하나라도 위반이면 `Status=done` 금지:
  - placeholder(`{{...}}`) 잔존
  - Verification evidence에 exit=0 확인 불가
  - Hard Constraints 체크박스가 미체크/무근거

---

## 10) Reviewer Mechanical Checklist (리뷰어용, 필수)

리뷰어는 아래만 보고 승인/거절을 판정할 수 있어야 한다.

- [ ] Status가 `done`이면, Completion lock(MUST) 위반이 없음
- [ ] Plan Binding이 구체 링크로 연결됨
- [ ] Plan Extract/발췌가 존재함(§1.1, §2)
- [ ] MUST-EVID-\*가 Task §6에서 1:1로 판정 가능함(§6)
- [ ] Hard Constraints 4개 체크 + 증거(LOG-VERIFY 포함)
- [ ] Evidence에 `bun run verify` 출력이 존재하고 성공을 확인 가능
- [ ] Spec Drift Check가 “아니다”로 체크됨
- [ ] Plan Drift Check가 “아니다”로 체크됨
