# `Diagnostics` Specification

L3 Implementation Contract
본 문서는 Bunner CLI의 진단(diagnostics) 출력에 대한 구현 계약이다.
본 계약은 기계적 검증 가능성(Mechanical Verifiability)을 최우선 기준으로 하며,
구현 방법, 튜토리얼, 사용 가이드를 포함하지 않는다.

---

## 1. Context

### 1.1 Purpose

본 SPEC은 Bunner CLI가 빌드 타임에 산출하는 실패/경고/정보 진단이
유효한 구현으로 성립하기 위한 최소 형상과 결정성(동일 입력 → 동일 출력) 제약을 고정한다.

### 1.2 Scope & Boundary

In-Scope:

- 진단 레코드의 최소 형상(필수 필드)
- 파일/심볼 위치 표현(Location) 계약
- 진단 출력의 결정적 정렬 규칙
- 그래프/의존 사이클의 표준 표현(Cycle)

Out-of-Scope:

- 어떤 상황에서 어떤 `code`를 발생시키는지의 상세 → 각 기능 SPEC
- 진단 메시지 문구의 다국어/브랜딩/색상 등 표현 세부

---

## 2. Static Shape

### 2.1 Core Data Shapes

DiagnosticSeverity:

- type: string
- allowed values:
  - error
  - warning
  - info

DiagnosticCode:

- type: string
- meaning: 진단을 기계적으로 분류하기 위한 코드

SourceRange:

- type: object
- required:
  - startLine
  - startColumn
  - endLine
  - endColumn
- properties:
  - startLine:
    - type: number
  - startColumn:
    - type: number
  - endLine:
    - type: number
  - endColumn:
    - type: number

Location:

- type: object
- required:
  - file
- properties:
  - file:
    - type: string
    - meaning: 프로젝트 루트 기준 정규화된 상대 경로
  - symbol:
    - type: string
    - meaning: 관련 심볼(선택)
  - range:
    - type: SourceRange
    - meaning: 관련 코드 범위(선택)

HandlerId:

- type: string
- meaning: 핸들러를 결정적으로 식별하기 위한 문자열

HandlerIdFormat:

- type: string
- const: `"<adapterId>:<file>#<symbol>"`

HandlerIdFormatRules:

- `HandlerId`는 아래 형식을 만족해야 한다.
  - `<adapterId>`: AdapterId (common.spec.md)
  - `<file>`: Location.file과 동일 규칙(프로젝트 루트 기준 정규화된 상대 경로)
  - `<symbol>`: 비어있지 않은 문자열
    - `<symbol>`은 adapter.spec.md가 정의하는 Handler(Controller class의 method) 단위를 결정적으로 식별해야 한다.
    - `<symbol>`은 아래 형식을 만족해야 한다.
      - `<symbol>`은 `"<controllerClassName>.<handlerMethodName>"` 형식이어야 한다.
      - `<controllerClassName>`은 비어있지 않은 문자열
      - `<handlerMethodName>`은 비어있지 않은 문자열

DiagnosticHint:

- type: object
- required:
  - title
- properties:
  - title:
    - type: string
    - meaning: 단일 문장 힌트
  - details:
    - type: string
    - meaning: 추가 설명(선택)

CycleKind:

- type: string
- allowed values:
  - import
  - di

CycleNode:

- type: object
- required:
  - id
- properties:
  - id:
    - type: string
    - meaning: 노드 식별자(파일 경로 또는 토큰 식별자)
  - location:
    - type: Location

CycleEdge:

- type: object
- required:
  - from
  - to
- properties:
  - from:
    - type: string
  - to:
    - type: string
  - label:
    - type: string
    - meaning: 엣지 의미(선택)
  - location:
    - type: Location

Cycle:

- type: object
- required:
  - kind
  - nodes
  - edges
- properties:
  - kind: CycleKind
  - nodes:
    - type: array
    - items: CycleNode
  - edges:
    - type: array
    - items: CycleEdge

Diagnostic:

- type: object
- required:
  - severity
  - code
  - summary
  - why
  - where
  - how
- properties:
  - severity: DiagnosticSeverity
  - code: DiagnosticCode
  - summary:
    - type: string
    - meaning: what (단일 문장)
  - why:
    - type: string
    - meaning: why (단일 문장 또는 짧은 문단)
  - where:
    - type: array
    - items: Location
  - how:
    - type: array
    - items: DiagnosticHint
  - cycles:
    - type: array
    - items: Cycle

### 2.2 Deterministic Output Rules

- 동일 입력에서 CLI가 산출하는 진단 레코드 집합은 결정적으로 동일해야 한다.
- 진단 레코드는 반드시 결정적 순서로 정렬되어야 한다.
  - 정렬 키(오름차순): `severity`, `code`, `summary`, `where[0].file`

---

## 3. Invariants & Constraints

### 3.1 MUST

- CLI는 빌드 실패/거부 조건에서 최소 1개 이상의 `Diagnostic`을 산출해야 한다.
- `Diagnostic`은 `2. Static Shape`와 정확히 일치해야 한다.
- `Location.file`은 프로젝트 루트 기준 정규화된 상대 경로여야 한다.

### 3.2 MUST NOT

- 진단 산출이 비결정적으로 달라지도록(예: 시간/랜덤/호스트 정보) 설계해서는 안 된다.

---

## 4. Observable Semantics

- 각 기능 SPEC의 Violation은 본 SPEC의 `Diagnostic` 형식으로 관측 가능해야 한다.

---

## 5. Violation Conditions

- Test-Level Violation: 동일 입력에서 진단 출력이 비결정적으로 달라지는 경우
- Build-Time Violation: 빌드 실패가 발생했는데도 `Diagnostic`이 산출되지 않는 경우

## 6. Handoff & Priority

### 6.1 Handoff

- Normative: None.

### 6.2 Layer Priority

본 문서는 L3 SPEC에 속한다.
L2 ARCHITECTURE 또는 L1 FOUNDATION과 충돌할 경우,
상위 문서가 우선한다.
