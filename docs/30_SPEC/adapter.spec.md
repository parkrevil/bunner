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

또한 본 SPEC은 프로토콜 무관 공통 실행 모델에서 `Adapter`가 담당하는 역할 경계를 고정한다.

- 프로토콜 입력의 수신, 라우팅/매칭, 그리고 Handler 선택(HandlerId 결정)은 Adapter의 책임이다.
- 선택된 Handler를 guards/pipes/exception filters/middlewares 규칙에 따라 실행하는 것은 정적 wiring의 책임이다.
- 프로토콜별 차이(HTTP/gRPC/이벤트/큐 등)는 모두 “HandlerId 결정의 입력”으로만 취급되어야 하며,
  파이프라인 정책 합성/실행 규칙과 결합되어서는 안 된다.

### 1.3 Definitions

- defineAdapter:
  - meaning: 어댑터 제작자가 어댑터를 등록하기 위해 호출하는 빌드 타임 판정 입력 함수
- adapterSpec:
  - meaning: 어댑터 패키지 루트 `index.ts`(L2 STRUCTURE의 Facade)에서 named export 되어야 하는 어댑터 등록 판정 입력
- AdapterRegistrationInput:
  - meaning: `defineAdapter` 호출의 단일 인자이며, 어댑터 정적 명세를 제공하는 AST-level 입력
- PipelineToken:
  - meaning: `AdapterRegistrationInput.pipeline`의 array literal 원소(합성/실행 순서 skeleton의 토큰)

## 2. Static Shape

어댑터는 아래 Static Shape를 만족하는 정적 명세를 제공해야 한다.

- AdapterRegistrationInput
  - `classRef`: `Token`
  - `pipeline`: `Pipeline`
  - `middlewarePhaseOrder`: `MiddlewarePhaseOrder`
  - `supportedMiddlewarePhases`: `SupportedMiddlewarePhaseSet`
  - `decorators`: `AdapterEntryDecorators`

- `Pipeline`
  - type: array
  - items: PipelineToken
  - meaning: `AdapterRegistrationInput.pipeline`의 합성/실행 순서 skeleton

PipelineToken:

- allowed forms (AST-level):
  - MiddlewarePhaseId (adapter middleware phase stage)
  - identifier reference (reserved): Guards | Pipes | Handler

Normative:

- reserved token은 string literal로 표현되어서는 안 된다.
- reserved token은 Identifier reference로만 판정되어야 한다.
- reserved token Identifier reference의 식별자 이름은 각각 정확히 "Guards" | "Pipes" | "Handler" 중 하나여야 한다.

Normative:

- 어댑터는 `pipeline`에서 “순서”만 선언해야 한다.
- 실행 파이프라인의 실제 실행 단위(middleware/guard/pipe/handler)는 빌드 타임 정적 wiring의 산출물로 구성되어야 한다.

MiddlewarePhaseId:

- type: string
- meaning: 어댑터가 소유하는 middleware phase 식별자
- allowed forms (AST-level):
  - string literal (e.g., "BeforeRequest")
    - constraints:
      - MUST be non-empty
      - MUST NOT contain :
  - identifier reference or property access expression
    - meaning: 빌드 타임에 symbol을 결정적으로 해석할 수 있는 phase token 참조

Normative:

- MiddlewarePhaseId의 AST-level 입력이 string literal이 아닌 경우, CLI는 입력 expression이 참조하는 symbol을 결정적으로 해석해야 한다.
- string literal이 아닌 입력은 다음 정규화 규칙에 의해 MiddlewarePhaseId(string)로 정규화되어야 한다.
  - normalized: "`file`#`symbol`"
  - `file`은 symbol 선언을 포함하는 파일의 프로젝트 루트 기준 정규화된 상대 경로여야 한다.
  - `symbol`은 비어있지 않은 문자열이어야 한다.
  - 정규화 결과는 `:` 문자를 포함해서는 안 된다.

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

Static Shape의 구체적 직렬화 형식 및 저장 위치는 manifest.spec.md에서 판정된다.

Normative:

- `AdapterRegistrationInput.pipeline`은 합성/실행 순서 skeleton 입력이다.
- CLI는 `AdapterRegistrationInput.pipeline`과 module-system.spec.md의 파이프라인 구성 입력을 결합하여, 실행 단계의 순서를 결정적으로 구성해야 한다.
- 위 결과는 manifest.spec.md의 `AdapterStaticSpec.pipeline`로 직렬화되어야 한다.

### 2.1 Adapter Registration Input

어댑터는 defineAdapter를 통해 빌드 타임 판정 입력을 제공해야 한다.

Normative:

- 어댑터 패키지는 패키지 루트 `index.ts`(L2 STRUCTURE의 Facade)에서 adapterSpec을 named export 해야 한다.
- adapterSpec은 `defineAdapter(<AdapterRegistrationInput>)` 호출 표현으로 빌드 타임에 결정적으로 수집 가능해야 한다.
- `defineAdapter` 호출은 정확히 1개의 인자를 가져야 한다.
- `defineAdapter` 호출의 인자는 object literal이어야 한다.

Example (directory layout):

```text
packages/<adapter-pkg>/
  index.ts        # exports: adapterSpec
  src/
    ...
```

AdapterRegistrationInput(수집 대상 object literal)은 아래 필드를 포함해야 한다.

- name
  - meaning: 어댑터 식별/표시 이름
  - constraints (AST-level): 비어있지 않은 string literal로 직접 판정 가능해야 한다.

- classRef
  - meaning: 어댑터의 런타임 실행체(프로토콜 서버/리스너)를 구현하는 class reference
  - constraints (AST-level): Class token(common.spec.md)으로 직접 판정 가능해야 한다.

- pipeline
  - meaning: Pipeline(순서 skeleton) 선언
  - allowed forms (AST-level):
    - array literal (PipelineToken[])
  - constraints (AST-level):
    - 각 원소는 PipelineToken 허용 형태여야 한다.

Normative:

- `pipeline`은 반드시 array literal이어야 한다.
- `pipeline`은 reserved token Handler를 정확히 1개 포함해야 한다.
- `pipeline`은 reserved token Guards | Pipes를 포함할 수 있다(MAY).
- `pipeline`이 Guards 또는 Pipes를 포함하는 경우, 각 토큰은 최대 1개여야 한다.
- `pipeline`은 어댑터가 선언한 `middlewarePhaseOrder`의 모든 원소를 각각 정확히 1개 포함해야 한다.
- `pipeline`에 포함된 MiddlewarePhaseId 토큰들의 상대 순서는 `middlewarePhaseOrder` 순서와 동일해야 한다.

- supportedMiddlewarePhases
  - meaning: 지원 middleware phase id 집합 선언
  - constraints (AST-level): SupportedMiddlewarePhaseSet 형상(object literal)으로 직접 판정 가능해야 한다.

- middlewarePhaseOrder
  - meaning: middleware phase 실행 순서 선언
  - constraints (AST-level): MiddlewarePhaseOrder 형상(array literal)으로 직접 판정 가능해야 한다.

- decorators
  - meaning: 엔트리 판정 데코레이터 선언
  - constraints (AST-level): AdapterEntryDecorators 형상(object literal)으로 직접 판정 가능해야 한다.

Normative:

- AdapterRegistrationInput.decorators는 manifest.spec.md의 `AdapterStaticSpec.entryDecorators`로 정규화되어야 한다.

Normative:

- AdapterRegistrationInput.classRef는 반드시 존재해야 한다.

---

## 3. Invariants & Constraints

본 섹션은 어댑터의 정적 명세가 만족해야 하는 전역 제약(결정성, 결합 경계, 배치 규칙)을 정의한다.

### 3.1 MUST

- 어댑터는 프로토콜 입력을 실행 모델로 전달할 수 있어야 한다.

- 어댑터는 프로토콜 입력을 수신한 후, 빌드 타임에 판정된 Handler(Controller class의 method) 집합 중 정확히 1개를 선택할 수 있어야 한다.
  - 선택 결과는 HandlerId(diagnostics.spec.md)로 결정적으로 식별 가능해야 한다.

- 어댑터는 프로토콜 입력의 라우팅/매칭 결과를 런타임에 Core로 전달하여 Core가 Handler를 선택하도록 요구해서는 안 된다.
  - Core가 관측하는 Handler 선택의 식별자는 HandlerId뿐이어야 한다.

- 선택된 Handler 실행은 `AdapterRegistrationInput.pipeline`의 "Handler" 토큰에 대응되는 실행 지점에서만 관측되어야 한다.

- 어댑터는 프로토콜별 출력/확정 동작(예: HTTP 응답 작성, 스트림 종료, 큐 ack/nack/retry 등)을 소유해야 한다.
  - 해당 동작은 guards/pipes/exception filters/middlewares의 정책 합성 규칙과 분리되어야 한다.

- 어댑터는 단일 프로토콜 입력이 여러 번의 Handler 실행으로 분해되는 경우(예: 스트리밍, 반복 이벤트 등),
  각 실행 단위를 HandlerId로 결정적으로 식별하고 실행 순서를 어댑터가 소유해야 한다.
- 어댑터는 Result/Error/Panic을 프로토콜 표현으로 변환해야 한다. (매핑 규칙은 어댑터 소유)
- 어댑터는 `AdapterRegistrationInput.pipeline`을 정적으로 선언해야 한다.

- 어댑터는 `middlewarePhaseOrder`를 정적으로 선언해야 한다.
  - `middlewarePhaseOrder`는 비어있어서는 안 된다.
  - `middlewarePhaseOrder`는 중복 phase id를 포함해서는 안 된다.
  - `supportedMiddlewarePhases`의 key 집합은 `middlewarePhaseOrder`의 원소 집합과 정확히 일치해야 한다.
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

- Middleware Phase 기반 배치 규칙은 `pipeline` 내 MiddlewarePhaseId 토큰들에만 적용되어야 한다.

- 어떤 MiddlewarePhaseId 토큰에 해당하는 미들웨어 실행 중 Error가 반환되면, 이후 "Guards" | "Pipes" | "Handler" 토큰에 해당하는 실행은 관측되어서는 안 된다.
  - 어댑터는 해당 Error를 Result 경로로 프로토콜 응답으로 변환해야 한다. (매핑 규칙은 어댑터 소유)

- 어댑터의 정적 명세를 기반으로 Wiring 코드가 생성되어야 한다.

- 어댑터 간 Public API 접근은 module-system.spec.md의 `dependsOn`에 의해 명시된 경우에만 허용되어야 한다.

- Adapter Member Decorator는 Adapter Owner Decorator가 적용된 class 내부에서만 유효해야 한다.
  - 이를 위반하면 빌드 실패로 판정되어야 한다.

- Controller(엔트리 선언)의 소속 어댑터 판정은 빌드 타임에 엄격하게 수행되어야 한다.
  - 판정이 불가능하거나 모호한 경우, 빌드 실패가 관측되어야 한다.

- Controller(엔트리 소유 단위의 class)에는 정확히 1개의 Adapter Owner Decorator만 적용되어야 한다.
  - 0개 또는 2개 이상이면 빌드 실패로 판정되어야 한다.

- Adapter Owner Decorator는 call expression 형태로 사용될 수 있어야 한다.
  - 인자 허용 형태(AST-level)는 아래 중 하나여야 한다.
    - 0개 인자
    - 1개 인자: object literal
  - 위 조건을 만족하지 않으면, 빌드 실패가 관측되어야 한다.

- Adapter Owner Decorator call expression의 인자가 0개인 경우, 해당 Controller(및 그 내부 Handler)는 이 어댑터의 모든 adapterId에 반영되어야 한다.

- Adapter Owner Decorator call expression의 인자가 1개(object literal)인 경우, `adapterIds` 필드는 아래 규칙을 따라야 한다.
  - `adapterIds`가 존재하지 않으면, 해당 Controller(및 그 내부 Handler)는 이 어댑터의 모든 adapterId에 반영되어야 한다.
  - `adapterIds`가 존재하면, 반드시 AdapterId(common.spec.md)로 직접 판정 가능한 string literal 배열(array literal)이어야 하며, 빈 배열이어서는 안 된다.
    - 각 adapterId는 module-system.spec.md의 모듈 루트 파일 `AdapterConfig` 키 집합에 포함되어야 한다(미포함이면 빌드 실패).
    - 각 adapterId에 대응되는 AdapterInstanceConfig.adapterName(module-system.spec.md)은, 해당 어댑터 패키지의 AdapterRegistrationInput.name과 동일해야 한다(불일치면 빌드 실패).

- 모든 어댑터는 Controller 용 데코레이터와 Handler 용 데코레이터를 공식 지원해야 한다.
  - Adapter Static Spec의 `entryDecorators.controller | entryDecorators.handler`는 반드시 존재해야 한다.
  - `entryDecorators.controller`는 비어있어서는 안 된다.
  - `entryDecorators.handler`는 비어있어서는 안 된다.

- Handler(엔트리 실행 단위)는 Controller class의 method로 판정되어야 한다.
  - Handler 데코레이터는 반드시 Controller로 판정된 class의 method에 적용되어야 한다.
  - 위 조건을 위반하면 빌드 실패가 관측되어야 한다.

  - Handler method는 아래 조건을 모두 만족해야 한다.
    - instance method여야 한다. (static method는 Handler로 판정되어서는 안 된다)
    - method name은 identifier여야 한다. (computed name, string literal name, symbol-named method는 Handler로 판정되어서는 안 된다)
    - private method(예: `#foo`)는 Handler로 판정되어서는 안 된다.

- 어댑터 엔트리 선언(Controller/Handler 등)은 빌드 타임에 결정적으로 수집 가능해야 한다.
  - 수집 결과는 문서/DevTools 산출물 입력으로 사용될 수 있어야 한다.

- 어댑터 런타임 실행체는 `BunnerAdapter`(GLOSSARY)를 상속하는 concrete class여야 한다.
  - AdapterRegistrationInput.classRef로 판정된 class 선언은 `BunnerAdapter`를 extends 해야 한다.
  - AdapterRegistrationInput.classRef로 판정된 class 선언은 abstract class여서는 안 된다.

### 3.2 MUST NOT

- 어댑터가 Core 내부 로직을 침범하여 구조 판정/추론을 수행해서는 안 된다.
- 어댑터 간 결합이 암묵적으로 발생해서는 안 된다.

- 런타임 의미론이 어댑터 엔트리 판정(Controller/Handler) 데코레이터 실행을 전제로 해서는 안 된다.

---

## 4. Observable Semantics

### 4.1 Middleware Short-Circuit

- Observable: 어떤 MiddlewarePhaseId 토큰에 해당하는 미들웨어 실행에서 Error가 관측되면, 이후 "Guards" | "Pipes" | "Handler" 실행이 관측되지 않아야 한다.

### 4.2 Exception Filter Chain Application Order

- Observable: Exception Filter Chain이 적용되는 경우, 인덱스 0부터 순서대로 적용이 시도되어야 한다.

---

## 5. Violation Conditions

- Build-Time Violation: 어댑터 패키지 루트 entry file에서 adapterSpec named export가 존재하지 않는데도 빌드가 성공하는 경우
- Build-Time Violation: adapterSpec이 `defineAdapter(<AdapterRegistrationInput>)` 호출 표현이 아닌데도 빌드가 성공하는 경우
- Build-Time Violation: `defineAdapter` 호출 인자가 1개가 아닌데도 빌드가 성공하는 경우
- Build-Time Violation: `defineAdapter` 호출 인자가 object literal이 아닌데도 빌드가 성공하는 경우
- Build-Time Violation: AdapterRegistrationInput에서 classRef/pipeline/supportedMiddlewarePhases/middlewarePhaseOrder/decorators 중 하나라도 AST-level로 판정 불가인데도 빌드가 성공하는 경우
- Build-Time Violation: AdapterRegistrationInput.classRef가 누락되는데도 빌드가 성공하는 경우

- Build-Time Violation: Adapter Static Spec에 `pipeline`이 없는데도 빌드가 성공하는 경우
- Build-Time Violation: `pipeline`이 "Handler"를 정확히 1개 포함하지 않는데도 빌드가 성공하는 경우
- Build-Time Violation: `pipeline`이 "Guards" 또는 "Pipes"를 2개 이상 포함하는데도 빌드가 성공하는 경우
- Build-Time Violation: `pipeline`이 `middlewarePhaseOrder`의 모든 원소를 각각 정확히 1개 포함하지 않는데도 빌드가 성공하는 경우
- Build-Time Violation: `pipeline` 내 MiddlewarePhaseId 토큰들의 상대 순서가 `middlewarePhaseOrder`와 다르지만 빌드가 성공하는 경우
- Build-Time Violation: `middlewarePhaseOrder`가 비어있는데도 빌드가 성공하는 경우
- Build-Time Violation: `middlewarePhaseOrder`에 중복 phase id가 존재하는데도 빌드가 성공하는 경우
- Build-Time Violation: `supportedMiddlewarePhases` key 집합과 `middlewarePhaseOrder` 원소 집합이 일치하지 않는데도 빌드가 성공하는 경우
- Build-Time Violation: module-system.spec.md의 `middlewares`에 어댑터가 지원하지 않는 phase id가 존재하는데도 빌드가 성공하는 경우
- Build-Time Violation: common.spec.md의 `@Middlewares`에 어댑터가 지원하지 않는 phase id가 존재하는데도 빌드가 성공하는 경우
- Build-Time Violation: Exception Filter Chain을 결정적으로 구성할 수 없는데도 빌드가 성공하는 경우
- Build-Time Violation: Adapter Owner Decorator가 없는 위치에서 Adapter Member Decorator가 사용되는데도 빌드가 성공하는 경우

- Build-Time Violation: Controller(엔트리 소유 단위)에 Adapter Owner Decorator가 0개 또는 2개 이상 적용되는데도 빌드가 성공하는 경우

- Build-Time Violation: Adapter Owner Decorator call expression 인자 개수/형상이 허용 형태가 아닌데도 빌드가 성공하는 경우
- Build-Time Violation: Adapter Owner Decorator call expression의 `adapterIds`가 존재하는데도 array literal이 아니거나, AdapterId로 직접 판정 가능한 string literal 배열이 아니거나, 빈 배열인데도 빌드가 성공하는 경우
- Build-Time Violation: Adapter Owner Decorator로부터 판정된 adapterId 중 module-system.spec.md의 `AdapterConfig` 키 집합에 포함되지 않는 값이 존재하는데도 빌드가 성공하는 경우
- Build-Time Violation: Adapter Owner Decorator로부터 판정된 adapterId 중 adapterName(module-system.spec.md)이 어댑터 패키지 AdapterRegistrationInput.name과 다른 값이 존재하는데도 빌드가 성공하는 경우

- Runtime Violation: 어떤 MiddlewarePhaseId 토큰에 해당하는 미들웨어 실행에서 Error가 관측되는데도 이후 "Guards" | "Pipes" | "Handler" 실행이 관측되는 경우

---

## 6. Handoff & Priority

### 6.1 Handoff

- `FactoryRef` 및 DI 관련 공통 형상은 common.spec.md로 이관된다.
- 모듈 루트 파일에서의 어댑터 선언 입력(`AdapterConfig`, `dependsOn`, phase 기반 middlewares 선언)은 module-system.spec.md로 이관된다.
- Adapter Static Spec(Manifest의 `AdapterStaticSpec`)의 구체 형상 및 직렬화 형식/저장 위치는 manifest.spec.md로 이관된다.
- 어댑터가 판정한 라우팅/이벤트 표면의 정적 결과는 Interface Catalog 입력으로 사용되어야 한다.

### 6.2 Layer Priority

본 SPEC은 L3에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 상위 문서가 우선한다.
