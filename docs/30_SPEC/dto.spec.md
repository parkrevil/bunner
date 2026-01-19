# DTO & Schema Specification

L3 Implementation Contract
본 문서는 `DTO & Schema`에 대한 구현 계약이다.
본 계약은 기계적 검증 가능성(Mechanical Verifiability)을 최우선 기준으로 하며,
구현 방법, 튜토리얼, 사용 가이드를 포함하지 않는다.

---

## 1. Context

### 1.1 Purpose

본 SPEC은 DTO 정의와 스키마 기반 변환/검증이 유효한 구현으로 성립하는 조건을 정의한다.

### 1.2 Scope & Boundary

본 SPEC은 DTO(전송 객체)와 DTO 기반 변환/검증이 유효한 구현으로 성립하는 조건을 고정한다.
다음 항목은 본 SPEC의 소유가 아니다:

- 프로토콜별 직렬화 표현 → adapter.spec.md에서 판정된다. (단, 공통 스키마/타입은 본 SPEC 소유)
- OpenAPI/AsyncAPI 산출물 생성 → docs.spec.md에서 판정된다.

### 1.3 Definitions

Normative: 본 SPEC은 추가적인 용어 정의를 도입하지 않는다.

## 2. Static Shape

DtoFieldName:

- type: string

DtoFieldSchema:

- type: object
- required:
  - type
- properties:
  - type:
    - type: string
    - allowed values:
      - string
      - number
      - boolean
      - array
      - object
  - items:
    - type: DtoFieldSchema
    - meaning: type이 array인 경우의 요소 스키마
  - ref:
    - type: string
    - meaning: type이 object이고 다른 DTO를 참조하는 경우의 참조 문자열

DtoSchema:

- type: object
- required:
  - type
  - properties
- properties:
  - type:
    - type: literal "object"
  - properties:
    - type: object
    - keys: DtoFieldName
    - values: DtoFieldSchema
  - required:
    - type: array
    - items: DtoFieldName
    - meaning: optional이 아닌 필드 이름의 결정적 리스트
    - ordering: field name ascending (lexicographic)

SchemaGeneratableFieldType:

- meaning: DTO 스키마 생성기가 허용하는 필드 타입의 최소 집합
- allowed forms (type-level):
  - string
  - number
  - boolean
  - array of SchemaGeneratableFieldType
  - reference to another DTO class

---

## 3. Invariants & Constraints

- DTO/Schema는 빌드 타임에서 판정 가능해야 하며, 런타임 추론에 의존하지 않는다.

### 3.1 MUST

- DTO는 class로 선언되어야 한다.
- DTO 스키마는 DTO class의 instance field declarations만을 입력으로 하여 생성되어야 한다.
  - static field는 입력에 포함되어서는 안 된다.

- DTO 스키마 생성기는 optional field를 오직 field declaration의 ? 표기만으로 판정해야 한다.

- DTO 스키마 생성기는 field type을 아래 규칙으로 DtoFieldSchema로 변환해야 한다.
  - string -> { type: "string" }
  - number -> { type: "number" }
  - boolean -> { type: "boolean" }
  - T[] -> { type: "array", items: (T의 DtoFieldSchema) }
  - DTO reference -> { type: "object", ref: (implementation-defined string) }

- DTO 스키마 생성기는 모든 DTO field에 대해 아래를 만족하는 경우에만 스키마 생성을 성공으로 판정해야 한다.
  - field type이 SchemaGeneratableFieldType으로 판정 가능하다.

- DTO 스키마 생성기는 SchemaGeneratableFieldType으로 판정 불가능한 field type이 존재하는 경우 빌드 실패를 관측 가능하게 해야 한다.
- DTO Transformer는 DTO 스키마를 기반으로 수행되어야 한다.
- DTO Validator는 DTO 스키마를 기반으로 수행되어야 한다.

- DTO Transformer/DTO Validator는 파이프(Pipe)에 명시적으로 등록(활성화)된 경우에만 실행되어야 한다.
  등록되지 않은 변환/검증을 암묵적으로 실행하거나, DTO 기반 처리를 기본값으로 가정해서는 안 된다.

### 3.2 MUST NOT

- DTO에 프로토콜 종속 정보(상태 코드 등)를 포함시키지 않는다.
- 변환/검증을 런타임 리플렉션으로 수행하도록 요구해서는 안 된다.

---

## 4. Observable Semantics

Normative: 본 SPEC은 추가적인 Observable Semantics를 정의하지 않는다.

---

## 5. Violation Conditions

- Build-Time Violation: DTO가 스키마로 판정 가능하지 않은데도 빌드가 성공하는 경우
- Build-Time Violation: DTO field type이 SchemaGeneratableFieldType으로 판정 불가능한데도 DTO 스키마 생성이 성공으로 판정되는 경우
- Runtime Violation: DTO 검증 실패가 Panic(throw)으로 처리되는 것이 관측되는 경우

---

## 6. Handoff & Priority

### 6.1 Handoff

- 빌드 실패 및 위반 조건의 진단 출력은 diagnostics.spec.md의 형식을 따라야 한다.

### 6.2 Layer Priority

본 SPEC은 L3에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 상위 문서가 우선한다.
