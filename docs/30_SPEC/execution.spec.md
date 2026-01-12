# Execution Specification

L3 Implementation Contract
본 문서는 `Execution`에 대한 구현 계약이다.
본 계약은 기계적 검증 가능성(Mechanical Verifiability)을 최우선 기준으로 하며,
구현 방법, 튜토리얼, 사용 가이드를 포함하지 않는다.

---

## 1. Context

### 1.1 Purpose

본 SPEC은 Bunner의 정상 실행(정상 경로) 의미론과 Result 기반 흐름이 유효한 구현으로 성립하는 조건을 정의한다.

### 1.2 Scope & Boundary

본 SPEC은 어댑터가 정적으로 선언한 Pipeline을 따라 수행되는 정상 실행 의미론을 판정 가능한 계약으로 고정한다.
다음 항목은 본 SPEC의 소유가 아니다:

- throw로 발생한 예외의 처리(필터 체인) → error-handling.spec.md에서 판정된다.
- 프로토콜별 입출력 표현 → adapter.spec.md에서 판정된다.

### 1.3 Definitions

- Normal Path: 예외(throw)가 발생하지 않는 실행 경로.

---

## 2. Static Shape

Normative: 본 SPEC은 추가적인 Static Shape를 정의하지 않는다.

---

## 3. Invariants & Constraints

- 정상 실행은 Result(또는 공통 결과 계약)에 의해 표현된다.
- 실행 흐름은 어댑터 개발자가 직관적으로 구성할 수 있는 모델이어야 한다.

### 3.1 MUST

- 정상 실행은 Result 기반 흐름으로 표현되어야 한다. (Result 형태는 common.spec.md에 의해 정의된다)
- 정상 실행은 어댑터가 정적으로 선언한 Pipeline을 따라 수행되어야 한다.
- Structural Context Propagation이 지원되어야 한다. (컨텍스트는 Pipeline을 따라 각 step 호출에 전달되어야 한다)
- 런타임 구성 요소는 빌드 타임에 확정된 정적 연결 관계만을 따른다. (ARCHITECTURE의 Static Context Binding 전제)

- Pipe에 등록되지 않은 변환(transform) 및 검증(validate)을 실행 흐름에 암묵적으로 삽입하거나 추론해서는 안 된다. (INVARIANTS의 No Implicit Pipe 전제)

- Middleware/Guard/Pipe/Handler/Error Filter는 DI wiring의 노드로 취급되어야 하며,
  빌드 타임에 확정된 연결에 의해 의존성이 제공되어야 한다.

- App-External Code에서 DI 결과에 접근해야 하는 경우, 접근 경로는 `app.get(Token)`이어야 한다.
- `app.get(Token)`의 성공 조건 및 위반 조건은 di.spec.md의 규칙과 일치해야 한다.

### 3.2 MUST NOT

- 정상 실행 흐름을 런타임에서 동적으로 재구성하거나, 구조를 추론해서는 안 된다.
- 사용자 함수 본문을 재작성하여 실행 의미론을 강제해서는 안 된다.

- 런타임에서 DI 의존을 해결(resolve)하기 위한 컨테이너 조회를 실행 흐름의 일부로 포함해서는 안 된다.

---

## 4. Observable Semantics

Normative: 본 SPEC은 추가적인 Observable Semantics를 정의하지 않는다.

---

## 5. Violation Conditions

- Runtime Violation: Normal Path에서 예외(throw)가 관측되는 경우
- Runtime Violation: 실행 단계가 어댑터가 정적으로 선언한 Pipeline 순서를 위반하는 경우
- 빌드 실패 및 위반 조건의 진단 출력은 diagnostics.spec.md의 형식을 따라야 한다.

---

## 6. Handoff & Priority

### 6.1 Handoff

- throw가 발생하면 정상 실행은 즉시 이탈하며, 예외는 error-handling.spec.md의 Internal Error Filter로 이관된다.
- Guard가 거부(Result/Failure)하는 경우 Handler는 실행되지 않으며, 어댑터는 Result 경로로 응답을 생성해야 한다.
- 실행 구성(어댑터별 wiring/초기화)은 adapter.spec.md 및 manifest.spec.md로 이관된다.

### 6.2 Layer Priority

본 SPEC은 L3에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 상위 문서가 우선한다.
