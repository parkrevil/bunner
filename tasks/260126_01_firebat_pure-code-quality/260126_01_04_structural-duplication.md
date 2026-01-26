# Task

## A) Mechanical Status (필수)

- Status: `draft`
- Blocked reason (status=blocked): `none`
- Review mode: `self-review`

---

## 0) Metadata (필수)

- Task ID: `260126_01_04_structural-duplication`
- Created at (UTC): `2026-01-26`
- Updated at (UTC): `2026-01-26`
- Owner: `user`
- Reviewer: `none`
- Target branch: `main`
- PR: `none`
- Related Plan:
  - Plan ID: `260126_01_firebat_pure-code-quality`
  - Link: plans/260126_01_firebat_pure-code-quality.md#Step-4
- Plan Step:
  - Step name: `Structural Duplication 확장 (1) 구현`
  - Step gate: `Plan Step-4 범위 내 변경`
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
  - `Step 4: Structural Duplication 확장 (1) 구현`

## 1.1) Plan ↔ Task Traceability (Gate, 필수)

### Plan Extract (원문 복사, 필수)

```text
MUST-4:
- Structural Duplication(near-miss 포함) 분석을 clone class(클러스터) 단위로 리포트한다.
```

| MUST ID | Evidence ID | Step   |
| ------- | ----------- | ------ |
| MUST-4  | MUST-EVID-4 | Step 4 |

- MUST IDs covered by this Task (필수):
  - MUST-4
- Evidence IDs produced by this Task (필수):
  - MUST-EVID-4

MUST ↔ Evidence Gate (필수):

- [ ] (skip) status=draft: MUST↔Evidence 1:1은 실행 시점에 재확인
- [ ] (skip) status=draft: Evidence 섹션(§6)은 실행 시점에 채움

### Plan Code Scope Cross-check (Gate, 필수)

- Plan link: plans/260126_01_firebat_pure-code-quality.md#Step-4

---

## 2) Scope (필수)

### Code Scope

- Packages/Areas:
  - `packages/firebat`
- Files to change (expected):
  - `packages/firebat/src/analyses/duplication/`
  - `packages/firebat/src/report.ts`
  - `packages/firebat/src/types.ts`

- Files to read (required to understand change):
  - `packages/firebat/src/report.ts`
  - `packages/firebat/src/types.ts`

- Allowed paths (MUST, copy from Plan):
  - `packages/firebat/**`
  - `plans/**`
  - `tasks/**`

- File → MUST IDs 매핑 (MUST, copy from Plan Step):
  - packages/firebat/src/analyses/duplication/: MUST-4
  - packages/firebat/src/report.ts: MUST-4
  - packages/firebat/src/types.ts: MUST-4

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

- [ ] (skip) status=draft: 기존 duplicates 분석 흐름과 출력 형태 확인(`packages/firebat/src/report.ts`, `packages/firebat/src/types.ts`)
- [ ] (skip) status=draft: duplication 결과가 현재 어떤 단위로 묶이는지 확인(그룹/클러스터 개념 정리)

### Implementation

- [ ] (skip) status=draft: `packages/firebat/src/analyses/duplication/`에 near-miss fingerprint(정규화) 파이프라인 스캐폴딩 추가
- [ ] (skip) status=draft: clone class(클러스터) 결과 타입을 report 스키마에 반영(`packages/firebat/src/types.ts`)
- [ ] (skip) status=draft: text/json 출력에 clone class 단위 렌더링 추가(`packages/firebat/src/report.ts`)

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
  - MUST-EVID-4: `none (status=draft)`

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
  - `git restore --staged --worktree tasks/260126_01_firebat_pure-code-quality/260126_01_04_structural-duplication.md`

---

## 9) Completion Criteria (필수)

- [ ] (skip) status=draft: Hard Constraints 4개 체크됨
- [ ] (skip) status=draft: Scope expected vs actual 정합(또는 Delta rule 기록)
- [ ] (skip) status=draft: Verification Gate 통과 (`bun run verify`)
- [ ] (skip) status=draft: Evidence가 충분함(Exit code 0 + 변경 파일 목록)

### Acceptance Criteria (draft, concrete)

- JSON 리포트에 structural duplication 결과가 “clone class(클러스터)” 단위로 포함된다.
- 각 클러스터는 최소한: `fingerprint`(또는 cluster id) + `items[]`(위치/헤더/파일 경로)를 가진다.
- near-miss 지원을 위해, items는 기존 duplicates와 동일한 위치 스키마(`filePath` + `span`)를 재사용하거나 동등한 정보를 제공한다.

### Output Example (draft)

```json
{
  "analyses": {
    "duplication": {
      "cloneClasses": [
        {
          "fingerprint": "fp:near-miss:123",
          "items": [
            {
              "kind": "function",
              "header": "parseUser",
              "filePath": "/abs/path/src/users/parse.ts",
              "span": {
                "start": { "line": 10, "column": 1 },
                "end": { "line": 52, "column": 2 }
              }
            }
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
