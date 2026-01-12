# Logger & Observability Specification

L3 Implementation Contract
본 문서는 `Logger & Observability`에 대한 구현 계약이다.
본 계약은 기계적 검증 가능성(Mechanical Verifiability)을 최우선 기준으로 하며,
구현 방법, 튜토리얼, 사용 가이드를 포함하지 않는다.

---

## 1. Context

### 1.1 Purpose

본 SPEC은 로깅/관측이 ‘실패 이해 가능성’을 충족하기 위해 제공해야 하는 최소 계약을 정의한다.

### 1.2 Scope & Boundary

본 SPEC은 구조적 로그, 상관관계(Context), 에러 리포팅의 최소 필드를 판정 가능한 계약으로 고정한다.
다음 항목은 본 SPEC의 소유가 아니다:

- 로그 저장소/전송/백엔드 선택 → 구현 세부이며 본 SPEC 범위 밖이다.
- 프로토콜별 오류 표현 → adapter.spec.md에서 판정된다.

### 1.3 Definitions

- Structured Log: 키-값 기반으로 파싱 가능한 로그 이벤트.
- Correlation: 하나의 요청/작업/실행 흐름을 연결하는 식별자/컨텍스트.

---

## 2. Static Shape

Normative: 본 SPEC은 추가적인 Static Shape를 정의하지 않는다.

---

## 3. Invariants & Constraints

- 실패는 이해 가능한 형태로 관측 가능해야 한다.

### 3.1 MUST

- 로그 이벤트는 구조화된 형태로 표현될 수 있어야 한다.
- 실행 컨텍스트(Structural Context)와 로그 이벤트가 연결되어야 한다.
- Panic(System Error) 및 Error는 로그에서 구분 가능해야 한다.

### 3.2 MUST NOT

- 로그가 실행 의미론을 변경하도록(예: 로깅 실패로 요청 실패) 설계해서는 안 된다.
- 상관관계가 없어서 원인 추적이 불가능한 수준의 관측성을 “정상”으로 취급해서는 안 된다.

---

## 4. Observable Semantics

Normative: 본 SPEC은 추가적인 Observable Semantics를 정의하지 않는다.

---

## 5. Violation Conditions

- Panic/Error 구분이 관측 불가능한 경우
- Runtime Violation: 상관관계(Correlation)가 없어 원인 추적이 불가능한 수준의 로그가 생성되는 것이 관측되는 경우

---

## 6. Handoff & Priority

### 6.1 Handoff

- 빌드 실패 및 위반 조건의 진단 출력은 diagnostics.spec.md의 형식을 따라야 한다.

### 6.2 Layer Priority

본 SPEC은 L3에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 상위 문서가 우선한다.
