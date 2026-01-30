# Task

## A) Mechanical Status (필수)

- Status: `draft`
- Blocked reason (status=blocked): `none`
- Review mode: `self-review`

---

## 0) Metadata (필수)

- Task ID: `260129_01_01_config-json-jsonc`
- Created at (UTC): `2026-01-29`
- Updated at (UTC): `2026-01-29`
- Owner: `user`
- Reviewer: `none`
- Target branch: `main`
- PR: `none`
- Related Plan:
  - Plan ID: `260129_01_cli-dev-aot-scan-di`
  - Link: plans/260129_01_cli-dev-aot-scan-di.md#Step-1
- Plan Step:
  - Step name: `Config surface 정합 (bunner.json/jsonc)`
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
  - `plans/260129_01_cli-dev-aot-scan-di.md`
- 이 Task가 수행하는 Plan Step:
  - `Step 1: Config surface 정합 (bunner.json/jsonc)`

---

## 1.1) Plan ↔ Task Traceability (Gate, 필수)

### Plan Extract (원문 복사, 필수)

```text
Goal: `bunner dev`가 `bunner.json` 또는 `bunner.jsonc`를 로드한다.
Gate: config load 실패 시 진단이 결정론적으로 재현
```

| MUST ID | Evidence ID | Step |
| ------ | ----------- | ---- |
| MUST-10 | MUST-EVID-10 | Step 1 |
| MUST-11 | MUST-EVID-11 | Step 1 |
| MUST-12 | MUST-EVID-12 | Step 1 |

- MUST IDs covered by this Task (필수):
  - MUST-10
  - MUST-11
  - MUST-12
- Evidence IDs produced by this Task (필수):
  - MUST-EVID-10
  - MUST-EVID-11
  - MUST-EVID-12

### Plan Code Scope Cross-check (Gate, 필수)

- Plan link: plans/260129_01_cli-dev-aot-scan-di.md#Step-1

---

## 2) Scope (필수)

### Code Scope

- Packages/Areas:
  - `packages/cli`
- Files to change (expected):
  - `packages/cli/src/common/config-loader.ts`
  - `packages/cli/src/commands/dev.command.ts`
  - `packages/cli/src/commands/build.command.ts`
- Files to read (required to understand change):
  - `packages/cli/src/common/config-loader.ts`
  - `packages/cli/src/common/interfaces.ts`
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
  - `packages/cli/src/common/config-loader.ts`: MUST-10, MUST-11, MUST-12
  - `packages/cli/src/commands/dev.command.ts`: MUST-10, MUST-12
  - `packages/cli/src/commands/build.command.ts`: MUST-10, MUST-12

- Public API impact:
  - `internal-only`

### Directory Plan (필수)

- none

### File Relations (필수)

- `packages/cli/src/commands/dev.command.ts` -> `packages/cli/src/common/config-loader.ts`: loads config
- `packages/cli/src/commands/build.command.ts` -> `packages/cli/src/common/config-loader.ts`: loads config

Scope delta rule (MUST):

- Delta summary: `none (status=draft)`
- Delta reason: `none (status=draft)`
- Plan impact: `none (status=draft)`

### Non-Goals

- 이 Task에서 `Status=done`으로 완료 처리하지 않는다.
- config 외 기능(스캔/모듈/DI)은 다루지 않는다(Plan Step 2+).

---

## 3) Hard Constraints (Gate, 필수)

- [ ] (skip) status=draft: SSOT(docs/10..50/**) 변경 없음
- [ ] (skip) status=draft: Public Facade(packages/*/index.ts export) 변경 없음
- [ ] (skip) status=draft: deps(package.json deps) 변경 없음
- [ ] (skip) status=draft: `bun run verify` 통과 (Evidence는 실행 시점에 기록)

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

- [x] `packages/cli/src/common/config-loader.ts`에서 현재 지원 config 파일명/검증 로직 확인
- [x] `packages/cli/src/commands/dev.command.ts`/`packages/cli/src/commands/build.command.ts`에서 config 필드 사용처 확인

### Implementation

- [x] `packages/cli/src/common/config-loader.ts`: `bunner.json`/`bunner.jsonc`만 로드하도록 후보 목록/에러 메시지/format을 전환
- [x] `packages/cli/src/common/config-loader.ts`: `sourceDir`(required) + `entry`(required path) 검증 추가(특히 `entry`가 `sourceDir` 하위인지)
- [x] `packages/cli/src/common/config-loader.ts`: `workers`/`port`/`compiler`/`scanPaths` 파싱 제거
- [x] `packages/cli/src/commands/dev.command.ts`: `sourceDir`를 스캔 루트로 사용하고 하드코딩된 `src` 경로를 제거
- [x] `packages/cli/src/commands/build.command.ts`: `sourceDir`를 스캔 루트로 사용하고 하드코딩된 `src` 경로를 제거

### Implementation Details (필수)

- `packages/cli/src/common/config-loader.ts`: config 후보를 `bunner.json`/`bunner.jsonc`로 제한하고, 두 파일 공존 시 `ConfigLoadError`를 던지도록 분기 추가
- `packages/cli/src/common/config-loader.ts`: `ResolvedBunnerConfig` shape에 `sourceDir`/`entry`를 반영하고, `entry`가 파일 경로(path)이며 `sourceDir` 하위인지 `resolve()` 기반으로 검증
- `packages/cli/src/common/config-loader.ts`: `workers`/`port`/`compiler`/`scanPaths`는 입력으로 허용하지 않으며, 읽기/적용 경로를 제거
- `packages/cli/src/commands/dev.command.ts`: 기존 `resolve(projectRoot, 'src')` 제거 후 `resolve(projectRoot, config.sourceDir)`로 대체, 스캔/워처 루트가 동일하도록 정렬
- `packages/cli/src/commands/build.command.ts`: dev와 동일한 방식으로 `sourceDir`를 반영하여 build/dev가 동일 입력에서 동일한 파일 집합을 보도록 정렬

### Verification (Gate)

- Gate command(s):
  - [ ] (skip) status=draft: `bun run verify`
- Expected result:
  - [ ] (skip) status=draft: Exit code 0

---

## 6) Evidence (필수)

- Recon evidence: `packages/cli/src/common/config-loader.ts`, `packages/cli/src/commands/dev.command.ts`, `packages/cli/src/commands/build.command.ts`
- Diff evidence:
  - Changed files (actual):
    - `packages/cli/src/common/config-loader.ts`
    - `packages/cli/src/commands/dev.command.ts`
    - `packages/cli/src/commands/build.command.ts`
- Verification evidence:
  - LOG-VERIFY: `pass (bun run verify)`
- MUST-EVID mapping:
  - MUST-EVID-10: `none (status=draft)`
  - MUST-EVID-11: `none (status=draft)`
  - MUST-EVID-12: `none (status=draft)`

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
    - `packages/cli/src/common/config-loader.ts`
    - `packages/cli/src/commands/dev.command.ts`
    - `packages/cli/src/commands/build.command.ts`
    - `tasks/260129_01_cli-dev-aot-scan-di/260129_01_01_config-json-jsonc.md`

---

## 9) Completion Criteria (필수)

- [ ] (skip) status=draft: Hard Constraints 4개 체크됨
- [ ] (skip) status=draft: Verification Gate 통과 (`bun run verify`)
- [ ] (skip) status=draft: Evidence가 충분함

---

## 10) Reviewer Mechanical Checklist (리뷰어용, 필수)

- [ ] (skip) status=draft: Plan link가 `plans/...#Step-N` 형태
- [ ] (skip) status=draft: Allowed paths가 Plan frontmatter와 동일
- [ ] (skip) status=draft: Files to change가 Implementation/Implementation Details에 동일 백틱 경로로 등장
