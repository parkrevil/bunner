# Error Handling Specification

L3 Implementation Contract
본 문서는 `Error Handling`에 대한 구현 계약이다.
본 계약은 기계적 검증 가능성(Mechanical Verifiability)을 최우선 기준으로 하며,
구현 방법, 튜토리얼, 사용 가이드를 포함하지 않는다.

---

## 1. Context

### 1.1 Purpose

본 SPEC은 Error(값 흐름)와 Panic(throw 경로)의 분리 및 Exception Filter Chain이 유효한 구현으로 성립하는 조건을 정의한다.

### 1.2 Scope & Boundary

본 SPEC은 throw로 발생하는 예외를 표준 결과(Result)로 변환하기 위한 Exception Filter Chain의 계약을 고정한다.
다음 항목은 본 SPEC의 소유가 아니다:

- 프로토콜별 최종 오류 표현(HTTP 상태 코드 등) → adapter.spec.md에서 판정된다.
- 정상 실행의 단계 구성 → execution.spec.md에서 판정된다.

### 1.3 Definitions

Normative: 본 SPEC은 추가적인 용어 정의를 도입하지 않는다.

---

## 2. Static Shape

Normative: 본 SPEC은 추가적인 Static Shape를 정의하지 않는다.

---

## 3. Invariants & Constraints

- 사용자는 인프라 예외에 대해 수동 try-catch를 작성할 필요 없이, 프레임워크가 생성한 필터 체인을 통해 예외가 표준 Result로 변환됨을 보장받는다.

### 3.1 MUST

- Error는 값 흐름(Result)으로 표현되어야 한다.
- Panic(throw)은 Exception Filter Chain을 통해 표준 Result로 변환되어야 한다.
- throw로 발생한 예외는 Exception Filter Chain을 통해 처리되어야 한다.
- Exception Filter Chain의 적용 순서/우선순위는 판정 가능해야 한다.
- 필터 체인이 예외를 Result의 Error 케이스로 변환할 때, 그 최소 형상은 common.spec.md의 Result 계약을 따른다.

### 3.2 MUST NOT

- Error를 throw로 표현하거나, Panic을 값 흐름으로 전달해서는 안 된다.
- 프로토콜 종속 정보(HTTP 상태 코드 등)를 도메인 에러 정의에 포함시켜서는 안 된다. (매핑은 어댑터에서 수행)
- 예외 처리에서 “추측 기반 분류”(문자열/메시지 파싱으로 Panic/Error를 판정)를 허용해서는 안 된다.

---

## 4. Observable Semantics

Normative: 본 SPEC은 추가적인 Observable Semantics를 정의하지 않는다.

---

## 5. Violation Conditions

- 예외가 필터 체인을 거치지 않고 누락/삼켜지는 경우
- Error/Panic 판정이 예외 메시지/문자열 파싱에 의존하는 경우

---

## 6. Handoff & Priority

### 6.1 Handoff

- 최종 표현(상태 코드/프레임 등)은 adapter.spec.md로 이관된다.
  - 어댑터는 Exception Filter Chain이 산출한 Result를 프로토콜 응답으로 렌더링해야 한다.

- 빌드 실패 및 위반 조건의 진단 출력은 diagnostics.spec.md의 형식을 따라야 한다.

### 6.2 Layer Priority

본 SPEC은 L3에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 상위 문서가 우선한다.
