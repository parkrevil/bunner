# Adapter Specification

L3 Implementation Contract
본 문서는 `Adapter`에 대한 구현 계약이다.
본 계약은 기계적 검증 가능성(Mechanical Verifiability)을 최우선 기준으로 하며,
구현 방법, 튜토리얼, 사용 가이드를 포함하지 않는다.

---

## 1. Context

### 1.1 Purpose

본 SPEC은 프로토콜 격리 및 다중 어댑터 지원이 유효한 구현으로 성립하는 조건을 정의한다.

### 1.2 Scope & Boundary

본 SPEC은 Core가 프로토콜을 모르도록 유지하면서, 어댑터가 입출력/수명주기/최종 표현 책임을 가지는 계약을 고정한다.
다음 항목은 본 SPEC의 소유가 아니다:

- 실행의 정상 흐름 의미론(Result/단계) → execution.spec.md에서 판정된다.
- 에러의 의미론(필터 체인, Failure/Panic) → error-handling.spec.md에서 판정된다.

### 1.3 Definitions

---

## 2. Static Shape

어댑터는 아래 Static Shape를 만족하는 정적 명세를 제공해야 한다.

- Adapter Static Spec
  - `pipeline`: `Stage[]` (순서가 있는 리스트)

- `Stage`
  - `kind`: `middleware | guard | pipe | handler`
  - `id`: `string` (어댑터 내에서 안정적인 식별자)
  - `pipeSteps?`: `PipeStep[]` (`kind = pipe`인 경우에만 존재)

- `PipeStep`
  - `kind`: `transform | validate | custom`
  - `id`: `string` (어댑터 내에서 안정적인 식별자)

Static Shape의 구체적 직렬화 형식 및 저장 위치는 manifest.spec.md에서 판정된다.

---

## 3. Invariants & Constraints

- Core는 어댑터의 존재를 전제로 설계되어서는 안 된다. (L2 아키텍처 경계 전제)

### 3.1 MUST

- 어댑터는 프로토콜 입력을 실행 모델로 전달할 수 있어야 한다.
- 어댑터는 Result/Failure/Panic을 프로토콜 표현으로 변환해야 한다. (매핑 규칙은 어댑터 소유)
- 어댑터는 `pipeline`(순서 포함)을 정적으로 선언해야 한다.
- `pipeline`은 최소 1개의 `handler` stage를 포함해야 한다.
- `kind = pipe`인 stage는 `pipeSteps`를 순서대로 포함해야 한다.

- 어댑터의 정적 명세를 기반으로 Wiring 코드가 생성되어야 한다.

- transform/validate는 Pipe에 명시적으로 등록된 경우에만 실행되어야 한다. (INVARIANTS의 No Implicit Pipe 전제)
- 사용자가 특정 어댑터에 대해 pipe step을 등록(활성화)하려는 경우,
  등록 대상 step은 반드시 해당 어댑터의 Static Shape(`pipeline` 및 `pipeSteps`)에 존재해야 한다.
  이를 만족하지 못하면 빌드 실패로 판정되어야 한다.

### 3.2 MUST NOT

- 어댑터가 Core 내부 로직을 침범하여 구조 판정/추론을 수행해서는 안 된다.
- 어댑터 간 결합이 암묵적으로 발생해서는 안 된다.

---

## 4. Observable Semantics

Normative: 본 SPEC은 추가적인 Observable Semantics를 정의하지 않는다.

---

## 5. Violation Conditions

- Build-Time Violation: Adapter Static Spec에 `pipeline`이 없는데도 빌드가 성공하는 경우
- Build-Time Violation: `pipeline`에 `handler` stage가 없는데도 빌드가 성공하는 경우
- Build-Time Violation: `kind = pipe` stage가 `pipeSteps` 없이 존재하는데도 빌드가 성공하는 경우
- Build-Time Violation: `pipeSteps`가 결정적 순서를 갖지 못하는데도 빌드가 성공하는 경우
- Build-Time Violation: 사용자가 등록(활성화)하려는 pipe step이 어댑터 Static Shape에 존재하지 않는데도 빌드가 성공하는 경우

---

## 6. Handoff & Priority

### 6.1 Handoff

- 어댑터의 정적 명세/산출물은 manifest.spec.md로 직렬화된다.
- 프로토콜별 문서(OpenAPI/AsyncAPI) 생성은 docs.spec.md로 이관된다.

### 6.2 Layer Priority

본 SPEC은 L3에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 상위 문서가 우선한다.
