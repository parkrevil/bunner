# Task

## A) Mechanical Status (필수)

- Status: `draft`
- Blocked reason (status=blocked): `none`
- Review mode: `self-review`

---

## 0) Metadata (필수)

- Task ID: `260127_01_define-module-stub`
- Created at (UTC): `2026-01-27`
- Updated at (UTC): `2026-01-27`
- Owner: `user`
- Reviewer: `none`
- Target branch: `main`
- PR: `none`
- Related Plan:
  - Plan ID: `260126_02_create-application-alignment`
  - Link: plans/260126_02_create-application-alignment.md#Step-1
- Plan Step:
  - Step name: `defineModule stub 추가`
  - Step gate: `Plan Step-1 범위 내 변경`
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
  - `Step 1: defineModule stub 추가`

## 1.1) Plan ↔ Task Traceability (Gate, 필수)

### Plan Extract (원문 복사, 필수)

```text
MUST-1:
defineModule call is mechanically checkable and returns a ModuleRef marker
```

| MUST ID | Evidence ID | Step   |
| ------- | ----------- | ------ |
| MUST-1  | MUST-EVID-1 | Step 1 |

- MUST IDs covered by this Task (필수):
  - MUST-1
- Evidence IDs produced by this Task (필수):
  - MUST-EVID-1

MUST ↔ Evidence Gate (필수):

- [ ] (skip) status=draft: MUST↔Evidence 1:1은 실행 시점에 재확인
- [ ] (skip) status=draft: Evidence 섹션(§6)은 실행 시점에 채움

### Plan Code Scope Cross-check (Gate, 필수)

- Plan link: plans/260126_02_create-application-alignment.md#Step-1

---

## 2) Scope (필수)

### Code Scope

- Packages/Areas:
  - `packages/core`

- Files to change (expected):
  - `packages/core/src/module/module.ts`
  - `packages/core/src/module/index.ts`

- Files to read (required to understand change):
  - `docs/30_SPEC/module-system/define-module.spec.md`
  - `docs/30_SPEC/common/declarations.spec.md`

- Allowed paths (MUST, copy from Plan):
  - `packages/core/**`
  - `plans/**`

- File → MUST IDs 매핑 (MUST, copy from Plan Step):
  - packages/core/src/module/module.ts: MUST-1
  - packages/core/src/module/index.ts: MUST-1

- Public API impact:
  - `internal-only`

### Directory Plan (필수)

- none

### File Relations (필수)

- `packages/core/src/module/index.ts` -> `packages/core/src/module/module.ts`: export

Scope delta rule (MUST):

- Delta summary: `none (status=draft)`
- Delta reason: `none (status=draft)`
- Plan impact: `none (status=draft)`

### Non-Goals

- `defineModule` 수집/정적 제약(AOT) 구현(Plan의 intentional conflict 유지)
- 모듈 호출 1회 제약 런타임 강제(이번 Task 범위 밖)

---

## 3) Hard Constraints (Gate, 필수)

- [ ] (skip) status=draft: SSOT(docs/10..50/\*\*) 변경 없음
- [ ] (skip) status=draft: Public Facade(packages/\*/index.ts export) 변경 없음
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

- [ ] (skip) status=draft: SPEC 확인: `docs/30_SPEC/common/declarations.spec.md`에서 `ModuleRef`가 `symbol` marker인지 확인
- [ ] (skip) status=draft: SPEC 확인: `docs/30_SPEC/module-system/define-module.spec.md#3.3`의 “mechanically checkable” 최소 요구 확인
- [ ] (skip) status=draft: 리포 내 충돌/유사 심볼 확인: `packages/core/**`에서 `defineModule`/`ModuleRef` 텍스트 검색(도구 무관) → 결과 경로를 §6에 기록
- [ ] (skip) status=draft: 경로 확인: `packages/core/src/module/` 및 expected 파일 2개가 존재하는지 확인(없으면 생성 진행)

### Implementation

- [ ] (skip) status=draft: `packages/core/src/module/module.ts`: `defineModule(options?: DefineModuleOptions): symbol` 스텁 추가 + `// MUST: MUST-1` 태그 포함
- [ ] (skip) status=draft: `packages/core/src/module/module.ts`: `DefineModuleOptions`를 “임시 프로퍼티 1개” 포함 형태로 선언(Plan §6.1 잠금 준수)
- [ ] (skip) status=draft: `packages/core/src/module/index.ts`: `defineModule` named export re-export(배럴) + `// MUST: MUST-1` 태그 포함
- [ ] (skip) status=draft: expected 외 파일 변경이 필요하면 §2 Scope delta rule에 Delta 기록(또는 Plan Drift로 전환)

### Implementation Details (필수)

- `packages/core/src/module/module.ts`: `defineModule`이 `symbol` marker를 반환하도록 스텁 구현하고, `DefineModuleOptions`는 `__temp?: true` 형태로만 유지한다.
- `packages/core/src/module/index.ts`: `defineModule`를 named export로 re-export하여 import 경로를 고정한다.
- `packages/core/src/module/module.ts`: `// MUST: MUST-1` 태그가 실제 변경 코드 경로에 포함되도록 배치한다.

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
  - MUST-EVID-1: `none (status=draft)`

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
    - `packages/core/src/module/module.ts`
    - `packages/core/src/module/index.ts`
    - `tasks/260126_02_create-application-alignment/260127_01_define-module-stub.md`
  - Manual restore (if no VCS): 위 파일들의 변경 내용을 되돌리고(또는 파일 삭제) Scope delta rule을 `none`으로 복구

---

## 9) Completion Criteria (필수)

- [ ] (skip) status=draft: Hard Constraints 4개 체크됨
- [ ] (skip) status=draft: Scope expected vs actual 정합(또는 Delta rule 기록)
- [ ] (skip) status=draft: Verification Gate 통과 (`bun run verify`)
- [ ] (skip) status=draft: Evidence가 충분함(Exit code 0 + 변경 파일 목록)
