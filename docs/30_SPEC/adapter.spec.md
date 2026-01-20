# `Adapter` Specification

L3 Implementation Contract
본 문서는 `Adapter`에 대한 구현 계약이다.
본 계약은 기계적 검증 가능성(Mechanical Verifiability)을 최우선 기준으로 하며,
구현 방법, 튜토리얼, 사용 가이드를 포함하지 않는다.

---

## 1. Context

### 1.1 Purpose

본 SPEC은 `Adapter`가 유효한 구현으로 판정되기 위한
정적 선언(빌드 타임 판정 입력)과, 어댑터 엔트리 선언의 판정 규칙을 정의한다.

### 1.2 Scope & Boundary

본 SPEC은 어댑터 전용 데코레이터(엔트리 선언)와, 실행 파이프라인의 정적 형상을 포함한다.

### 1.3 Definitions

- defineAdapter:
  - meaning: 어댑터 제작자가 어댑터를 등록하기 위해 호출하는 빌드 타임 판정 입력 함수
- adapterSpec:
  - meaning: 어댑터 패키지 루트 entry file에서 named export 되어야 하는 어댑터 등록 판정 입력

## 2. Static Shape

어댑터는 아래 Static Shape를 만족하는 정적 명세를 제공해야 한다.

- Adapter Static Spec
  - `pipeline`: `Pipeline`
  - `middlewarePhaseOrder`: `MiddlewarePhaseOrder`
  - `supportedMiddlewarePhases`: `SupportedMiddlewarePhaseSet`
  - `entryDecorators`: `AdapterEntryDecorators`
  - `runtime`: `AdapterRuntimeSpec`

- `Pipeline`
  - `middlewares`: `PipelineStep[]` (순서가 있는 리스트)
  - `guards`: `PipelineStep[]` (순서가 있는 리스트)
  - `pipes`: `PipelineStep[]` (순서가 있는 리스트)
  - `handler`: `PipelineStep` (정확히 1개)

- `PipelineStep`
  - allowed forms:
    - FactoryRef (common.spec.md)
  - meaning: 실행 파이프라인을 구성하는 단일 실행 단위 참조

Normative:

- `pipeline.handler`는 Controller method(Handler)를 직접 참조하는 값이 아니라, 어댑터가 제공하는 **dispatcher** 실행 단위(FactoryRef)여야 한다.
  - dispatcher는 빌드 타임에 판정된 Handler(Controller class의 method)를 호출할 수 있어야 한다.

MiddlewarePhaseId:

- type: string
- meaning: 어댑터가 소유하는 middleware phase 식별자
- allowed forms (AST-level):
  - string literal (e.g., "BeforeRequest")
    - constraints:
      - MUST be non-empty
      - MUST NOT contain :

MiddlewarePhaseOrder:

- type: array
- items: MiddlewarePhaseId
- meaning: 어댑터가 정의하는 middleware phase 실행 순서

- `SupportedMiddlewarePhaseSet`
  - type: object
  - meaning: 어댑터가 지원하는 middleware phase id 집합
  - keys: MiddlewarePhaseId
  - values: literal true

- `AdapterEntryDecorators`
  - type: object
  - required:
    - controller
    - handler
  - properties:
    - controller:
      - type: DecoratorRef (common.spec.md)
      - meaning: 해당 어댑터에서 Controller(엔트리 소유 단위)로 판정되는 class-level 데코레이터 값
    - handler:
      - type: array
      - items: DecoratorRef (common.spec.md)
      - meaning: 해당 어댑터에서 Handler(엔트리 실행 단위)로 판정되는 method-level 데코레이터 값 리스트

- `AdapterRuntimeSpec`
  - type: object
  - required:
    - start
    - stop
  - properties:
    - start: FactoryRef (common.spec.md)
    - stop: FactoryRef (common.spec.md)

Static Shape의 구체적 직렬화 형식 및 저장 위치는 manifest.spec.md에서 판정된다.

### 2.1 Adapter Registration Input

어댑터는 defineAdapter를 통해 빌드 타임 판정 입력을 제공해야 한다.

Normative:

- 어댑터 패키지는 패키지 루트 entry file에서 adapterSpec을 named export 해야 한다.
- adapterSpec은 `defineAdapter(<AdapterClassRef>)` 호출 표현으로 빌드 타임에 결정적으로 수집 가능해야 한다.
- `defineAdapter` 호출은 정확히 1개의 인자를 가져야 한다.
- `defineAdapter` 호출의 인자는 클래스 선언을 참조하는 Identifier reference여야 한다.

AdapterClass(수집 대상 클래스 선언)는 아래 정적 필드를 포함해야 한다.

- adapterId
  - meaning: 어댑터 식별자
  - constraints (AST-level): string literal로 직접 판정 가능해야 한다.

- pipeline
  - meaning: Pipeline 정적 선언
  - allowed forms (AST-level):
    - object literal
    - static method declaration returning object literal
  - constraints (AST-level):
    - object literal인 경우: 해당 object literal을 Pipeline으로 판정해야 한다.
    - static method인 경우: 본문이 단일 return statement이고 return value가 object literal인 경우에만 Pipeline으로 판정해야 한다.

- supportedMiddlewarePhases
  - meaning: 지원 middleware phase id 집합 선언
  - constraints (AST-level): SupportedMiddlewarePhaseSet 형상(object literal)으로 직접 판정 가능해야 한다.

- middlewarePhaseOrder
  - meaning: middleware phase 실행 순서 선언
  - constraints (AST-level): MiddlewarePhaseOrder 형상(array literal)으로 직접 판정 가능해야 한다.

- entryDecorators
  - meaning: 엔트리 판정 데코레이터 선언
  - constraints (AST-level): AdapterEntryDecorators 형상(object literal)으로 직접 판정 가능해야 한다.

- runtime
  - meaning: 어댑터 런타임 start/stop 실행 단위 선언
  - constraints (AST-level): AdapterRuntimeSpec 형상(object literal)으로 직접 판정 가능해야 한다.

---

## 3. Invariants & Constraints

본 섹션은 어댑터의 정적 명세가 만족해야 하는 전역 제약(결정성, 결합 경계, 배치 규칙)을 정의한다.

### 3.1 MUST

- 어댑터는 프로토콜 입력을 실행 모델로 전달할 수 있어야 한다.
- 어댑터는 Result/Error/Panic을 프로토콜 표현으로 변환해야 한다. (매핑 규칙은 어댑터 소유)
- 어댑터는 `pipeline`을 정적으로 선언해야 한다.
- `pipeline.handler`는 정확히 1개여야 한다.
- `pipeline.middlewares | pipeline.guards | pipeline.pipes`는 결정적 순서를 가져야 한다.

- 어댑터는 `middlewarePhaseOrder`를 기준으로 `pipeline.middlewares`를 정의해야 한다.
  - `pipeline.middlewares.length`는 `middlewarePhaseOrder.length`와 동일해야 한다.
  - `middlewarePhaseOrder`는 비어있어서는 안 된다.
  - `middlewarePhaseOrder`는 중복 phase id를 포함해서는 안 된다.
  - `supportedMiddlewarePhases`의 key 집합은 `middlewarePhaseOrder`의 원소 집합과 정확히 일치해야 한다.

- 어댑터는 Middleware Phase를 정의해야 한다.
- 어댑터는 `middlewarePhaseOrder`를 정적으로 제공해야 한다.
- 어댑터는 지원하는 middleware phase id 집합을 정적으로 제공해야 한다.
- 어댑터는 module-system.spec.md에 의해 제공되는 `middlewares` 등록 입력과 common.spec.md의 `@Middlewares` 선언 입력을 기반으로, 미들웨어들을 `middlewarePhaseOrder` 순서로 결정적으로 배치해야 한다.
  - 동일한 phase 내에서는 선언된 순서를 보존해야 한다.

- module-system.spec.md의 `middlewares`에 등장하는 phase id(정규화 결과)가, 어댑터가 제공한 지원 집합에 포함되지 않으면 빌드 실패가 관측되어야 한다.
- common.spec.md의 `@Middlewares` 선언에 등장하는 phase id(정규화 결과)가, 어댑터가 제공한 지원 집합에 포함되지 않으면 빌드 실패가 관측되어야 한다.

- 어댑터는 module-system.spec.md의 `exceptionFilters` 등록 입력과 common.spec.md의 `@ExceptionFilters` 선언 입력을 기반으로, Exception Filter Chain을 결정적으로 구성할 수 있어야 한다.

- 어댑터는 특정 adapterId 범위에서 파이프라인 구성 입력을 아래 순서로 합성해야 한다.
  - `middlewares | guards | pipes`: module-system.spec.md 입력 → controller 데코레이터 입력 → handler 데코레이터 입력
  - `exceptionFilters`: handler 데코레이터 입력 → controller 데코레이터 입력 → module-system.spec.md 입력
  - 중복은 제거되어서는 안 된다.
  - 각 입력 소스 내부의 선언 순서는 보존되어야 한다.

- Middleware Phase 기반 배치 규칙은 `pipeline.middlewares`에만 적용되어야 한다.

- `pipeline.middlewares` 실행 중 어떤 PipelineStep이 Error를 반환하면, 이후 `pipeline.guards | pipeline.pipes | pipeline.handler`는 실행되어서는 안 된다.
  - 어댑터는 해당 Error를 Result 경로로 프로토콜 응답으로 변환해야 한다. (매핑 규칙은 어댑터 소유)

- 어댑터의 정적 명세를 기반으로 Wiring 코드가 생성되어야 한다.

- 어댑터 간 Public API 접근은 module-system.spec.md의 `dependsOn`에 의해 명시된 경우에만 허용되어야 한다.

- Adapter Member Decorator는 Adapter Owner Decorator가 적용된 class 내부에서만 유효해야 한다.
  - 이를 위반하면 빌드 실패로 판정되어야 한다.

- Controller(엔트리 선언)의 소속 어댑터 판정은 빌드 타임에 엄격하게 수행되어야 한다.
  - 판정이 불가능하거나 모호한 경우, 빌드 실패가 관측되어야 한다.

- Controller(엔트리 소유 단위의 class)에는 정확히 1개의 Adapter Owner Decorator만 적용되어야 한다.
  - 0개 또는 2개 이상이면 빌드 실패로 판정되어야 한다.

- 모든 어댑터는 Controller 용 데코레이터와 Handler 용 데코레이터를 공식 지원해야 한다.
  - Adapter Static Spec의 `entryDecorators.controller | entryDecorators.handler`는 반드시 존재해야 한다.
  - `entryDecorators.controller`는 비어있어서는 안 된다.
  - `entryDecorators.handler`는 비어있어서는 안 된다.

- Handler(엔트리 실행 단위)는 Controller class의 method로 판정되어야 한다.
  - Handler 데코레이터는 반드시 Controller로 판정된 class의 method에 적용되어야 한다.
  - 위 조건을 위반하면 빌드 실패가 관측되어야 한다.

- 어댑터 엔트리 선언(Controller/Handler 등)은 빌드 타임에 결정적으로 수집 가능해야 한다.
  - 수집 결과는 문서/DevTools 산출물 입력으로 사용될 수 있어야 한다.

### 3.2 MUST NOT

- 어댑터가 Core 내부 로직을 침범하여 구조 판정/추론을 수행해서는 안 된다.
- 어댑터 간 결합이 암묵적으로 발생해서는 안 된다.

---

## 4. Observable Semantics

### 4.1 Middleware Short-Circuit

- Observable: `pipeline.middlewares`에서 Error가 관측되면, 이후 PipelineStep(guard/pipe/handler)이 실행되지 않아야 한다.

### 4.2 Exception Filter Chain Application Order

- Observable: Exception Filter Chain이 적용되는 경우, 인덱스 0부터 순서대로 적용이 시도되어야 한다.

### 4.3 Adapter Runtime Start/Stop

- Observable: app.spec.md의 app.start가 성공적으로 완료되면, attach된 각 어댑터에 대해 AdapterRuntimeSpec.start 호출이 관측되어야 한다.
- Observable: app.spec.md의 app.stop이 성공적으로 완료되면, 실행 중인 각 어댑터에 대해 AdapterRuntimeSpec.stop 호출이 관측되어야 한다.

---

## 5. Violation Conditions

- Build-Time Violation: 어댑터 패키지 루트 entry file에서 adapterSpec named export가 존재하지 않는데도 빌드가 성공하는 경우
- Build-Time Violation: adapterSpec이 `defineAdapter(<AdapterClassRef>)` 호출 표현이 아닌데도 빌드가 성공하는 경우
- Build-Time Violation: `defineAdapter` 호출 인자가 1개가 아닌데도 빌드가 성공하는 경우
- Build-Time Violation: `defineAdapter` 호출 인자가 클래스 선언을 참조하는 Identifier reference가 아닌데도 빌드가 성공하는 경우
- Build-Time Violation: AdapterClass에서 adapterId/pipeline/supportedMiddlewarePhases/middlewarePhaseOrder/entryDecorators/runtime 중 하나라도 AST-level로 판정 불가인데도 빌드가 성공하는 경우

- Build-Time Violation: Adapter Static Spec에 `pipeline`이 없는데도 빌드가 성공하는 경우
- Build-Time Violation: `pipeline.handler`가 없거나 2개 이상인데도 빌드가 성공하는 경우
- Build-Time Violation: `pipeline.middlewares | pipeline.guards | pipeline.pipes`가 결정적 순서를 갖지 못하는데도 빌드가 성공하는 경우
- Build-Time Violation: `pipeline.middlewares.length !== middlewarePhaseOrder.length` 인데도 빌드가 성공하는 경우
- Build-Time Violation: `middlewarePhaseOrder`가 비어있는데도 빌드가 성공하는 경우
- Build-Time Violation: `middlewarePhaseOrder`에 중복 phase id가 존재하는데도 빌드가 성공하는 경우
- Build-Time Violation: `supportedMiddlewarePhases` key 집합과 `middlewarePhaseOrder` 원소 집합이 일치하지 않는데도 빌드가 성공하는 경우
- Build-Time Violation: module-system.spec.md의 `middlewares`에 어댑터가 지원하지 않는 phase id가 존재하는데도 빌드가 성공하는 경우
- Build-Time Violation: common.spec.md의 `@Middlewares`에 어댑터가 지원하지 않는 phase id가 존재하는데도 빌드가 성공하는 경우
- Build-Time Violation: Exception Filter Chain을 결정적으로 구성할 수 없는데도 빌드가 성공하는 경우
- Build-Time Violation: Adapter Owner Decorator가 없는 위치에서 Adapter Member Decorator가 사용되는데도 빌드가 성공하는 경우

- Build-Time Violation: Controller(엔트리 소유 단위)에 Adapter Owner Decorator가 0개 또는 2개 이상 적용되는데도 빌드가 성공하는 경우

- Runtime Violation: `pipeline.middlewares`에서 Error가 관측되는데도 `pipeline.guards | pipeline.pipes | pipeline.handler` 실행이 관측되는 경우

- Runtime Violation: app.spec.md의 app.start가 성공적으로 완료되는데도 attach된 어댑터의 AdapterRuntimeSpec.start 호출이 관측되지 않는 경우
- Runtime Violation: app.spec.md의 app.stop이 성공적으로 완료되는데도 실행 중 어댑터의 AdapterRuntimeSpec.stop 호출이 관측되지 않는 경우

---

## 6. Handoff & Priority

### 6.1 Handoff

- `FactoryRef` 및 DI 관련 공통 형상은 common.spec.md로 이관된다.
- 모듈 루트 파일에서의 어댑터 선언 입력(`AdapterConfig`, `dependsOn`, phase 기반 middlewares 선언)은 module-system.spec.md로 이관된다.
- Adapter Static Shape(`pipeline`, `PipelineStep`)의 구체 직렬화 형식 및 저장 위치는 manifest.spec.md로 이관된다.
- 어댑터가 판정한 라우팅/이벤트 표면의 정적 결과는 Interface Catalog 입력으로 사용되어야 한다.

### 6.2 Layer Priority

본 SPEC은 L3에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 상위 문서가 우선한다.
