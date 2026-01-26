# Task

## A) Mechanical Status (필수)

- Status: `draft`
- Blocked reason (status=blocked): `none`
- Review mode: `self-review`

---

## 0) Metadata (필수)

- Task ID: `260126_01_08_cli-wiring-output`
- Created at (UTC): `2026-01-26`
- Updated at (UTC): `2026-01-26`
- Owner: `user`
- Reviewer: `none`
- Target branch: `main`
- PR: `none`
- Related Plan:
  - Plan ID: `260126_01_firebat_pure-code-quality`
  - Link: plans/260126_01_firebat_pure-code-quality.md#Step-8
- Plan Step:
  - Step name: `CLI Wiring + Output 확장`
  - Step gate: `Plan Step-8 범위 내 변경`
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
  - `Step 8: CLI Wiring + Output 확장`

## 1.1) Plan ↔ Task Traceability (Gate, 필수)

### Plan Extract (원문 복사, 필수)

```text
MUST-8:
- CLI wiring/output 확장을 통해 신규 분석기를 선택 실행하고, `--format json`을 자동화 친화적으로 유지한다.
```

| MUST ID | Evidence ID | Step   |
| ------- | ----------- | ------ |
| MUST-8  | MUST-EVID-8 | Step 8 |

- MUST IDs covered by this Task (필수):
  - MUST-8
- Evidence IDs produced by this Task (필수):
  - MUST-EVID-8

MUST ↔ Evidence Gate (필수):

- [ ] (skip) status=draft: MUST↔Evidence 1:1은 실행 시점에 재확인
- [ ] (skip) status=draft: Evidence 섹션(§6)은 실행 시점에 채움

### Plan Code Scope Cross-check (Gate, 필수)

- Plan link: plans/260126_01_firebat_pure-code-quality.md#Step-8

---

## 2) Scope (필수)

### Code Scope

- Packages/Areas:
  - `packages/firebat`
- Files to change (expected):
  - `packages/firebat/src/arg-parse.ts`
  - `packages/firebat/src/firebat.ts`
  - `packages/firebat/src/report.ts`

- Files to read (required to understand change):
  - `packages/firebat/src/arg-parse.ts`
  - `packages/firebat/src/firebat.ts`
  - `packages/firebat/src/report.ts`

- Allowed paths (MUST, copy from Plan):
  - `packages/firebat/**`
  - `plans/**`
  - `tasks/**`

- File → MUST IDs 매핑 (MUST, copy from Plan Step):
  - packages/firebat/src/arg-parse.ts: MUST-8
  - packages/firebat/src/firebat.ts: MUST-8
  - packages/firebat/src/report.ts: MUST-8

- Public API impact:
  - `internal-only`

Scope delta rule (MUST):

- Delta summary: `none (status=draft)`
- Delta reason: `none (status=draft)`
- Plan impact: `none (status=draft)`

---

## 3) Hard Constraints (Gate, 필수)

- [ ] (skip) status=draft: SSOT(docs/10..50/**) 변경 없음
- [ ] (skip) status=draft: Public Facade(packages/*/index.ts export) 변경 없음
- [ ] (skip) status=draft: deps(package.json deps) 변경 없음
- [ ] (skip) status=draft: `bun run verify` 통과

---

## 8) Rollback (필수)

- 되돌리기 방법:
  - `git restore --staged --worktree tasks/260126_01_firebat_pure-code-quality/260126_01_08_cli-wiring-output.md`
