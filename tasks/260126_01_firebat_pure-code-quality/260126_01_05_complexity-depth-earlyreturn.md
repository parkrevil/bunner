# Task

## A) Mechanical Status (필수)

- Status: `draft`
- Blocked reason (status=blocked): `none`
- Review mode: `self-review`

---

## 0) Metadata (필수)

- Task ID: `260126_01_05_complexity-depth-earlyreturn`
- Created at (UTC): `2026-01-26`
- Updated at (UTC): `2026-01-26`
- Owner: `user`
- Reviewer: `none`
- Target branch: `main`
- PR: `none`
- Related Plan:
  - Plan ID: `260126_01_firebat_pure-code-quality`
  - Link: plans/260126_01_firebat_pure-code-quality.md#Step-5
- Plan Step:
  - Step name: `Nesting + EarlyReturn (신규) 구현`
  - Step gate: `Plan Step-5 범위 내 변경`
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
  - `Step 5: Nesting + EarlyReturn (신규) 구현`

## 1.1) Plan ↔ Task Traceability (Gate, 필수)

### Plan Extract (원문 복사, 필수)

```text
MUST-5:
- Nesting + Early Return 메트릭(및 decision points)을 결합해 “리팩터 우선순위” 신호로 제공한다.
```

Note (정렬, Non-gate):
- `decisionPoints`는 독립 detector가 아니라 메트릭이다.

| MUST ID | Evidence ID | Step   |
| ------- | ----------- | ------ |
| MUST-5  | MUST-EVID-5 | Step 5 |

- MUST IDs covered by this Task (필수):
  - MUST-5
- Evidence IDs produced by this Task (필수):
  - MUST-EVID-5

MUST ↔ Evidence Gate (필수):

- [ ] (skip) status=draft: MUST↔Evidence 1:1은 실행 시점에 재확인
- [ ] (skip) status=draft: Evidence 섹션(§6)은 실행 시점에 채움

### Plan Code Scope Cross-check (Gate, 필수)

- Plan link: plans/260126_01_firebat_pure-code-quality.md#Step-5

---

## 2) Scope (필수)

### Code Scope

- Packages/Areas:
  - `packages/firebat`
- Files to change (expected):
  - `packages/firebat/src/analyses/nesting/`
  - `packages/firebat/src/analyses/early-return/`
  - `packages/firebat/src/report.ts`
  - `packages/firebat/src/types.ts`

- Files to read (required to understand change):
  - `packages/firebat/src/report.ts`
  - `packages/firebat/src/types.ts`

- Allowed paths (MUST, copy from Plan):
  - `packages/firebat/**`
  - `tooling/**`
  - `plans/**`
  - `tasks/**`

- File → MUST IDs 매핑 (MUST, copy from Plan Step):
  - packages/firebat/src/analyses/nesting/: MUST-5
  - packages/firebat/src/analyses/early-return/: MUST-5
  - packages/firebat/src/report.ts: MUST-5
  - packages/firebat/src/types.ts: MUST-5

- Public API impact:
  - `internal-only`

### Directory Plan (필수)

- none

### File Relations (필수)

- `packages/firebat/src/report.ts` -> `packages/firebat/src/types.ts`: type-ref

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

## 4) Preconditions (필수)

- Plan 상태:
  - [ ] (skip) status=draft: `status: accepted` 또는 `status: in-progress`
  - [ ] (skip) status=draft: Step 2(MUST-2) 완료(= `roaring` 제거 + BitSet 대체 적용)

Baseline 기록 (필수):

- Baseline required by Plan Step gate?: `no`
- Baseline verify: `not-run`
- Baseline skip reason (if required=no and not-run): `status=draft`

---

## 5) Execution Checklist (필수)

### Recon (변경 전 필수)

- [ ] (skip) status=draft: 기존 분석기 실행/출력 연결 방식 확인(`packages/firebat/src/firebat.ts`, `packages/firebat/src/report.ts`)
- [ ] (skip) status=draft: nesting/early-return을 어떤 단위(함수/메서드)로 산출할지 입력 IR 경계 정리

### Implementation

- [ ] (skip) status=draft: `packages/firebat/src/analyses/nesting/`에 nesting 메트릭 수집기 추가(함수 단위: depth, decisionPoints 등)
- [ ] (skip) status=draft: `packages/firebat/src/analyses/early-return/`에 early return 신호(guard clause 부족) 산출 규칙 추가 + 리팩터 “제안 카드” 타입 정의
- [ ] (skip) status=draft: report 스키마에 `analyses.nesting`/`analyses.earlyReturn` 결과를 추가(`packages/firebat/src/types.ts`)
- [ ] (skip) status=draft: text/json 출력에 nesting/earlyReturn 결과 렌더링/직렬화 추가(`packages/firebat/src/report.ts`)

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
  - MUST-EVID-5: `none (status=draft)`

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
  - manual restore: 아래 파일/디렉토리의 변경을 되돌리고(또는 삭제), Task 문서를 원복
    - `packages/firebat/src/analyses/nesting/`
    - `packages/firebat/src/analyses/early-return/`
    - `packages/firebat/src/report.ts`
    - `packages/firebat/src/types.ts`
    - `tasks/260126_01_firebat_pure-code-quality/260126_01_05_complexity-depth-earlyreturn.md`

---

## 9) Completion Criteria (필수)

- [ ] (skip) status=draft: Hard Constraints 4개 체크됨
- [ ] (skip) status=draft: Scope expected vs actual 정합(또는 Delta rule 기록)
- [ ] (skip) status=draft: Verification Gate 통과 (`bun run verify`)
- [ ] (skip) status=draft: Evidence가 충분함(Exit code 0 + 변경 파일 목록)

### Acceptance Criteria (draft, concrete)

- JSON 리포트에 함수(또는 메서드) 단위 `analyses.nesting` 및 `analyses.earlyReturn` 결과가 포함된다.
- 각 항목은 최소: 대상 식별자(헤더) + 위치(`filePath` + `span`) + 수치(정수) + 제안 카드(문자열 또는 enum)를 가진다.
- “리팩터 우선순위”는 정렬 가능해야 한다(예: `score` 또는 명확한 우선순위 키).

### Output Example (draft)

```json
{
  "analyses": {
    "nesting": {
      "items": [
        {
          "filePath": "/abs/path/src/auth/guard.ts",
          "header": "authorize",
          "span": {
            "start": { "line": 5, "column": 1 },
            "end": { "line": 88, "column": 2 }
          },
          "metrics": {
            "depth": 6,
            "decisionPoints": 14
          },
          "score": 0.82,
          "suggestions": ["extract-function", "flatten-nesting"]
        }
      ]
    },
    "earlyReturn": {
      "items": [
        {
          "filePath": "/abs/path/src/auth/guard.ts",
          "header": "authorize",
          "span": {
            "start": { "line": 5, "column": 1 },
            "end": { "line": 88, "column": 2 }
          },
          "metrics": {
            "earlyReturnCount": 0,
            "hasGuardClauses": false
          },
          "score": 0.91,
          "suggestions": ["add-guard-clauses"]
        }
      ]
    }
  }
}
```

---

## 10) Reviewer Mechanical Checklist (리뷰어용, 필수)

- [ ] (skip) status=draft: Plan Binding이 구체 링크로 연결됨
- [ ] (skip) status=draft: Plan Extract/발췌가 존재함
- [ ] (skip) status=draft: Allowed paths / File→MUST 매핑이 Plan에서 복사됨
- [ ] (skip) status=draft: Execution Checklist가 파일/변경 단위로 구체화됨
