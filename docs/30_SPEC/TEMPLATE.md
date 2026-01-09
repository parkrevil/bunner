# `[Feature Name]` Specification

L3 Implementation Contract
본 문서는 `[기능명]`에 대한 구현 계약이다.
본 계약은 기계적 검증 가능성(Mechanical Verifiability)을 최우선 기준으로 하며,
구현 방법, 튜토리얼, 사용 가이드를 포함하지 않는다.

---

## 1. Context

### 1.1 Purpose

본 SPEC은 `[기능명]`이 유효한 구현으로 판정되기 위한
형상 및 관측 가능한 행동의 최소 계약을 정의한다.

### 1.2 Scope & Boundary

- In-Scope: 본 SPEC이 직접 형상 또는 관측 규칙을 고정하는 대상
- Out-of-Scope: 본 SPEC이 정의하지 않는 영역
  (타 SPEC에서 정의되는 계약, 엔지니어링 선택, 구현 상세)

---

## 2. Static Shape

본 섹션은 CLI, 정적 분석기, 코드 생성기가 참조하는
데이터 형상(Data Shape)만을 정의한다.

허용됨:

- interface (data-only)
- type
- enum
- JSON Schema

금지됨:

- function / method signature
- 실행 단위(API, 클래스 메서드)
- 로직, 알고리즘
- 예시를 통한 암묵적 의미론 부여

### 2.1 Core Data Shapes

Normative: 아래에 정의된 형상이 계약이다.

ContractData:

- kind: "A", payload: unknown
- kind: "B", payload: unknown

(discriminant에 의해 상호 배타적으로 구분되어야 한다)

### 2.2 Metadata Shapes

Key: bunner:`[feature]`:meta

Value Shape:

- type: object
- required: `["scope"]`
- properties:
  - scope: string (allowed values: "singleton", "transient")
- additionalProperties: false

### 2.3 Shape Conformance Rules

- 본 SPEC에 정의되지 않은 필드는 존재해서는 안 된다.
- 필수 필드 누락은 빌드 타임 위반으로 판정한다.
- discriminant로 구분되지 않는 형상은 무효다.

---

## 3. Invariants & Constraints

본 섹션은 구현체가 절대 위반해서는 안 되는 전역 제약을 정의한다.
이 제약은 형상과 의미 해석의 기준으로 작동한다.

### 3.1 MUST

- 시스템은 본 SPEC에 정의된 형상만을 사용해야 한다.
- 형상 검증은 빌드 타임에 수행 가능해야 한다.

### 3.2 MUST NOT

- 정의되지 않은 필드를 런타임에 생성하거나 전달해서는 안 된다.
- 형상에 의해 구분되지 않는 상태를 허용해서는 안 된다.

---

## 4. Observable Semantics

본 섹션은 코드 없이 텍스트로만 기술한다.
내부 구현 방식은 금지되며, 외부에서 관측 가능한 결과만 정의한다.

제약:

- Protocol-Agnostic
- 특정 프로토콜(HTTP, gRPC 등)의 용어 사용 금지

### 4.1 Input / Observable Outcome

- Input: `[조건]`
- Observable:
  - 입력이 유효하지 않은 경우, InvalidInput Failure가 관측되어야 한다.
  - 정상 입력의 경우, 계약된 형상의 성공 결과가 관측되어야 한다.

### 4.2 State Conditions

- 실행 이전 상태에서는 관측 가능한 결과가 생성되어서는 안 된다.
- 종료 이후에는 새로운 관측 결과가 발생해서는 안 된다.

---

## 5. Violation Conditions

- Build-Time Violation: 정적 형상이 계약과 일치하지 않는 경우
- Runtime Violation: 관측 가능한 결과가 본 SPEC의 규칙을 위반한 경우
- Test-Level Violation: 동일 입력에 대해 상이한 관측 결과가 발생한 경우

---

## 6. Handoff & Priority

### 6.1 Handoff

- `[항목명]` -> `[TargetSpec.md]`

### 6.2 Layer Priority

본 문서는 L3 SPEC에 속한다.
L2 ARCHITECTURE 또는 L1 FOUNDATION과 충돌할 경우,
본 SPEC은 무효로 판정된다.
