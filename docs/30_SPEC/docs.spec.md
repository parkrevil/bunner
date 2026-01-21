# API Documentation Specification (OpenAPI / AsyncAPI)

L3 Implementation Contract
본 문서는 `API Documentation`에 대한 구현 계약이다.
본 계약은 기계적 검증 가능성(Mechanical Verifiability)을 최우선 기준으로 하며,
구현 방법, 튜토리얼, 사용 가이드를 포함하지 않는다.

---

## 1. Context

### 1.1 Purpose

본 SPEC은 OpenAPI/AsyncAPI 등 API 명세 산출물의 생성 계약이 유효한 구현으로 성립하는 조건을 정의한다.

### 1.2 Scope & Boundary

본 SPEC은 API 명세 생성의 입력 소스(어댑터/DTO/에러/보안 등)와 산출물 정합성/결정성을 고정한다.
다음 항목은 본 SPEC의 소유가 아니다:

- 명세를 표시하는 UI/DevTools → devtools.spec.md에서 판정된다.
- 명세 산출물의 파일 경로/파일명/디렉토리 분할 규칙 → 외부 패키지의 책임
- Core Build Artifact(Manifest) 형상 → manifest.spec.md에서 판정된다.

### 1.3 Definitions

Normative: 본 SPEC은 추가적인 용어 정의를 도입하지 않는다.

## 2. Static Shape

본 섹션은 문서 생성 입력으로 사용되는 Interface Catalog의 최소 형상을 정의한다.

### 2.1 Core Data Shapes

Normative: 아래에 정의된 형상이 계약이다.

InterfaceCatalogSchemaVersion:

- type: string
- const: "1"

InterfaceSchemaRef:

- type: string

InterfaceCatalogEntryKind:

- type: string
- allowed values:
  - rest
  - event
  - rpc

InterfaceCapability:

- type: string
- allowed values:
  - multiplexing
  - streaming

RestSurface:

- type: object
- required:
  - method
  - path
- properties:
  - method:
    - type: string
  - path:
    - type: string

EventSurface:

- type: object
- required:
  - channel
  - direction
- properties:
  - channel:
    - type: string
  - direction:
    - type: string
    - allowed values:
      - publish
      - subscribe

RpcSurface:

- type: object
- required:
  - service
  - method
- properties:
  - service:
    - type: string
  - method:
    - type: string

InterfaceSurface:

- allowed forms:
  - RestSurface
  - EventSurface
  - RpcSurface

InterfaceCatalogEntry:

- type: object
- required:
  - id
  - kind
  - adapterId
  - surface
- properties:
  - id:
    - type: string
  - kind: InterfaceCatalogEntryKind
  - adapterId: AdapterId (common.spec.md)
  - handlerId:
    - type: HandlerId (diagnostics.spec.md)
  - surface: InterfaceSurface
  - inputSchemas:
    - type: array
    - items: InterfaceSchemaRef
  - outputSchemas:
    - type: array
    - items: InterfaceSchemaRef
  - errorSchemas:
    - type: array
    - items: InterfaceSchemaRef
  - securityRefs:
    - type: array
    - items: string
  - capabilities:
    - type: array
    - items: InterfaceCapability

InterfaceCatalog:

- type: object
- required:
  - schemaVersion
  - entries
- properties:
  - schemaVersion: InterfaceCatalogSchemaVersion
  - entries:
    - type: array
    - items: InterfaceCatalogEntry

### 2.2 Shape Conformance Rules

- `InterfaceCatalog.entries`는 반드시 결정적 순서를 가져야 한다.
  - 정렬 키는 `id`의 오름차순이어야 한다.

- `InterfaceCatalog.entries`의 각 `InterfaceCatalogEntry.id`는 중복되어서는 안 된다.

- `InterfaceCatalogEntry.kind`가 `rest | rpc`인 경우, `handlerId`는 반드시 존재해야 한다.

- `InterfaceCatalogEntry.kind`가 `event`이고, `surface.direction`이 `subscribe`인 경우, `handlerId`는 반드시 존재해야 한다.

- `handlerId`가 존재하는 경우, 해당 `handlerId`의 `<adapterId>`는 `InterfaceCatalogEntry.adapterId`와 동일해야 한다.

---

## 3. Invariants & Constraints

- 명세 산출물은 빌드 타임에 생성 가능해야 하며(정적), 동일 입력에서 결정적으로 동일해야 한다.

### 3.1 MUST

- API 명세는 adapter/execution/dto/error 모델과 정합해야 한다.
- Interface Catalog는 빌드 타임에 생성 가능해야 하며 동일 입력에서 결정적으로 동일해야 한다.
- API 명세 생성은 Interface Catalog를 입력으로 사용해야 한다.
- 명세 산출물은 동일 입력에서 결정적으로 동일해야 한다.
- 불일치가 검출되면 빌드 실패 또는 명시적 실패로 판정되어야 한다.

### 3.2 MUST NOT

- 명세 산출물이 실행 표면과 불일치한 상태를 “정상”으로 허용해서는 안 된다.
- 런타임 관측만으로 명세를 생성하도록 요구해서는 안 된다.

---

## 4. Observable Semantics

Normative: 본 SPEC은 추가적인 Observable Semantics를 정의하지 않는다.

---

## 5. Violation Conditions

- Build-Time Violation: 명세 생성에 필요한 입력(어댑터 표면/DTO 스키마)이 누락되었는데도 생성이 성공하는 경우
- Build-Time Violation: 실행 표면과 명세가 불일치한데도 생성이 성공으로 판정되는 경우
- Build-Time Violation: Interface Catalog가 생성되지 않았는데도 빌드가 성공으로 판정되는 경우

---

## 6. Handoff & Priority

### 6.1 Handoff

- DTO 스키마는 dto.spec.md를 따른다.

- Interface Catalog는 어댑터 및 DTO/에러 모델의 정적 판정 결과를 입력으로 생성되어야 한다.

- 빌드 실패 및 위반 조건의 진단 출력은 diagnostics.spec.md의 형식을 따라야 한다.

### 6.2 Layer Priority

본 SPEC은 L3에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 상위 문서가 우선한다.
