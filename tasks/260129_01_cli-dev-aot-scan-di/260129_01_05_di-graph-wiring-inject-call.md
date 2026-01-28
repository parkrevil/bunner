# Task

## A) Mechanical Status (필수)

- Status: `draft`
- Blocked reason (status=blocked): `none`
- Review mode: `self-review`

---

## 0) Metadata (필수)

- Task ID: `260129_01_05_di-graph-wiring-inject-call`
- Created at (UTC): `2026-01-29`
- Updated at (UTC): `2026-01-29`
- Owner: `user`
- Reviewer: `none`
- Target branch: `main`
- PR: `none`
- Related Plan:
  - Plan ID: `260129_01_cli-dev-aot-scan-di`
  - Link: plans/260129_01_cli-dev-aot-scan-di.md#Step-5
- Plan Step:
  - Step name: `DI Graph 구성(순환/위반은 build 실패)`
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
  - `plans/260129_01_cli-dev-aot-scan-di.md`
- 이 Task가 수행하는 Plan Step:
  - `Step 5: DI Graph 구성(순환/위반은 build 실패)`

---

## 1.1) Plan ↔ Task Traceability (Gate, 필수)

### Plan Extract (원문 복사, 필수)

```text
Goal: 빌드타임에서 DI 그래프를 구성하고, 런타임 스캔/리플렉션 없이 wiring을 생성한다.
Gate: cycle/visibility/scope 위반은 build 실패
```

| MUST ID | Evidence ID | Step |
| ------ | ----------- | ---- |
| MUST-5 | MUST-EVID-5 | Step 5 |
| MUST-6 | MUST-EVID-6 | Step 5 |
| MUST-7 | MUST-EVID-7 | Step 5 |
| MUST-9 | MUST-EVID-9 | Step 5 |

- MUST IDs covered by this Task (필수):
  - MUST-5
  - MUST-6
  - MUST-7
  - MUST-9
- Evidence IDs produced by this Task (필수):
  - MUST-EVID-5
  - MUST-EVID-6
  - MUST-EVID-7
  - MUST-EVID-9

### Plan Code Scope Cross-check (Gate, 필수)

- Plan link: plans/260129_01_cli-dev-aot-scan-di.md#Step-5

---

## 2) Scope (필수)

### Code Scope

- Packages/Areas:
  - `packages/common`
  - `packages/cli`
- Files to change (expected):
  - `packages/common/src/helpers.ts`
  - `packages/cli/src/analyzer/ast-parser.ts`
  - `packages/cli/src/analyzer/graph/module-graph.ts`
  - `packages/cli/src/generator/injector.ts`
- Files to read (required to understand change):
  - `packages/common/src/helpers.ts`
  - `packages/common/src/interfaces.ts`
  - `packages/cli/src/analyzer/ast-parser.ts`
  - `packages/cli/src/analyzer/graph/module-graph.ts`
  - `packages/cli/src/generator/injector.ts`
  - `packages/cli/src/generator/manifest.ts`
  - `packages/core/src/injector/container.ts`
  - `docs/30_SPEC/di/di.spec.md`
- Allowed paths (MUST, copy from Plan):
  - `packages/cli/**`
  - `packages/core/**`
  - `packages/common/**`
  - `tooling/**`
  - `examples/**`
  - `plans/**`
  - `tasks/**`

- File → MUST IDs 매핑 (MUST, copy from Plan Step):
  - `packages/common/src/helpers.ts`: MUST-5, MUST-6, MUST-7, MUST-9
  - `packages/cli/src/analyzer/ast-parser.ts`: MUST-5, MUST-6, MUST-7, MUST-9
  - `packages/cli/src/analyzer/graph/module-graph.ts`: MUST-5, MUST-6, MUST-7, MUST-9
  - `packages/cli/src/generator/injector.ts`: MUST-5, MUST-6, MUST-7, MUST-9

- Public API impact:
  - `internal-only (단, inject-call 표면 확정 시 재평가 필요)`

### Directory Plan (필수)

- none

### File Relations (필수)

- `packages/cli/src/analyzer/graph/module-graph.ts` -> `packages/cli/src/analyzer/ast-parser.ts`: consumes inject-call metadata
- `packages/cli/src/generator/injector.ts` -> `packages/cli/src/analyzer/graph/module-graph.ts`: uses resolved provider graph to emit wiring

Scope delta rule (MUST):

- Delta summary: `none (status=blocked)`
- Delta reason: `inject-call 표면 확정 전까지 구현 상세가 결정 불가`
- Plan impact: `none (status=blocked)`

### Non-Goals

- 이 Task에서 런타임 컨테이너 스캐닝을 “개선”하거나 “삭제”하는 리팩터링은 하지 않는다(별도 Plan 필요).

---

## 3) Hard Constraints (Gate, 필수)

- [ ] (skip) status=blocked: SSOT(docs/10..50/**) 변경 없음
- [ ] (skip) status=blocked: Public Facade(packages/*/index.ts export) 변경 없음
- [ ] (skip) status=blocked: deps(package.json deps) 변경 없음
- [ ] (skip) status=blocked: `bun run verify` 통과

---

## 4) Preconditions (필수)

- Decision required (BLOCKING):
  - none

Baseline 기록 (필수):

- Baseline required by Plan Step gate?: `no`
- Baseline verify: `not-run`
- Baseline skip reason (if required=no and not-run): `status=blocked`

---

## 5) Execution Checklist (필수)

### Recon (변경 전 필수)

- [ ] `packages/common/src/helpers.ts`의 `inject` 현재 동작(placeholder)과 노출 경로(재-export 여부) 확인
- [ ] `packages/cli/src/generator/injector.ts`가 provider `inject` 배열을 어떻게 사용해 runtime wiring을 생성하는지 확인

### Implementation

- [ ] `packages/cli/src/analyzer/ast-parser.ts`: inject-call 표면을 call-expression으로 수집/정규화
  - `inject(Token)`
  - `inject(() => Token)` (TokenThunk 허용)
  - 단, TokenThunk는 런타임에 실행되면 안 되므로 AOT는 thunk를 "호출"하지 않고 AST에서 Token을 기계적으로 해석한다
- [ ] `packages/cli/src/analyzer/graph/module-graph.ts`: 수집된 inject-call을 provider deps로 편입하고 cycle detection/visibility/scope 검증 대상으로 포함
- [ ] `packages/cli/src/generator/injector.ts`: build-time wiring 결과가 runtime token resolution 없이 동작하도록(InjectCall 대체) 생성 로직 정렬
- [ ] `packages/common/src/helpers.ts`: 런타임에서 `inject()` 실행이 관측되면 즉시 실패하도록 처리(= DI-R-008 위반을 조기 탐지)

### Implementation Details (필수)

- `packages/cli/src/analyzer/ast-parser.ts`: inject-call token은 아래 형태만 수집한다.
  - `inject(Token)` where Token is mechanically resolvable Token form (class token or symbol token)
  - `inject(() => Token)` where TokenThunk body is mechanically resolvable (no runtime execution)
  - 그 외(동적 계산/조건부/호출 결과 등)는 "token not statically determinable"로 build failure로 연결될 수 있도록 식별자/위치를 함께 보관
- `packages/cli/src/analyzer/graph/module-graph.ts`: deps가 포함된 후 `detectCycles()` 및 `validateVisibilityAndScope()`가 inject-call 기반 deps까지 포함하도록 데이터 경로를 연결
- `packages/cli/src/generator/injector.ts`: `ProviderUseFactory.inject`/deps 배열을 기반으로 `c.get(...)` 호출을 생성하되, “inject-call 자체”가 runtime resolution을 수행하지 않도록 보장
- `packages/common/src/helpers.ts`: inject-call이 런타임에 남아 실행되면 즉시 throw 하여 "런타임 inject() reachable"을 금지한다(DI-R-008).
  - TokenThunk가 전달되더라도 절대 호출하지 않는다(COMMON-DECLARATIONS-R-008).

### Verification (Gate)

- Gate command(s):
  - [ ] (skip) status=blocked: `bun run verify`
- Expected result:
  - [ ] (skip) status=blocked: Exit code 0

---

## 6) Evidence (필수)

- Recon evidence: `none (status=blocked)`
- Diff evidence:
  - Changed files (actual): `none (status=blocked)`
- Verification evidence:
  - LOG-VERIFY: `none (status=blocked)`
- MUST-EVID mapping:
  - MUST-EVID-5: `none (status=blocked)`
  - MUST-EVID-6: `none (status=blocked)`
  - MUST-EVID-7: `none (status=blocked)`
  - MUST-EVID-9: `none (status=blocked)`

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
    - `packages/common/src/helpers.ts`
    - `packages/cli/src/analyzer/ast-parser.ts`
    - `packages/cli/src/analyzer/graph/module-graph.ts`
    - `packages/cli/src/generator/injector.ts`
    - `tasks/260129_01_cli-dev-aot-scan-di/260129_01_05_di-graph-wiring-inject-call.md`

---

## 9) Completion Criteria (필수)

- [ ] (skip) status=blocked: BLOCKING Preconditions 2개 해소
- [ ] (skip) status=blocked: Verification Gate 통과 (`bun run verify`)

---

## 10) Reviewer Mechanical Checklist (리뷰어용, 필수)

- [ ] (skip) status=blocked: Plan link/Allowed paths/파일 경로 매칭 규칙 통과
