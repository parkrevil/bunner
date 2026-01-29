# Task

## A) Mechanical Status (필수)

- Status: `draft`
- Blocked reason (status=blocked): `none`
- Review mode: `self-review`

---

## 0) Metadata (필수)

- Task ID: `260129_01_04_injectable-collect-scope-visibility`
- Created at (UTC): `2026-01-29`
- Updated at (UTC): `2026-01-29`
- Owner: `user`
- Reviewer: `none`
- Target branch: `main`
- PR: `none`
- Related Plan:
  - Plan ID: `260129_01_cli-dev-aot-scan-di`
  - Link: plans/260129_01_cli-dev-aot-scan-di.md#Step-4
- Plan Step:
  - Step name: `Injectable 수집 + scope/visibility 해석`
  - Step gate: `Plan Step-4 범위 내 변경`
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
  - `Step 4: Injectable 수집 + scope/visibility 해석`

---

## 1.1) Plan ↔ Task Traceability (Gate, 필수)

### Plan Extract (원문 복사, 필수)

```text
Goal: 각 모듈 내 `@Injectable`을 수집하고, `visibleTo` allowlist 및 scope를 결정론적으로 해석한다.
Gate: scope/visibility 위반은 build 실패
```

| MUST ID | Evidence ID | Step |
| ------ | ----------- | ---- |
| MUST-5 | MUST-EVID-5 | Step 4 |
| MUST-6 | MUST-EVID-6 | Step 4 |
| MUST-7 | MUST-EVID-7 | Step 4 |
| MUST-9 | MUST-EVID-9 | Step 4 |

- MUST IDs covered by this Task (필수):
  - MUST-5
  - MUST-6
  - MUST-7
  - MUST-9
- Evidence IDs produced by this Task (필수):
  - MUST-EVID-9

### Plan Code Scope Cross-check (Gate, 필수)

- Plan link: plans/260129_01_cli-dev-aot-scan-di.md#Step-4

---

## 2) Scope (필수)

### Code Scope

- Packages/Areas:
  - `packages/cli`
- Files to change (expected):
  - `packages/cli/src/analyzer/ast-parser.ts`
  - `packages/cli/src/analyzer/graph/module-graph.ts`
- Files to read (required to understand change):
  - `packages/cli/src/analyzer/ast-parser.ts`
  - `packages/cli/src/analyzer/parser-models.ts`
  - `packages/cli/src/analyzer/types.ts`
  - `packages/cli/src/analyzer/graph/module-graph.ts`
  - `packages/common/src/decorators/class.decorator.ts`
- Allowed paths (MUST, copy from Plan):
  - `packages/cli/**`
  - `packages/core/**`
  - `packages/common/**`
  - `tooling/**`
  - `examples/**`
  - `plans/**`
  - `tasks/**`

- File → MUST IDs 매핑 (MUST, copy from Plan Step):
  - `packages/cli/src/analyzer/ast-parser.ts`: MUST-5, MUST-6, MUST-7, MUST-9
  - `packages/cli/src/analyzer/graph/module-graph.ts`: MUST-5, MUST-6, MUST-7, MUST-9

- Public API impact:
  - `internal-only`

### Directory Plan (필수)

- none

### File Relations (필수)

- `packages/cli/src/analyzer/graph/module-graph.ts` -> `packages/cli/src/analyzer/ast-parser.ts`: consumes decorator/options metadata parsed from AST

Scope delta rule (MUST):

- Delta summary: `none (status=draft)`
- Delta reason: `none (status=draft)`
- Plan impact: `none (status=draft)`

### Non-Goals

- inject-call(= `inject()` 수집) 그래프 엣지 구성은 Step 5에서 수행한다.

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

- [x] `packages/cli/src/analyzer/graph/module-graph.ts`에서 Injectable 옵션(visibility/lifetime 등) 파싱/기본값/검증 흐름 확인
- [x] `packages/cli/src/analyzer/ast-parser.ts`에서 decorator arguments가 어떤 타입(`AnalyzerValue`)로 표현되는지 확인

### Implementation

- [x] `packages/cli/src/analyzer/ast-parser.ts`: `@Injectable({ visibleTo, scope })` 형태에서 `visibleTo`/`scope`를 정적으로 추출 가능하도록 metadata 모델 확장
- [x] `packages/cli/src/analyzer/graph/module-graph.ts`: Injectable 옵션 해석을 `visibleTo` allowlist + scope 규칙으로 정렬하고, 비결정/위반 시 build failure로 통일
- [x] `packages/cli/src/analyzer/graph/module-graph.ts`: module-level visibility allowlist가 섞이거나(혼합) 정규화가 비결정이면 build failure로 통일

### Implementation Details (필수)

- `packages/cli/src/analyzer/ast-parser.ts`: decorator argument record에서 `visibleTo`(string 또는 string[])와 `scope`(string)만 허용하고, 그 외/동적 표현은 “비결정”으로 마킹 가능하게 모델링
- `packages/cli/src/analyzer/graph/module-graph.ts`: InjectableOptions를 “허용된 literal 형태만 통과”로 제한하고, `visibleTo`는 중복 제거/정렬로 결정론적 정규화
- `packages/cli/src/analyzer/graph/module-graph.ts`: scope 결정 불가(또는 scope 위반) 시 에러 메시지에 provider token + module + 원인 정보를 포함

### Verification (Gate)

- Gate command(s):
  - [ ] (skip) status=draft: `bun run verify`
- Expected result:
  - [ ] (skip) status=draft: Exit code 0

---

## 6) Evidence (필수)

- Recon evidence: `packages/cli/src/analyzer/graph/module-graph.ts`, `packages/cli/src/analyzer/ast-parser.ts`
- Diff evidence:
  - Changed files (actual):
    - `packages/cli/src/analyzer/ast-parser.ts`
    - `packages/cli/src/analyzer/parser-models.ts`
    - `packages/cli/src/analyzer/graph/module-graph.ts`
    - `packages/cli/src/analyzer/graph/interfaces.ts`
- Verification evidence:
  - LOG-VERIFY: `pass (bun run verify)`
- MUST-EVID mapping:
  - MUST-EVID-9: `none (status=draft)`

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
    - `packages/cli/src/analyzer/ast-parser.ts`
    - `packages/cli/src/analyzer/graph/module-graph.ts`
    - `tasks/260129_01_cli-dev-aot-scan-di/260129_01_04_injectable-collect-scope-visibility.md`

---

## 9) Completion Criteria (필수)

- [ ] (skip) status=draft: scope/visibleTo 비결정 케이스가 build failure로 재현 가능
- [ ] (skip) status=draft: Verification Gate 통과 (`bun run verify`)

---

## 10) Reviewer Mechanical Checklist (리뷰어용, 필수)

- [ ] (skip) status=draft: Files to change가 Implementation/Implementation Details에 동일 백틱 경로로 등장
