# Task

## A) Mechanical Status (필수)

- Status: `draft`
- Blocked reason (status=blocked): `none`
- Review mode: `self-review`

---

## 0) Metadata (필수)

- Task ID: `260126_01_01_report-schema-vnext`
- Created at (UTC): `2026-01-26`
- Updated at (UTC): `2026-01-26`
- Owner: `user`
- Reviewer: `none`
- Target branch: `main`
- PR: `none`
- Related Plan:
  - Plan ID: `260126_01_firebat_pure-code-quality`
  - Link: plans/260126_01_firebat_pure-code-quality.md#Step-1
- Plan Step:
  - Step name: `Report 스키마 vNext 설계(호환 유지)`
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
  - `plans/260126_01_firebat_pure-code-quality.md`
- 이 Task가 수행하는 Plan Step:
  - `Step 1: Report 스키마 vNext 설계(호환 유지)`

---

## 1.1) Plan ↔ Task Traceability (Gate, 필수)

### Plan Extract (원문 복사, 필수)

```text
MUST-1:
- Report 스키마 vNext를 설계하고(`text/json` 호환 유지), 신규 분석 결과를 확장 가능한 형태로 수용한다.
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

- Plan link: plans/260126_01_firebat_pure-code-quality.md#Step-1

---

## 2) Scope (필수)

### Code Scope

- Packages/Areas:
  - `packages/firebat`
- Files to change (expected):
  - `packages/firebat/src/types.ts`
  - `packages/firebat/src/report.ts`
- Files to read (required to understand change):
  - `packages/firebat/src/types.ts`
  - `packages/firebat/src/report.ts`
- Allowed paths (MUST, copy from Plan):
  - `packages/firebat/**`
  - `plans/**`
  - `tasks/**`

- File → MUST IDs 매핑 (MUST, copy from Plan Step):
  - `packages/firebat/src/types.ts`: MUST-1
  - `packages/firebat/src/report.ts`: MUST-1

- Public API impact:
  - `internal-only`

Scope delta rule (MUST):

- Delta summary: `none (status=draft)`
- Delta reason: `none (status=draft)`
- Plan impact: `none (status=draft)`

### Non-Goals

- 이 Task에서 `Status=done`으로 완료 처리하지 않는다.
- 실행 로그/스냅샷 Evidence는 실행 시점에만 추가한다.

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
  - [ ] (skip) status=draft: Step 2(MUST-2) 완료(= `roaring` 제거 + BitSet 대체 적용)
- 필요한 승인(있는 경우):
  - [ ] (skip) status=draft: Approval Ledger 증거 존재

Baseline 기록 (필수):

- Baseline required by Plan Step gate?: `no`
- Baseline verify: `not-run`
- Baseline skip reason (if required=no and not-run): `status=draft`

---

## 5) Execution Checklist (필수)

### Recon (변경 전 필수)

- [ ] (skip) status=draft: 엔트리포인트/사용처(usages) 확인
- [ ] (skip) status=draft: Scope와 변경 대상 파일 목록 일치 확인

### Implementation

- [ ] (skip) status=draft: `packages/firebat/src/types.ts`에 report vNext 확장 포인트(분석기별 섹션/배열) 타입 추가
- [ ] (skip) status=draft: `packages/firebat/src/report.ts`에서 text/json 출력이 신규 필드를 포함하되 기존 필드 호환 유지
- [ ] (skip) status=draft: 기존 consumers(있다면) 깨지지 않도록 default/optional 처리(필드 optional + 빈 배열 등)

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
  - `git restore --staged --worktree tasks/260126_01_firebat_pure-code-quality/260126_01_01_report-schema-vnext.md`

---

## 9) Completion Criteria (필수)

- [ ] (skip) status=draft: Hard Constraints 4개 체크됨
- [ ] (skip) status=draft: Verification Gate 통과 (`bun run verify`)
- [ ] (skip) status=draft: Evidence가 충분함

### Acceptance Criteria (draft, concrete)

- `packages/firebat/src/types.ts`의 `FirebatReport`는 `meta` + `analyses` 구조를 가진다.
- `packages/firebat/src/report.ts`의 `--format json` 출력은 JSON 최상위에 `meta`, `analyses`를 가진다(legacy top-level `duplicates/waste`는 제공하지 않는다).
- `--format text`의 헤더 라인(`[firebat] ...`)은 기존처럼 출력되며, 신규 분석기 결과가 추가되더라도 기본 헤더 파싱이 깨지지 않는다.

### Output Example (draft)

```json
{
  "meta": {
    "engine": "oxc",
    "version": "2.0.0-strict",
    "tsconfigPath": "/abs/path/tsconfig.json",
    "targetCount": 42,
    "minTokens": 60,
    "detectors": ["duplicates", "waste"]
  },
  "analyses": {
    "duplicates": [],
    "waste": []
  }
}
```

---

## 10) Reviewer Mechanical Checklist (리뷰어용, 필수)

- [ ] (skip) status=draft: Plan Binding이 구체 링크로 연결됨
- [ ] (skip) status=draft: Plan Extract/발췌가 존재함
- [ ] (skip) status=draft: Allowed paths / File→MUST 매핑이 Plan에서 복사됨
