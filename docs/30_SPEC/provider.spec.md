# Provider Specification

L3 Implementation Contract
본 문서는 `Provider`에 대한 구현 계약이다.
본 계약은 기계적 검증 가능성(Mechanical Verifiability)을 최우선 기준으로 하며,
구현 방법, 튜토리얼, 사용 가이드를 포함하지 않는다.

---

## 1. Context

### 1.1 Purpose

본 SPEC은 Provider의 생명주기, 스코프, 리소스 관리 계약이 유효한 구현으로 성립하는 조건을 정의한다.

### 1.2 Scope & Boundary

본 SPEC은 init/dispose, scope, resource lifecycle을 판정 가능한 계약으로 고정한다.
다음 항목은 본 SPEC의 소유가 아니다:

- DI 그래프 연결 규칙 → di.spec.md에서 판정된다.

### 1.3 Definitions

Normative: 본 SPEC은 추가적인 용어 정의를 도입하지 않는다.

## 2. Static Shape

Normative: 본 SPEC은 추가적인 Static Shape를 정의하지 않는다.

---

## 3. Invariants & Constraints

- Provider 생명주기는 빌드 타임에 확정된 연결에 의해 결정되며 런타임 추론이 아니다.
- Scope 의미론은 빌드/부트 시점에 확정되며, 런타임 입력에 따라 암묵 변경되지 않는다.
- ContextId는 common.spec.md의 Identity Type이며, Provider SPEC은 ContextId의 포맷/생성/전파/소멸을 정의하지 않는다.

### 3.1 MUST

- Provider는 생성/초기화/종료 단계가 명확히 정의되어야 한다.

- Provider 초기화 순서는 의존성 그래프에 의해 결정되어야 한다.
  - Provider A가 Provider B에 의존한다면, B는 A보다 먼저 초기화되어야 한다.

- dispose가 필요한 Provider는 의존성 그래프의 역순으로 종료되어야 한다.
- Scope는 명시적으로 선언되거나 판정 가능해야 하며, 모호하면 빌드 실패로 판정되어야 한다.
- `singleton`은 프로세스/워커 단위로 1회 생성되어야 한다.
- `request`는 `ContextId`마다 별도 인스턴스를 생성해야 한다.
- `transient`는 주입 지점마다 새 인스턴스를 생성해야 한다.

- `singleton`이 `request` 의존을 사용할 때도 싱글톤 인스턴스는 재생성되지 않아야 한다.
  - `singleton` 생성 시점에 `request` 인스턴스를 생성하거나 캡처해서는 안 된다.
  - `request` 의존은 요청 컨텍스트(`ContextId`)가 존재하는 구간에서만 해석되어야 한다.

- NOTE: `singleton`이 `request` 의존을 사용할 때, 허용되는 형태는 “요청 컨텍스트가 존재하는 시점의 해석”이며
  `singleton` 초기화 시점에 request 인스턴스를 생성/보관하는 형태는 금지된다.
  - 예: `singleton`은 요청 컨텍스트가 존재하는 시점에만 `request` 인스턴스를 획득/사용하고, 그 참조를 장기 보관하지 않는다.

### 3.2 MUST NOT

- 종료가 필요한 Provider를 누락된 dispose로 방치하는 것을 “정상”으로 취급해서는 안 된다.
- 동일 Scope의 의미가 실행 모드에 따라 암묵적으로 바뀌어서는 안 된다.
- `request` 의존을 주입한다는 이유로 `singleton`을 재생성하는 동작을 허용해서는 안 된다.

---

## 4. Observable Semantics

Normative: 본 SPEC은 추가적인 Observable Semantics를 정의하지 않는다.

---

## 5. Violation Conditions

- Build-Time Violation: Provider scope가 판정 가능하지 않은데도 빌드가 성공하는 경우
- Runtime Violation: `singleton | request | transient` 의미를 위반하는 동작이 관측되는 경우
- Runtime Violation: `singleton` 재생성이 관측되는 경우
- Runtime Violation: `request` scope가 사용되는데 `ContextId`로 인스턴스 경계를 판정할 수 없는 동작이 관측되는 경우

---

## 6. Handoff & Priority

### 6.1 Handoff

- 빌드 실패 및 위반 조건의 진단 출력은 diagnostics.spec.md의 형식을 따라야 한다.

### 6.2 Layer Priority

본 SPEC은 L3에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 상위 문서가 우선한다.
