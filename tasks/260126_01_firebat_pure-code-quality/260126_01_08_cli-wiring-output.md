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
  - `packages/firebat/src/types.ts`

- Files to read (required to understand change):
  - `packages/firebat/src/arg-parse.ts`
  - `packages/firebat/src/firebat.ts`
  - `packages/firebat/src/report.ts`

- Allowed paths (MUST, copy from Plan):
  - `packages/firebat/**`
  - `tooling/**`
  - `plans/**`
  - `tasks/**`

- File → MUST IDs 매핑 (MUST, copy from Plan Step):
  - packages/firebat/src/arg-parse.ts: MUST-8
  - packages/firebat/src/firebat.ts: MUST-8
  - packages/firebat/src/report.ts: MUST-8
  - packages/firebat/src/types.ts: MUST-8

- Public API impact:
  - `internal-only`

### Directory Plan (필수)

- none

### File Relations (필수)

- `packages/firebat/src/firebat.ts` -> `packages/firebat/src/arg-parse.ts`: import

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

- [ ] (skip) status=draft: 현재 옵션 파싱/실행 분기 확인(`packages/firebat/src/arg-parse.ts`, `packages/firebat/src/firebat.ts`)
- [ ] (skip) status=draft: `--only` 현재 의미(duplicates/waste 등)와 신규 분석기 확장 방식(옵션/enum)을 정리

### Implementation

- [ ] (skip) status=draft: 옵션 스키마 확장(`packages/firebat/src/arg-parse.ts`: 신규 분석기 선택 가능)
- [ ] (skip) status=draft: 실행 wiring 추가(`packages/firebat/src/firebat.ts`: 선택된 분석기만 실행)
- [ ] (skip) status=draft: json 출력 안정화(`packages/firebat/src/report.ts`: `--format json` 유지 + 신규 필드 추가)
- [ ] (skip) status=draft: detector 타입 확장(`packages/firebat/src/types.ts`: CLI/분석기 키 정렬)

### Implementation Details (필수)

- `packages/firebat/src/types.ts`: CLI에서 선택 가능한 detector id를 타입으로 고정하고, vNext `analyses`의 canonical key를 정의한다.
- `packages/firebat/src/arg-parse.ts`: `--only` 허용 목록에 신규 detector id를 추가한다.
- `packages/firebat/src/firebat.ts`: 선택된 detector 목록을 meta에 반영하고, vNext `analyses` 구조를 안정적으로 채운다.
- `packages/firebat/src/report.ts`: text/json 출력에서 `analyses` 구조를 유지하며 JSON 출력은 순수 JSON만 출력한다.

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
  - manual restore: 아래 파일의 변경을 되돌리고(또는 삭제), Task 문서를 원복
    - `packages/firebat/src/arg-parse.ts`
    - `packages/firebat/src/firebat.ts`
    - `packages/firebat/src/report.ts`
    - `tasks/260126_01_firebat_pure-code-quality/260126_01_08_cli-wiring-output.md`

---

## 9) Completion Criteria (필수)

- [ ] (skip) status=draft: Hard Constraints 4개 체크됨
- [ ] (skip) status=draft: Scope expected vs actual 정합(또는 Delta rule 기록)
- [ ] (skip) status=draft: Verification Gate 통과 (`bun run verify`)
- [ ] (skip) status=draft: Evidence가 충분함(Exit code 0 + 변경 파일 목록)

### Acceptance Criteria (draft, concrete)

- `--only`(또는 동등한 옵션)로 신규 분석기 선택 실행이 가능하다(예: `dependencies`, `coupling`, `nesting`, `early-return`, `noop`, `api-drift` 등).
- `--format json` 출력은 안정적으로 JSON만 출력한다(추가 로그/프리픽스 없이 `console.log(JSON.stringify(...))` 계열 유지).
- `--format text`는 기존처럼 사람이 읽는 형태로 출력되며, 신규 분석기 결과가 추가되더라도 기본 헤더 라인이 유지된다.

### Output Example (draft)

CLI 예시(형태만, 최종 help 문구는 구현에 따름):

```text
$ bun tooling/firebat/index.ts --help
...
--only <list>            Limit detectors to duplicates,waste,dependencies,coupling,duplication,nesting,early-return,noop,api-drift
...
```

JSON 출력 예시:

```json
{
  "meta": {
    "engine": "oxc",
    "version": "2.0.0-strict",
    "tsconfigPath": "/abs/path/tsconfig.json",
    "targetCount": 42,
    "minTokens": 60,
    "detectors": ["dependencies", "coupling", "nesting", "early-return"]
  },
  "analyses": {
    "duplicates": [],
    "waste": [],
    "dependencies": {
      "cycles": [],
      "fanInTop": [],
      "fanOutTop": []
    },
    "coupling": {
      "hotspots": []
    },
    "nesting": {
      "items": []
    },
    "earlyReturn": {
      "items": []
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
