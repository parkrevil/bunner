# Task

## A) Mechanical Status (필수)

- Status: `draft`
- Blocked reason (status=blocked): `none`
- Review mode: `self-review`

---

## 0) Metadata (필수)

- Task ID: `260129_01_06_manifest-digraph-determinism`
- Created at (UTC): `2026-01-29`
- Updated at (UTC): `2026-01-29`
- Owner: `user`
- Reviewer: `none`
- Target branch: `main`
- PR: `none`
- Related Plan:
  - Plan ID: `260129_01_cli-dev-aot-scan-di`
  - Link: plans/260129_01_cli-dev-aot-scan-di.md#Step-6
- Plan Step:
  - Step name: `Manifest 산출 정합`
  - Step gate: `Plan Step-6 범위 내 변경`
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
  - `Step 6: Manifest 산출 정합`

---

## 1.1) Plan ↔ Task Traceability (Gate, 필수)

### Plan Extract (원문 복사, 필수)

```text
Goal: `modules`/`diGraph`를 포함하는 manifest를 deterministic하게 생성한다.
Gate: arrays sorting by id 보장
```

| MUST ID | Evidence ID | Step |
| ------ | ----------- | ---- |
| MUST-8 | MUST-EVID-8 | Step 6 |

- MUST IDs covered by this Task (필수):
  - MUST-8
- Evidence IDs produced by this Task (필수):
  - MUST-EVID-8

### Plan Code Scope Cross-check (Gate, 필수)

- Plan link: plans/260129_01_cli-dev-aot-scan-di.md#Step-6

---

## 2) Scope (필수)

### Code Scope

- Packages/Areas:
  - `packages/cli`
- Files to change (expected):
  - `packages/cli/src/generator/manifest.ts`
- Files to read (required to understand change):
  - `packages/cli/src/generator/manifest.ts`
  - `packages/cli/src/commands/dev.command.ts`
  - `packages/cli/src/analyzer/graph/module-graph.ts`
- Allowed paths (MUST, copy from Plan):
  - `packages/cli/**`
  - `packages/core/**`
  - `packages/common/**`
  - `tooling/**`
  - `examples/**`
  - `plans/**`
  - `tasks/**`

- File → MUST IDs 매핑 (MUST, copy from Plan Step):
  - `packages/cli/src/generator/manifest.ts`: MUST-8

- Public API impact:
  - `internal-only`

### Directory Plan (필수)

- none

### File Relations (필수)

- none

Scope delta rule (MUST):

- Delta summary: `none (status=draft)`
- Delta reason: `none (status=draft)`
- Plan impact: `none (status=draft)`

### Non-Goals

- manifest schema 버전업 또는 외부 호환성 변경은 다루지 않는다.

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

Baseline 기록 (필수):

- Baseline required by Plan Step gate?: `no`
- Baseline verify: `not-run`
- Baseline skip reason (if required=no and not-run): `status=draft`

---

## 5) Execution Checklist (필수)

### Recon (변경 전 필수)

- [x] `packages/cli/src/generator/manifest.ts`에서 현재 `modules`/`diGraph` 정렬 및 출력 구조 확인
- [x] dev 경로(`packages/cli/src/commands/dev.command.ts`)에서 manifest 생성 입력(graph/config/source)이 어떤 형태인지 확인

### Implementation

- [x] `packages/cli/src/generator/manifest.ts`: `modules`/`diGraph.nodes`/`handlerIndex` 정렬이 id 기준으로 결정론적임을 보장(중복/정렬/compare)
- [x] `packages/cli/src/generator/manifest.ts`: config 관련 필드(`sourcePath/sourceFormat/...`)가 입력과 일관되게 기록되도록 동기화
- [x] `packages/cli/src/generator/manifest.ts`: 누락된 필드가 있으면 기본값/빈 배열 등으로 결정론적 출력 보장

### Implementation Details (필수)

- `packages/cli/src/generator/manifest.ts`: 정렬 기준을 `compareCodePoint` 또는 동일한 comparator로 통일하고, 정렬 대상 배열을 항상 정렬 후 직렬화
- `packages/cli/src/generator/manifest.ts`: `diGraph` 출력이 존재하는 경우(또는 빈 그래프라도) 동일한 shape를 유지하도록 JSON 생성 경로를 고정
- `packages/cli/src/generator/manifest.ts`: `source`/`resolvedConfig` 입력이 동일하면 `manifest.json`이 바이트 단위로 동일하게 생성되도록 `JSON.stringify(..., null, 2)` 경로 유지

### Verification (Gate)

- Gate command(s):
  - [ ] (skip) status=draft: `bun run verify`
- Expected result:
  - [ ] (skip) status=draft: Exit code 0

---

## 6) Evidence (필수)

- Recon evidence: `packages/cli/src/generator/manifest.ts`, `packages/cli/src/commands/dev.command.ts`
- Diff evidence:
  - Changed files (actual):
    - `packages/cli/src/generator/manifest.ts`
- Verification evidence:
  - LOG-VERIFY: `pass (bun run verify)`
- MUST-EVID mapping:
  - MUST-EVID-8: `none (status=draft)`

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
    - `packages/cli/src/generator/manifest.ts`
    - `tasks/260129_01_cli-dev-aot-scan-di/260129_01_06_manifest-digraph-determinism.md`

---

## 9) Completion Criteria (필수)

- [ ] (skip) status=draft: Verification Gate 통과 (`bun run verify`)
- [ ] (skip) status=draft: 동일 입력에서 동일 manifest 출력(결정론) 확인 가능

---

## 10) Reviewer Mechanical Checklist (리뷰어용, 필수)

- [ ] (skip) status=draft: Files to change가 Implementation/Implementation Details에 동일 백틱 경로로 등장
