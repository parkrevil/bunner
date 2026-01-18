# FFI Specification

L3 Implementation Contract
본 문서는 `FFI`에 대한 구현 계약이다.
본 계약은 기계적 검증 가능성(Mechanical Verifiability)을 최우선 기준으로 하며,
구현 방법, 튜토리얼, 사용 가이드를 포함하지 않는다.

---

## 1. Context

### 1.1 Purpose

본 SPEC은 Rust FFI 기반 확장/어댑터 코어가 구현 대상일 때, 안전/경계/호출 규약이 유효한 구현으로 성립하는 조건을 정의한다.

### 1.2 Scope & Boundary

본 SPEC은 FFI 경계에서의 안정성, 호출 규약, 실패 모델을 판정 가능한 계약으로 고정한다.
다음 항목은 본 SPEC의 소유가 아니다:

- 구체 ABI/언어별 튜토리얼 → 가이드 문서 범위다.

### 1.3 Definitions

Normative: 본 SPEC은 추가적인 용어 정의를 도입하지 않는다.

---

## 2. Static Shape

Normative: 본 SPEC은 추가적인 Static Shape를 정의하지 않는다.

---

## 3. Invariants & Constraints

- FFI는 Engine/Runtime 불변식(Bun only, build-time intelligence)을 침범하지 않는다.

### 3.1 MUST

- FFI는 Engine/Runtime 불변식(Bun only, build-time intelligence)을 침범해서는 안 된다.

### 3.2 MUST NOT

- FFI 오류를 메시지 파싱 등 추측으로 분류해서는 안 된다.
- 메모리/리소스 소유권이 불명확한 호출 형태를 허용해서는 안 된다.

---

## 4. Observable Semantics

Normative: 본 SPEC은 추가적인 Observable Semantics를 정의하지 않는다.

---

## 5. Violation Conditions

- Build-Time Violation: FFI 호출 규약/소유권이 판정 가능하도록 정의되지 않았는데도 빌드가 성공하는 경우

---

## 6. Handoff & Priority

### 6.1 Handoff

- 오류 모델은 common.spec.md 및 error-handling.spec.md를 따른다.

- 빌드 실패 및 위반 조건의 진단 출력은 diagnostics.spec.md의 형식을 따라야 한다.

### 6.2 Layer Priority

본 SPEC은 L3에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 상위 문서가 우선한다.
