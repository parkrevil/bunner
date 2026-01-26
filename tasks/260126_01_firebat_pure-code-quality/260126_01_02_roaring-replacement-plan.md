# Task

## A) Mechanical Status (필수)

- Status: `draft`
- Blocked reason (status=blocked): `none`
- Review mode: `self-review`

---

## 0) Metadata (필수)

- Task ID: `260126_01_02_roaring-replacement-plan`
- Created at (UTC): `2026-01-26`
- Updated at (UTC): `2026-01-26`
- Owner: `user`
- Reviewer: `none`
- Target branch: `main`
- PR: `none`
- Related Plan:
  - Plan ID: `260126_01_firebat_pure-code-quality`
  - Link: plans/260126_01_firebat_pure-code-quality.md#Step-2
- Plan Step:
  - Step name: `\`roaring\` 제거 계획 확정(대체 패키지 선정)`
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
  - `plans/260126_01_firebat_pure-code-quality.md`
- 이 Task가 수행하는 Plan Step:
  - `Step 2: \`roaring\` 제거 계획 확정(대체 패키지 선정)`

## 1.1) Plan ↔ Task Traceability (Gate, 필수)

### Plan Extract (원문 복사, 필수)

```text
MUST-2:
- `roaring` 제거를 위한 BitSet 대체 전략을 확정하고, `engine/dataflow.ts`의 네이티브 `.node` 직접 import 제거를 목표로 삼는다.
```

| MUST ID | Evidence ID | Step   |
| ------- | ----------- | ------ |
| MUST-2  | MUST-EVID-2 | Step 2 |

- MUST IDs covered by this Task (필수):
  - MUST-2
- Evidence IDs produced by this Task (필수):
  - MUST-EVID-2

MUST ↔ Evidence Gate (필수):

- [ ] (skip) status=draft: MUST↔Evidence 1:1은 실행 시점에 재확인
- [ ] (skip) status=draft: Evidence 섹션(§6)은 실행 시점에 채움

### Plan Code Scope Cross-check (Gate, 필수)

- Plan link: plans/260126_01_firebat_pure-code-quality.md#Step-2

---

## 2) Scope (필수)

### Code Scope

- Packages/Areas:
  - `packages/firebat`
- Files to change (expected):
  - `plans/260126_01_firebat_pure-code-quality.md`
  - `packages/firebat/src/engine/dataflow.ts`
  - `packages/firebat/src/engine/types.ts`
  - `packages/firebat/package.json`

- Files to read (required to understand change):
  - `packages/firebat/src/engine/dataflow.ts`
  - `packages/firebat/src/engine/types.ts`
  - `packages/firebat/package.json`

- Allowed paths (MUST, copy from Plan):
  - `packages/firebat/**`
  - `plans/**`
  - `tasks/**`

- File → MUST IDs 매핑 (MUST, copy from Plan Step):
  - plans/260126_01_firebat_pure-code-quality.md: MUST-2
  - packages/firebat/src/engine/dataflow.ts: MUST-2
  - packages/firebat/src/engine/types.ts: MUST-2
  - packages/firebat/package.json: MUST-2

- Public API impact:
  - `internal-only`

Scope delta rule (MUST):

- Delta summary: `none (status=draft)`
- Delta reason: `none (status=draft)`
- Plan impact: `none (status=draft)`

### Non-Goals

- 이 Task에서 즉시 deps 변경을 실행하지 않는다(승인 필요).
- 실행 로그/스냅샷 Evidence는 실행 시점에만 추가한다.

---

## 3) Hard Constraints (Gate, 필수)

- [ ] (skip) status=draft: SSOT(docs/10..50/**) 변경 없음
- [ ] (skip) status=draft: Public Facade(packages/*/index.ts export) 변경 없음
- [ ] (pending) deps(package.json deps) 변경 없음
  - Note: 이 Task는 `packages/firebat/package.json` 변경을 포함할 수 있으므로, 실행 전 승인 아티팩트 필요
- [ ] (skip) status=draft: `bun run verify` 통과 (Evidence는 실행 시점에 기록)

---

## 4) Preconditions (필수)

- Plan 상태:
  - [ ] (skip) status=draft: `status: accepted` 또는 `status: in-progress`
- 필요한 승인(있는 경우):
  - [ ] (pending) deps 변경 승인 증거 (필요 시)

Baseline 기록 (필수):

- Baseline required by Plan Step gate?: `no`
- Baseline verify: `not-run`
- Baseline skip reason (if required=no and not-run): `status=draft`

---

## 5) Execution Checklist (필수)

### Recon (변경 전 필수)

- [ ] (skip) status=draft: 엔트리포인트/사용처(usages) 확인
- [ ] (skip) status=draft: BitSet 요구사항 정리(연산/성능/최대 인덱스)

### Implementation

- [ ] (skip) status=draft: roaring 제거 전략 확정
- [ ] (skip) status=draft: dataflow.ts에서 네이티브 .node 직접 import 제거

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
  - MUST-EVID-2: `none (status=draft)`

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
  - `git restore --staged --worktree tasks/260126_01_firebat_pure-code-quality/260126_01_02_roaring-replacement-plan.md`

---

## 9) Completion Criteria (필수)

- [ ] (skip) status=draft: Hard Constraints 4개 체크됨
- [ ] (skip) status=draft: Verification Gate 통과 (`bun run verify`)
- [ ] (skip) status=draft: Evidence가 충분함

---

## 10) Reviewer Mechanical Checklist (리뷰어용, 필수)

- [ ] (skip) status=draft: Plan Binding이 구체 링크로 연결됨
- [ ] (skip) status=draft: Plan Extract/발췌가 존재함
- [ ] (skip) status=draft: Allowed paths / File→MUST 매핑이 Plan에서 복사됨
