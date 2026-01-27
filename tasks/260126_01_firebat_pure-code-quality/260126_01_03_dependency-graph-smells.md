# Task

## A) Mechanical Status (필수)

- Status: `draft`
- Blocked reason (status=blocked): `none`
- Review mode: `self-review`

---

## 0) Metadata (필수)

- Task ID: `260126_01_03_dependency-graph-smells`
- Created at (UTC): `2026-01-26`
- Updated at (UTC): `2026-01-26`
- Owner: `user`
- Reviewer: `none`
- Target branch: `main`
- PR: `none`
- Related Plan:
  - Plan ID: `260126_01_firebat_pure-code-quality`
  - Link: plans/260126_01_firebat_pure-code-quality.md#Step-3
- Plan Step:
  - Step name: `Dependency Graph Smells (5) 구현`
  - Step gate: `Plan Step-3 범위 내 변경`
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
  - `Step 3: Dependency Graph Smells (5) 구현`

## 1.1) Plan ↔ Task Traceability (Gate, 필수)

### Plan Extract (원문 복사, 필수)

```text
MUST-3:
- Dependency Graph Smells(사이클, fan-in/out)를 Public API 기반 결과로 리포트한다.
```

Note (정렬, Non-gate):

- 본 Step은 `analyses.dependencies`(증거/그래프 사실)와 `analyses.coupling`(우선순위/hotspot)을 함께 산출한다.

| MUST ID | Evidence ID | Step   |
| ------- | ----------- | ------ |
| MUST-3  | MUST-EVID-3 | Step 3 |

- MUST IDs covered by this Task (필수):
  - MUST-3
- Evidence IDs produced by this Task (필수):
  - MUST-EVID-3

MUST ↔ Evidence Gate (필수):

- [ ] (skip) status=draft: MUST↔Evidence 1:1은 실행 시점에 재확인
- [ ] (skip) status=draft: Evidence 섹션(§6)은 실행 시점에 채움

### Plan Code Scope Cross-check (Gate, 필수)

- Plan link: plans/260126_01_firebat_pure-code-quality.md#Step-3

---

## 2) Scope (필수)

### Code Scope

- Packages/Areas:
  - `packages/firebat`
- Files to change (expected):
  - `packages/firebat/src/analyses/dependencies/`
  - `packages/firebat/src/analyses/coupling/`
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
  - packages/firebat/src/analyses/dependencies/: MUST-3
  - packages/firebat/src/analyses/coupling/: MUST-3
  - packages/firebat/src/report.ts: MUST-3
  - packages/firebat/src/types.ts: MUST-3

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

### Non-Goals

- 이 Task에서 다른 분석기(duplication/no-op 등)는 구현하지 않는다.

---

## 3) Hard Constraints (Gate, 필수)

- [ ] (skip) status=draft: SSOT(docs/10..50/\*\*) 변경 없음
- [ ] (skip) status=draft: Public Facade(packages/\*/index.ts export) 변경 없음
- [ ] (skip) status=draft: deps(package.json deps) 변경 없음
- [ ] (skip) status=draft: `bun run verify` 통과 (Evidence는 실행 시점에 기록)

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

- [ ] (skip) status=draft: `packages/firebat/src/firebat.ts`에서 분석기 실행 흐름/옵션 진입점 확인
- [ ] (skip) status=draft: import graph 입력 경계 정의(최소: tsconfig 파일 셋 → import edges) + 결과 타입 초안 작성
- [ ] (skip) status=draft: fan-in/fan-out, cycle 정의를 report 관점에서 확정(문서화는 Plan 변경 없이 Task 내부 메모로 유지)

### Implementation

- [ ] (skip) status=draft: `packages/firebat/src/analyses/dependencies/`에 분석기 모듈 스캐폴딩 추가(입력/출력 타입 포함)
- [ ] (skip) status=draft: `packages/firebat/src/analyses/coupling/`에 coupling(예: afferent/efferent) 분석기 스캐폴딩 추가
- [ ] (skip) status=draft: cycle 탐지(최소 SCC 또는 DFS back-edge) 결과를 report 스키마에 매핑(`packages/firebat/src/types.ts`)
- [ ] (skip) status=draft: fan-in/fan-out 산출(노드별 in/out degree) + 임계값/상위 N 정책을 report 스키마에 매핑
- [ ] (skip) status=draft: text/json 출력 경로에 dependencies 결과를 연결(`packages/firebat/src/report.ts`)

### Implementation Details (필수)

- `packages/firebat/src/analyses/dependencies/`: import edge 수집(최소: file -> imported files) 데이터 구조를 정의하고, fan-in/fan-out 및 cycle 입력으로 정규화한다.
- `packages/firebat/src/analyses/coupling/`: dependencies 결과(그래프 사실)를 받아 hotspot/우선순위용 coupling 지표를 계산하고, report 출력용 형상으로 변환한다.
- `packages/firebat/src/types.ts`: dependencies/coupling 결과 타입을 추가하고, report에서 참조되는 최소 스키마(필드명/배열 형상)를 고정한다.
- `packages/firebat/src/report.ts`: text/json 출력 경로에 새로운 analyses 결과를 연결하고, 누락/빈 결과(예: cycle 없음)도 안정적으로 직렬화한다.

### Verification (Gate)

- Gate command(s):
  - [ ] (skip) status=draft: `bun run verify`

---

## 6) Evidence (필수)

- Recon evidence: `none (status=draft)`
- Diff evidence:
  - Changed files (actual): `none (status=draft)`
- Verification evidence:
  - LOG-VERIFY: `none (status=draft)`
- MUST-EVID mapping:
  - MUST-EVID-3: `none (status=draft)`

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

## 9) Completion Criteria (필수)

- [ ] (skip) status=draft: Hard Constraints 4개 체크됨
- [ ] (skip) status=draft: Scope expected vs actual 정합(또는 Delta rule 기록)
- [ ] (skip) status=draft: Verification Gate 통과 (`bun run verify`)
- [ ] (skip) status=draft: Evidence가 충분함(Exit code 0 + 변경 파일 목록)

### Acceptance Criteria (draft, concrete)

- JSON 리포트에 dependencies 분석 결과가 포함된다(최소: cycle 목록 + fan-in/out 상위 항목 목록).
- cycle 항목은 “경로”를 갖는다(예: `["a.ts", "b.ts", "c.ts", "a.ts"]` 같은 형태).
- fan-in/out 항목은 파일(또는 모듈) 단위로 대상 + 수치(정수)를 포함한다.

### Output Example (draft)

```json
{
  "analyses": {
    "dependencies": {
      "cycles": [
        {
          "path": ["src/a.ts", "src/b.ts", "src/c.ts", "src/a.ts"]
        }
      ],
      "fanInTop": [{ "module": "src/core/index.ts", "count": 18 }],
      "fanOutTop": [{ "module": "src/features/heavy.ts", "count": 31 }]
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

---

## 8) Rollback (필수)

- 되돌리기 방법:
  - manual restore: 아래 파일/디렉토리의 변경을 되돌리고(또는 삭제), Task 문서를 원복
    - `packages/firebat/src/analyses/dependencies/`
    - `packages/firebat/src/analyses/coupling/`
    - `packages/firebat/src/report.ts`
    - `packages/firebat/src/types.ts`
    - `tasks/260126_01_firebat_pure-code-quality/260126_01_03_dependency-graph-smells.md`
