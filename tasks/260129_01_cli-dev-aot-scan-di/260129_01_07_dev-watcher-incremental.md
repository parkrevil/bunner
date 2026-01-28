# Task

## A) Mechanical Status (필수)

- Status: `draft`
- Blocked reason (status=blocked): `none`
- Review mode: `self-review`

---

## 0) Metadata (필수)

- Task ID: `260129_01_07_dev-watcher-incremental`
- Created at (UTC): `2026-01-29`
- Updated at (UTC): `2026-01-29`
- Owner: `user`
- Reviewer: `none`
- Target branch: `main`
- PR: `none`
- Related Plan:
  - Plan ID: `260129_01_cli-dev-aot-scan-di`
  - Link: plans/260129_01_cli-dev-aot-scan-di.md#Step-7
- Plan Step:
  - Step name: `Dev watcher/증분 재빌드`
  - Step gate: `Plan Step-7 범위 내 변경`
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
  - `Step 7: Dev watcher/증분 재빌드`

---

## 1.1) Plan ↔ Task Traceability (Gate, 필수)

### Plan Extract (원문 복사, 필수)

```text
Goal: 파일 변경 시 분석 캐시를 갱신하고, manifest/아티팩트를 재생성한다.
Gate: rename/delete 처리의 결정성 유지
```

| MUST ID | Evidence ID | Step |
| ------ | ----------- | ---- |
| MUST-8 | MUST-EVID-8 | Step 7 |

- MUST IDs covered by this Task (필수):
  - MUST-8
- Evidence IDs produced by this Task (필수):
  - MUST-EVID-8

### Plan Code Scope Cross-check (Gate, 필수)

- Plan link: plans/260129_01_cli-dev-aot-scan-di.md#Step-7

---

## 2) Scope (필수)

### Code Scope

- Packages/Areas:
  - `packages/cli`
- Files to change (expected):
  - `packages/cli/src/commands/dev.command.ts`
  - `packages/cli/src/watcher/project-watcher.ts`
- Files to read (required to understand change):
  - `packages/cli/src/commands/dev.command.ts`
  - `packages/cli/src/watcher/project-watcher.ts`
  - `packages/cli/src/common/config-loader.ts`
- Allowed paths (MUST, copy from Plan):
  - `packages/cli/**`
  - `packages/core/**`
  - `packages/common/**`
  - `tooling/**`
  - `examples/**`
  - `plans/**`
  - `tasks/**`

- File → MUST IDs 매핑 (MUST, copy from Plan Step):
  - `packages/cli/src/commands/dev.command.ts`: MUST-8
  - `packages/cli/src/watcher/project-watcher.ts`: MUST-8

- Public API impact:
  - `internal-only`

### Directory Plan (필수)

- none

### File Relations (필수)

- `packages/cli/src/commands/dev.command.ts` -> `packages/cli/src/watcher/project-watcher.ts`: dev command owns watcher lifecycle

Scope delta rule (MUST):

- Delta summary: `none (status=draft)`
- Delta reason: `none (status=draft)`
- Plan impact: `none (status=draft)`

### Non-Goals

- watcher 구현 교체(새 라이브러리 도입) 또는 성능 최적화는 다루지 않는다.

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

- [ ] `packages/cli/src/watcher/project-watcher.ts`가 어떤 이벤트 타입(`rename`/etc)을 전달하는지 확인
- [ ] `packages/cli/src/commands/dev.command.ts`의 fileCache 갱신 경로(삭제/수정)와 rebuild 트리거 조건 확인

### Implementation

- [ ] `packages/cli/src/watcher/project-watcher.ts`: rename/delete 케이스에서 파일 존재 여부 판정이 안정적으로 동작하도록 이벤트 처리 정렬
- [ ] `packages/cli/src/commands/dev.command.ts`: 삭제된 파일은 캐시에서 제거하고, 변경된 파일은 재분석 후 rebuild 하도록 경로를 결정론적으로 유지
- [ ] `packages/cli/src/commands/dev.command.ts`: 스캔 루트(`sourceDir`)와 watcher 루트가 동일하게 유지되도록(Plan Step-1 반영) 정렬

### Implementation Details (필수)

- `packages/cli/src/watcher/project-watcher.ts`: 이벤트 callback에 전달되는 `filename`의 상대/절대 규칙을 고정하고, dev 쪽에서 `join(baseDir, filename)`로 해석하는 경로가 항상 동일하도록 정렬
- `packages/cli/src/commands/dev.command.ts`: `rename` 이벤트에서 `Bun.file(fullPath).exists()` 결과에 따라 delete vs update 경로를 명확히 분기하고, 실패 시 조용히 삼키지 않도록 최소한의 진단 메시지 유지
- `packages/cli/src/commands/dev.command.ts`: rebuild 실패 시에도 watcher가 계속 돌되, 다음 이벤트에서 재시도할 수 있도록 예외 처리 경로를 유지

### Verification (Gate)

- Gate command(s):
  - [ ] (skip) status=draft: `bun run verify`
- Expected result:
  - [ ] (skip) status=draft: Exit code 0

---

## 6) Evidence (필수)

- Recon evidence: `none (status=draft)`
- Diff evidence:
  - Changed files (actual): `none (status=draft)`
- Verification evidence:
  - LOG-VERIFY: `none (status=draft)`
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
    - `packages/cli/src/commands/dev.command.ts`
    - `packages/cli/src/watcher/project-watcher.ts`
    - `tasks/260129_01_cli-dev-aot-scan-di/260129_01_07_dev-watcher-incremental.md`

---

## 9) Completion Criteria (필수)

- [ ] (skip) status=draft: rename/delete/update 시나리오에서 rebuild가 결정론적으로 동작
- [ ] (skip) status=draft: Verification Gate 통과 (`bun run verify`)

---

## 10) Reviewer Mechanical Checklist (리뷰어용, 필수)

- [ ] (skip) status=draft: Files to change가 Implementation/Implementation Details에 동일 백틱 경로로 등장
