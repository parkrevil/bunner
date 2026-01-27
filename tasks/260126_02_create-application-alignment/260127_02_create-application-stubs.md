# Task

## A) Mechanical Status (필수)

- Status: `draft`
- Blocked reason (status=blocked): `none`
- Review mode: `self-review`

---

## 0) Metadata (필수)

- Task ID: `260127_02_create-application-stubs`
- Created at (UTC): `2026-01-27`
- Updated at (UTC): `2026-01-27`
- Owner: `user`
- Reviewer: `none`
- Target branch: `main`
- PR: `none`
- Related Plan:
  - Plan ID: `260126_02_create-application-alignment`
  - Link: plans/260126_02_create-application-alignment.md#Step-2
- Plan Step:
  - Step name: `createApplication + app surface stubs`
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
  - `plans/260126_02_create-application-alignment.md`
- 이 Task가 수행하는 Plan Step:
  - `Step 2: createApplication + app surface stubs`

## 1.1) Plan ↔ Task Traceability (Gate, 필수)

### Plan Extract (원문 복사, 필수)

```text
MUST-2:
createApplication takes exactly one entry module and it is statically resolvable

MUST-3:
createApplication/app.start/app.stop/app.get/app.attach returns Result
```

| MUST ID | Evidence ID | Step   |
| ------- | ----------- | ------ |
| MUST-2  | MUST-EVID-2 | Step 2 |
| MUST-3  | MUST-EVID-3 | Step 2 |

- MUST IDs covered by this Task (필수):
  - MUST-2
  - MUST-3
- Evidence IDs produced by this Task (필수):
  - MUST-EVID-2
  - MUST-EVID-3

MUST ↔ Evidence Gate (필수):

- [ ] (skip) status=draft: MUST↔Evidence 1:1은 실행 시점에 재확인
- [ ] (skip) status=draft: Evidence 섹션(§6)은 실행 시점에 채움

### Plan Code Scope Cross-check (Gate, 필수)

- Plan link: plans/260126_02_create-application-alignment.md#Step-2

---

## 2) Scope (필수)

### Code Scope

- Packages/Areas:
  - `packages/core`

- Files to change (expected):
  - `packages/core/src/application/application.ts`
  - `packages/core/src/application/interfaces.ts`

- Files to read (required to understand change):
  - `docs/30_SPEC/app/app.spec.md`
  - `docs/30_SPEC/module-system/define-module.spec.md`

- Allowed paths (MUST, copy from Plan):
  - `packages/core/**`
  - `plans/**`

- File → MUST IDs 매핑 (MUST, copy from Plan Step):
  - packages/core/src/application/application.ts: MUST-2, MUST-3
  - packages/core/src/application/interfaces.ts: MUST-2, MUST-3

- Public API impact:
  - `internal-only`

### Directory Plan (필수)

- none

### File Relations (필수)

- `packages/core/src/application/application.ts` -> `packages/core/src/application/interfaces.ts`: type-ref

Scope delta rule (MUST):

- Delta summary: `none (status=draft)`
- Delta reason: `none (status=draft)`
- Plan impact: `none (status=draft)`

### Non-Goals

- lifecycle/preload/DI/attach validation 구현(Plan의 intentional conflict 유지)
- CLI(AOT)에서 `defineModule` 수집/분석 구현
- manifest 생성/기록 및 manifest 기반 pipeline 구성

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

- [ ] (skip) status=draft: SPEC 확인: `docs/30_SPEC/app/app.spec.md#3.3`에서 MUST-2/MUST-3 원문 확인
- [ ] (skip) status=draft: 현 구현 확인: `packages/core/src/application/create-application.ts` 및 `packages/core/src/application/bootstrap-application.ts`에서 `createApplication` 호출/반환 타입을 확인 → 결과 경로를 §6에 기록
- [ ] (skip) status=draft: 경로 확인: `packages/core/src/application/application.ts`가 존재하는지 확인(없으면 생성 진행)
- [ ] (skip) status=draft: `packages/core/src/application/interfaces.ts` 내 `EntryModule`/`CreateApplicationOptions`/`BunnerApplication*` 관련 타입이 이번 변경과 충돌 없는지 확인

### Implementation

- [ ] (skip) status=draft: `packages/core/src/application/application.ts`: Plan §6.1 잠금의 시그니처(`createApplication(entry, options?)`)를 제공하도록 구현/정렬 + `// MUST: MUST-2` 태그 포함
- [ ] (skip) status=draft: `packages/core/src/application/application.ts`: 반환 객체(`BunnerApplication` 또는 대체 표면)가 `get/start/stop/attach` 4개 함수를 제공하도록 스텁(no-op) 보장 + `// MUST: MUST-3` 태그 포함
- [ ] (skip) status=draft: `packages/core/src/application/interfaces.ts`: `EntryModule`/`CreateApplicationOptions` 최소 정합(Plan §6.1) 반영 + 관련 위치에 `// MUST: MUST-2` 또는 `// MUST: MUST-3` 태그 포함
- [ ] (skip) status=draft: (Gate 준비) expected 외 파일 변경이 필요하면 §2 Scope delta rule에 Delta 기록(또는 Plan Drift로 전환)

### Verification (Gate)

- Gate command(s):
  - [ ] (skip) status=draft: `bun run verify`
- Expected result:
  - [ ] (skip) status=draft: Exit code 0

---

## 6) Evidence (필수)

- Recon evidence:
  - Entry points/usages: `none (status=draft)`
- Diff evidence:
  - Changed files (actual): `none (status=draft)`
  - Collection method (tool-agnostic): `none (status=draft)`
- Verification evidence:
  - LOG-VERIFY: `none (status=draft)`
- MUST-EVID mapping:
  - MUST-EVID-2: `none (status=draft)`
  - MUST-EVID-3: `none (status=draft)`

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
  - manual restore: 아래 파일의 변경을 되돌리고(또는 삭제), Task 문서를 원복
    - `packages/core/src/application/application.ts`
    - `packages/core/src/application/interfaces.ts`
    - `tasks/260126_02_create-application-alignment/260127_02_create-application-stubs.md`
  - Manual restore (if no VCS): 위 파일들의 변경 내용을 되돌리고(또는 생성 파일 삭제) Scope delta rule을 `none`으로 복구

---

## 9) Completion Criteria (필수)

- [ ] (skip) status=draft: Hard Constraints 4개 체크됨
- [ ] (skip) status=draft: Scope expected vs actual 정합(또는 Delta rule 기록)
- [ ] (skip) status=draft: Verification Gate 통과 (`bun run verify`)
- [ ] (skip) status=draft: Evidence가 충분함(Exit code 0 + 변경 파일 목록)
