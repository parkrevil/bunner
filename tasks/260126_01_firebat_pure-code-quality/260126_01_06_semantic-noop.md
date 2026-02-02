# Task

## A) Mechanical Status (필수)

- Status: `in-progress`
- Blocked reason (status=blocked): `none`
- Review mode: `self-review`

---

## 0) Metadata (필수)

- Task ID: `260126_01_06_semantic-noop`
- Created at (UTC): `2026-01-26`
- Updated at (UTC): `2026-01-29`
- Owner: `user`
- Reviewer: `none`
- Target branch: `main`
- PR: `none`
- Related Plan:
  - Plan ID: `260126_01_firebat_pure-code-quality`
  - Link: plans/260126_01_firebat_pure-code-quality.md#Step-6
- Plan Step:
  - Step name: `Semantic No-op (6) 구현`
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
  - `plans/260126_01_firebat_pure-code-quality.md`
- 이 Task가 수행하는 Plan Step:
  - `Step 6: Semantic No-op (6) 구현`

## 1.1) Plan ↔ Task Traceability (Gate, 필수)

### Plan Extract (원문 복사, 필수)

```text
MUST-6:
- Semantic No-op/Redundant Logic을 confidence/evidence와 함께 리포트한다.
```

| MUST ID | Evidence ID | Step   |
| ------- | ----------- | ------ |
| MUST-6  | MUST-EVID-6 | Step 6 |

- MUST IDs covered by this Task (필수):
  - MUST-6
- Evidence IDs produced by this Task (필수):
  - MUST-EVID-6

MUST ↔ Evidence Gate (필수):

- [ ] (skip) status=draft: MUST↔Evidence 1:1은 실행 시점에 재확인
- [ ] (skip) status=draft: Evidence 섹션(§6)은 실행 시점에 채움

### Plan Code Scope Cross-check (Gate, 필수)

- Plan link: plans/260126_01_firebat_pure-code-quality.md#Step-6

---

## 2) Scope (필수)

### Code Scope

- Packages/Areas:
  - `packages/firebat`
- Files to change (expected):
  - `packages/firebat/src/analyses/no-op/`
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
  - packages/firebat/src/analyses/no-op/: MUST-6
  - packages/firebat/src/report.ts: MUST-6
  - packages/firebat/src/types.ts: MUST-6

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

- [ ] (skip) status=draft: 기존 엔진/IR에서 조건/리턴/브랜치 정보를 어디서 얻는지 확인(파서/collector 경계)
- [ ] (skip) status=draft: “confidence/evidence”를 report에 어떻게 담을지(최소 필드) 초안 작성

### Implementation

- [ ] (skip) status=draft: `packages/firebat/src/analyses/no-op/`에 no-op 후보 탐지기 스캐폴딩 추가
- [ ] (skip) status=draft: confidence 계산(룰 기반 점수) + evidence 최소 단위(노드/위치/요약 문자열) 타입 정의
- [ ] (skip) status=draft: report 스키마에 no-op 결과를 반영(`packages/firebat/src/types.ts`)
- [ ] (skip) status=draft: text/json 출력에 no-op 결과 렌더링/직렬화 추가(`packages/firebat/src/report.ts`)

### Implementation Details (필수)

- `packages/firebat/src/analyses/no-op/`: expression/조건 기반의 no-op 후보를 수집하고, finding에 `confidence`/`evidence`/`span`을 채우는 최소 필드를 고정한다.
- `packages/firebat/src/types.ts`: `analyses.noop` 결과 타입을 정의하고, finding의 필수 필드를 명시한다.
- `packages/firebat/src/report.ts`: text/json 출력에서 no-op 결과를 직렬화/렌더링하며, 결과가 비어도 안정적으로 출력되도록 한다.

### Verification (Gate)

- Gate command(s):
  - [ ] (skip) status=draft: `bun run verify`
- Expected result:
  - [ ] (skip) status=draft: Exit code 0

---

## 6) Evidence (필수)

- Recon evidence: `none (status=draft)`
- Diff evidence:
  - Changed files (actual): `packages/firebat/src/analyses/no-op/**`, `packages/firebat/src/firebat.ts`, `packages/firebat/src/types.ts`, `packages/firebat/src/report.ts`
- Verification evidence:
  - LOG-VERIFY: `not-run`
- MUST-EVID mapping:
  - MUST-EVID-6: `semantic no-op 분석기 구현 및 wiring 완료`

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
    - `packages/firebat/src/analyses/no-op/`
    - `packages/firebat/src/report.ts`
    - `packages/firebat/src/types.ts`
    - `tasks/260126_01_firebat_pure-code-quality/260126_01_06_semantic-noop.md`

---

## 9) Completion Criteria (필수)

- [ ] (skip) status=draft: Hard Constraints 4개 체크됨
- [ ] (skip) status=draft: Scope expected vs actual 정합(또는 Delta rule 기록)
- [ ] (skip) status=draft: Verification Gate 통과 (`bun run verify`)
- [ ] (skip) status=draft: Evidence가 충분함(Exit code 0 + 변경 파일 목록)

### Acceptance Criteria (draft, concrete)

- JSON 리포트에 semantic no-op 결과가 포함된다.
- 각 finding은 최소: kind(분류) + 위치(`filePath` + `span`) + `confidence`(0..1) + `evidence`(사람이 이해 가능한 한 줄) 를 가진다.
- 오탐 방지를 위해 confidence/evidence 없는 결과는 리포트하지 않는다.

### Output Example (draft)

```json
{
  "analyses": {
    "noop": {
      "findings": [
        {
          "kind": "always-true-condition",
          "filePath": "/abs/path/src/flags.ts",
          "span": {
            "start": { "line": 12, "column": 3 },
            "end": { "line": 12, "column": 25 }
          },
          "confidence": 0.9,
          "evidence": "Condition is constant 'true' after normalization"
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
