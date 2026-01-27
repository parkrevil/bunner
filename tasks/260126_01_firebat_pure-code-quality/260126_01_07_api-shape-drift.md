# Task

## A) Mechanical Status (필수)

- Status: `draft`
- Blocked reason (status=blocked): `none`
- Review mode: `self-review`

---

## 0) Metadata (필수)

- Task ID: `260126_01_07_api-shape-drift`
- Created at (UTC): `2026-01-26`
- Updated at (UTC): `2026-01-26`
- Owner: `user`
- Reviewer: `none`
- Target branch: `main`
- PR: `none`
- Related Plan:
  - Plan ID: `260126_01_firebat_pure-code-quality`
  - Link: plans/260126_01_firebat_pure-code-quality.md#Step-7
- Plan Step:
  - Step name: `API Shape Drift (7) 구현`
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
  - `plans/260126_01_firebat_pure-code-quality.md`
- 이 Task가 수행하는 Plan Step:
  - `Step 7: API Shape Drift (7) 구현`

## 1.1) Plan ↔ Task Traceability (Gate, 필수)

### Plan Extract (원문 복사, 필수)

```text
MUST-7:
- API Shape Drift를 군집화하고 표준 후보/이탈 그룹을 함께 리포트한다.
```

| MUST ID | Evidence ID | Step   |
| ------- | ----------- | ------ |
| MUST-7  | MUST-EVID-7 | Step 7 |

- MUST IDs covered by this Task (필수):
  - MUST-7
- Evidence IDs produced by this Task (필수):
  - MUST-EVID-7

MUST ↔ Evidence Gate (필수):

- [ ] (skip) status=draft: MUST↔Evidence 1:1은 실행 시점에 재확인
- [ ] (skip) status=draft: Evidence 섹션(§6)은 실행 시점에 채움

### Plan Code Scope Cross-check (Gate, 필수)

- Plan link: plans/260126_01_firebat_pure-code-quality.md#Step-7

---

## 2) Scope (필수)

### Code Scope

- Packages/Areas:
  - `packages/firebat`
- Files to change (expected):
  - `packages/firebat/src/analyses/api-drift/`
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
  - packages/firebat/src/analyses/api-drift/: MUST-7
  - packages/firebat/src/report.ts: MUST-7
  - packages/firebat/src/types.ts: MUST-7

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

- [ ] (skip) status=draft: “shape” 정의 확정(파라미터 개수/optional/return/throws/async 등) + 어디서 추출할지 확인
- [ ] (skip) status=draft: 군집화 단위(함수/메서드)와 “표준 후보” 선출 기준(빈도/중심성)을 간단히 정리

### Implementation

- [ ] (skip) status=draft: `packages/firebat/src/analyses/api-drift/`에 시그니처 shape 추출기 스캐폴딩 추가
- [ ] (skip) status=draft: shape 군집화(간단: 해시/그룹핑 → 확장 가능) 결과 타입 정의
- [ ] (skip) status=draft: report 스키마에 api drift 결과를 반영(`packages/firebat/src/types.ts`)
- [ ] (skip) status=draft: text/json 출력에 api drift 결과 렌더링/직렬화 추가(`packages/firebat/src/report.ts`)

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
  - MUST-EVID-7: `none (status=draft)`

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
    - `packages/firebat/src/analyses/api-drift/`
    - `packages/firebat/src/report.ts`
    - `packages/firebat/src/types.ts`
    - `tasks/260126_01_firebat_pure-code-quality/260126_01_07_api-shape-drift.md`

---

## 9) Completion Criteria (필수)

- [ ] (skip) status=draft: Hard Constraints 4개 체크됨
- [ ] (skip) status=draft: Scope expected vs actual 정합(또는 Delta rule 기록)
- [ ] (skip) status=draft: Verification Gate 통과 (`bun run verify`)
- [ ] (skip) status=draft: Evidence가 충분함(Exit code 0 + 변경 파일 목록)

### Acceptance Criteria (draft, concrete)

- JSON 리포트에 api drift 결과가 포함된다.
- 결과는 “그룹(클러스터)” 단위로 제공되며, 각 그룹은 (a) 표준 후보 shape (b) 이탈 shape 목록을 함께 포함한다.
- shape는 최소 정보만으로도 비교 가능해야 한다(예: paramsCount/optionalCount/returnKind/async 여부).

### Output Example (draft)

```json
{
  "analyses": {
    "apiDrift": {
      "groups": [
        {
          "label": "getUser",
          "standardCandidate": { "paramsCount": 1, "optionalCount": 0, "returnKind": "User", "async": true },
          "outliers": [
            { "shape": { "paramsCount": 2, "optionalCount": 1, "returnKind": "User | null", "async": true } }
          ]
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
