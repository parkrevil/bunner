# Task

## A) Mechanical Status (필수)

- Status: `done`
- Blocked reason (status=blocked): `none`
- Review mode: `self-review`

---

## 0) Metadata (필수)

- Task ID: `260129_01_02_recognized-scan-createApplication`
- Created at (UTC): `2026-01-29`
- Updated at (UTC): `2026-01-29`
- Owner: `user`
- Reviewer: `none`
- Target branch: `main`
- PR: `none`
- Related Plan:
  - Plan ID: `260129_01_cli-dev-aot-scan-di`
  - Link: plans/260129_01_cli-dev-aot-scan-di.md#Step-2
- Plan Step:
  - Step name: `createApplication 탐색 (recognized file scan)`
  - Step gate: `Plan Step-2 범위 내 변경`
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
  - `Step 2: createApplication 탐색 (recognized file scan)`

---

## 1.1) Plan ↔ Task Traceability (Gate, 필수)

### Plan Extract (원문 복사, 필수)

```text
Goal: `sourceDir` 하위 recognized file 집합에서 `createApplication(...)` 및 entry module(ref)을 빌드타임에 식별한다.
Gate: `createApplication` 미발견 또는 다중 관측은 build error
```

| MUST ID | Evidence ID | Step |
| ------ | ----------- | ---- |
| MUST-1 | MUST-EVID-1 | Step 2 |
| MUST-2 | MUST-EVID-2 | Step 2 |

- MUST IDs covered by this Task (필수):
  - MUST-1
  - MUST-2
- Evidence IDs produced by this Task (필수):
  - MUST-EVID-1
  - MUST-EVID-2

### Plan Code Scope Cross-check (Gate, 필수)

- Plan link: plans/260129_01_cli-dev-aot-scan-di.md#Step-2

---

## 2) Scope (필수)

### Code Scope

- Packages/Areas:
  - `packages/cli`
- Files to change (expected):
  - `packages/cli/src/analyzer/ast-parser.ts`
  - `packages/cli/src/commands/dev.command.ts`
  - `packages/cli/src/commands/build.command.ts`
- Files to read (required to understand change):
  - `packages/cli/src/analyzer/ast-parser.ts`
  - `packages/cli/src/analyzer/parser-models.ts`
  - `packages/cli/src/analyzer/types.ts`
  - `packages/core/src/application/application.ts`
  - `packages/cli/src/commands/dev.command.ts`
  - `packages/cli/src/commands/build.command.ts`
- Allowed paths (MUST, copy from Plan):
  - `packages/cli/**`
  - `packages/core/**`
  - `packages/common/**`
  - `tooling/**`
  - `examples/**`
  - `plans/**`
  - `tasks/**`

- File → MUST IDs 매핑 (MUST, copy from Plan Step):
  - `packages/cli/src/analyzer/ast-parser.ts`: MUST-1, MUST-2
  - `packages/cli/src/commands/dev.command.ts`: MUST-1, MUST-2
  - `packages/cli/src/commands/build.command.ts`: MUST-1, MUST-2

- Public API impact:
  - `internal-only`

### Directory Plan (필수)

- none

### File Relations (필수)

- `packages/cli/src/commands/dev.command.ts` -> `packages/cli/src/analyzer/ast-parser.ts`: parses files to locate app entry

Scope delta rule (MUST):

- Delta summary: `none (status=draft)`
- Delta reason: `none (status=draft)`
- Plan impact: `none (status=draft)`

### Non-Goals

- Step 3(모듈 전수조사) 및 Step 4/5(DI)는 다루지 않는다.

---

## 3) Hard Constraints (Gate, 필수)

- [x] SSOT(docs/10..50/**) 변경 없음
- [x] Public Facade(packages/*/index.ts export) 변경 없음
- [x] deps(package.json deps) 변경 없음
- [x] `bun run verify` 통과

---

## 4) Preconditions (필수)

- Plan 상태:
  - [x] `status: accepted` 또는 `status: in-progress`
- 필요한 승인(있는 경우):
  - [x] Approval Ledger 증거 존재

Baseline 기록 (필수):

- Baseline required by Plan Step gate?: `no`
- Baseline verify: `not-run`
- Baseline skip reason (if required=no and not-run): `status=draft`

---

## 5) Execution Checklist (필수)

### Recon (변경 전 필수)

- [x] `packages/core/src/application/application.ts`에서 `createApplication`의 호출 형태(인자 1개)와 entry module 형태 확인
- [x] `packages/cli/src/analyzer/ast-parser.ts`가 현재 어떤 call-expression을 수집/표현하는지 확인(수집 결과를 어디서 소비하는지 확인)

### Implementation

- [x] `packages/cli/src/analyzer/ast-parser.ts`: recognized file에서 `createApplication(...)` call-expression을 식별하고 entry module 참조를 정규화 가능한 형태로 수집
- [x] `packages/cli/src/analyzer/ast-parser.ts`: `createApplication` alias/namespace import도 동일하게 식별 가능하도록 import map 기반 해석 추가
  - 예: `import { createApplication as ca } from '@bunner/core'; ca(...)`
  - 예: `import * as bunner from '@bunner/core'; bunner.createApplication(...)`
- [x] `packages/cli/src/commands/dev.command.ts`: 스캔된 결과에서 app-entry(= entry module)를 단일로 결정하고(다중/미발견은 오류) 이후 파이프라인에 반영
- [x] `packages/cli/src/commands/build.command.ts`: 스캔된 결과에서 app-entry(= entry module)를 단일로 결정하고(다중/미발견은 오류) 이후 파이프라인에 반영

### Implementation Details (필수)

- `packages/cli/src/analyzer/ast-parser.ts`: `ImportDeclaration`에서 이미 수집 중인 `currentImports`를 이용해 `createApplication`의 local name ↔ resolved source 매핑을 확장하고, call-expression callee가 `createApplication`로 귀결되는지 판정
- `packages/cli/src/analyzer/ast-parser.ts`: `createApplication` call의 인자(1개)가 “정적으로 결정 가능한 entry module ref”인지 확인 가능한 최소 데이터(예: string literal 또는 identifier name)를 `ParseResult`에 포함
- `packages/cli/src/commands/dev.command.ts`: 스캔 결과에서 `createApplication` call이 0개면 build error, 2개 이상이면 build error(APP-R-018)로 진단을 표준화
- `packages/cli/src/commands/build.command.ts`: 스캔 결과에서 `createApplication` call이 0개면 build error, 2개 이상이면 build error(APP-R-018)로 진단을 표준화

### Verification (Gate)

- Gate command(s):
  - [x] `bun run verify`
- Expected result:
  - [x] Exit code 0

---

## 6) Evidence (필수)

- Recon evidence: `packages/core/src/application/application.ts`, `packages/cli/src/analyzer/ast-parser.ts`
- Contract reference: docs/40_ENGINEERING/VERIFY.md (Rule: VFY-TST-001)
- Diff evidence:
  - Changed files (actual):
    - `packages/cli/src/analyzer/ast-parser.ts`
    - `packages/cli/src/commands/dev.command.ts`
    - `packages/cli/src/commands/build.command.ts`
- Verification evidence:
  - LOG-VERIFY: `pass (bun run verify)`
- MUST-EVID mapping:
  - MUST-EVID-1: `none (status=draft)`
  - MUST-EVID-2: `none (status=draft)`

---

## 7) Spec Drift Check (필수, 완료 전)

- 이번 Task에서 SPEC을 암묵적으로 바꿨는가?
  - [x] 아니다
  - (not selected) 그렇다

---

## 7.1) Plan Drift Check (필수, 완료 전)

- 이번 Task가 Plan 범위를 암묵적으로 확장했는가?
  - [x] 아니다
  - (not selected) 그렇다

---

## 8) Rollback (필수)

- 되돌리기 방법:
  - 아래 파일의 변경을 되돌리고 Task 문서를 원복
    - `packages/cli/src/analyzer/ast-parser.ts`
    - `packages/cli/src/commands/dev.command.ts`
    - `tasks/260129_01_cli-dev-aot-scan-di/260129_01_02_recognized-scan-createApplication.md`

---

## 9) Completion Criteria (필수)

- [x] Verification Gate 통과 (`bun run verify`)
- [x] `createApplication` 0개/다중 케이스가 진단으로 재현 가능

---

## 10) Reviewer Mechanical Checklist (리뷰어용, 필수)

- [x] Plan link/Allowed paths/파일 경로 매칭 규칙 통과
