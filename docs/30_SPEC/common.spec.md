# `Common` Specification

L3 Implementation Contract
본 문서는 `Common`에 대한 구현 계약이다.
본 계약은 기계적 검증 가능성(Mechanical Verifiability)을 최우선 기준으로 하며,
구현 방법, 튜토리얼, 사용 가이드를 포함하지 않는다.

---

## 1. Context

### 1.1 Purpose

본 SPEC은 여러 기능 축에서 공유되는 공통 계약과, 빌드 타임 판정의 입력이 되는
공개 선언(public declarations)의 최소 형상을 정의한다.

### 1.2 Scope & Boundary

In-Scope:

- Result/Error/Panic, 구조적 컨텍스트 등의 공유 계약
- DI/모듈 관련 public declarations의 최소 형상 (AOT 입력)

Out-of-Scope:

- 각 축의 의미론(실행 단계, 에러 처리 체인 등) → 대응 SPEC에서 판정된다.
- DI 연결 규칙 및 그래프 판정 → di.spec.md
- Provider 생명주기 및 scope 의미론 → provider.spec.md

### 1.3 Definitions

Normative: 본 SPEC은 추가적인 용어 정의를 도입하지 않는다.

---

## 2. Static Shape

---

본 섹션은 CLI, 정적 분석기, 코드 생성기가 참조하는 데이터 형상(Data Shape)만을 정의한다.

### 2.1 Core Data Shapes

Normative: 아래에 정의된 형상이 계약이다.

#### 2.1.0 Identity Types

ContextId:

- type: string

AdapterId:

- type: string

ModuleId:

- type: string

Context:

- type: object
- required:
  - contextId
  - adapterId
- properties:
  - contextId:
    - type: ContextId
  - adapterId:
    - type: AdapterId

#### 2.1.1 DI Token

Token:

- allowed forms:
  - Class token: 클래스 선언을 참조 가능한 심볼
  - Unique symbol token: `unique symbol` 선언을 참조 가능한 심볼

#### 2.1.2 Result

BunnerErrorMarkerKey:

- type: string
- const: "**bunner_error**"

BunnerErrorMarker:

- type: object
- required:
  - `__bunner_error__`
- properties:
  - `__bunner_error__`:
    - type: literal true

Result<T, E>:

- meaning: 성공이면 값 T 자체를 반환하고, 실패이면 Error 값을 반환하는 공통 결과 모델
- constraints:
  - E는 object여야 한다.
  - Error 값은 BunnerErrorMarker를 포함해야 한다.
  - 프레임워크는 E의 최소 필드를 강제하거나 자동 주입해서는 안 된다.
- allowed forms:
  - Success: T
  - Error: E & BunnerErrorMarker

#### 2.1.3 Function Reference

FactoryRef:

- allowed forms:
  - Function ref: 함수 선언을 참조 가능한 심볼
- meaning: 실행 단위(middleware/guard/pipe/exception filter/handler 등)를 가리키는 정적 함수 참조

#### 2.1.6 Common Decorator Declarations

CommonDecoratorName:

- type: string
- allowed values:
  - "@Middlewares"
  - "@Guards"
  - "@Pipes"
  - "@ExceptionFilters"

RefListDecoratorName:

- type: string
- allowed values:
  - "@Guards"
  - "@Pipes"
  - "@ExceptionFilters"

MiddlewaresDecoratorName:

- type: string
- const: "@Middlewares"

CommonDecoratorTarget:

- type: string
- allowed values:
  - controller
  - handler

CommonDecoratorRefList:

- type: array
- items: FactoryRef

RefListDecoratorDeclaration:

- type: object
- required:
  - name
  - target
  - refs
- properties:
  - name: RefListDecoratorName
  - target: CommonDecoratorTarget
  - refs: CommonDecoratorRefList

MiddlewaresDecoratorDeclaration:

- type: object
- required:
  - name
  - target
  - lifecycleId
  - refs
- properties:
  - name: MiddlewaresDecoratorName
  - target: CommonDecoratorTarget
  - lifecycleId: MiddlewareLifecycleId (module-system.spec.md)
  - refs: CommonDecoratorRefList

CommonDecoratorDeclaration:

- allowed forms:
  - RefListDecoratorDeclaration
  - MiddlewaresDecoratorDeclaration

#### 2.1.4 Module Reference

ModuleRef:

- meaning: 특정 모듈을 식별하기 위한 정적 마커.
- allowed forms:
  - Exported module marker: 모듈 루트 파일에서 `export const <Identifier> = <Initializer>` 형태로 선언된 식별자 참조
    - note: `<Initializer>`의 런타임 값은 계약에 포함되지 않으며, 판정에 사용되지 않는다.

ModuleRefList:

- type: array
- items: ModuleRef

#### 2.1.5 DI Declarations

InjectableOptions:

- type: object
- properties:
  - scope:
    - type: string
    - meaning: Provider scope 선언
  - visibleTo:
    - allowed forms:
      - VisibleTo keyword: `all | module`
      - Allowlist: ModuleRefList
    - meaning: 모듈 간 주입/접근 허용 범위 선언

InjectableDecoratorName:

- type: string
- allowed values:
  - "@Injectable"

InjectableDeclaration:

- meaning: `@Injectable()` 데코레이터가 적용된 클래스 선언의 빌드 타임 수집 결과
- type: object
- required:
  - name
  - token
- properties:
  - name: InjectableDecoratorName
  - token: Token
  - options: InjectableOptions

InjectCall:

- type: object
- required:
  - token
- properties:
  - token:
    - allowed forms:
      - Token
      - TokenThunk

TokenThunk:

- type: FactoryRef
- meaning: `Token`을 지연 참조하기 위한 thunk 입력
- note: thunk는 런타임에서 실행되거나 토큰 해결에 사용되지 않으며, 빌드 타임에 정적 wiring으로 치환되어야 한다.

ProviderDeclaration:

- type: object
- required:
  - token
- properties:
  - token: Token
  - useClass:
    - type: Token
    - meaning: 클래스 구현으로 제공
  - useValue:
    - type: unknown
    - meaning: 값으로 제공
  - useFactory:
    - type: FactoryRef
    - meaning: 팩토리 함수로 제공
  - useExisting:
    - type: Token
    - meaning: 기존 토큰의 별칭(alias)으로 제공

ModuleDeclaration:

- type: object
- required:
  - providers
- properties:
  - providers:
    - type: array
    - items: ProviderDeclaration

ProviderDeclarationList:

- type: array
- items: ProviderDeclaration

### 2.2 Shape Conformance Rules

- 본 SPEC에 정의되지 않은 필드는 존재해서는 안 된다.
- `Token`은 본 SPEC이 허용한 형태(클래스 또는 `unique symbol`)여야 한다.
- `FactoryRef`는 본 SPEC이 허용한 형태(함수 참조)여야 한다.
- `ProviderDeclaration`은 `useClass | useValue | useFactory | useExisting` 중 정확히 1개를 포함해야 한다.
- `ProviderDeclaration.useFactory`가 존재한다면, `FactoryRef` 형상과 정확히 일치해야 한다.
- `ModuleDeclaration.providers`는 `ProviderDeclaration`의 배열이어야 한다.

- `InjectableDeclaration.name`은 `"@Injectable"`이어야 한다.
- `InjectableDeclaration.token`은 Class token 형태여야 한다.

- `RefListDecoratorDeclaration.name`은 `RefListDecoratorName`의 허용값 중 하나여야 한다.
- `RefListDecoratorDeclaration.refs`는 `FactoryRef`의 배열이어야 한다.

- `MiddlewaresDecoratorDeclaration.lifecycleId`는 module-system.spec.md의 `MiddlewareLifecycleId` 규칙을 만족해야 한다.
- `MiddlewaresDecoratorDeclaration.refs`는 `FactoryRef`의 배열이어야 한다.

- "@Middlewares"는 아래 2가지 입력 형태를 모두 지원해야 하며, 빌드 타임 수집 결과는 `MiddlewaresDecoratorDeclaration`(1개 이상)으로 정규화되어야 한다.
  - 2-arg call: `(lifecycleId, refs)`
  - 1-arg call: `({ [lifecycleId]: refs, ... })`

- `InjectableOptions.visibleTo`는 아래 중 하나여야 한다.
  - `all` 또는 `module`
  - `ModuleRefList`

- `ModuleRefList`는 빈 배열이어서는 안 된다.

---

## 3. Invariants & Constraints

### 3.1 MUST

- 공통 계약은 특정 프로토콜(HTTP/WS 등)에 종속되지 않아야 한다.
- DI/모듈 관련 declarations는 빌드 타임에 정적으로 판정 가능해야 한다.
- `Context`는 최소 `contextId`와 `adapterId`를 제공해야 한다.

- `CommonDecoratorDeclaration`은 런타임 훅이 아니라, 빌드 타임에 수집/판정되는 선언으로 취급되어야 한다.

### 3.2 MUST NOT

- 공통 계약이 특정 어댑터의 표현(상태 코드 등)에 종속되어서는 안 된다.
- Error와 Panic을 동일 타입/동일 경로로 처리하게 설계해서는 안 된다.

---

## 4. Observable Semantics

### 4.1 Input / Observable Outcome

- Input: 본 SPEC의 Static Shape에 부합하는 declarations
- Observable:
  - declarations는 AOT 입력으로 사용 가능해야 한다.

---

## 5. Violation Conditions

- Build-Time Violation: `Token`이 허용된 형태가 아닌데도 빌드가 성공하는 경우
- Build-Time Violation: `ProviderDeclaration`이 계약 형상과 불일치하는데도 빌드가 성공하는 경우

---

## 6. Handoff & Priority

### 6.1 Handoff

- di.spec.md는 `InjectCall` 및 `ProviderDeclaration`을 해석하여 wiring 규칙을 판정한다.
- provider.spec.md는 `InjectableOptions.scope` 의미론을 판정한다.
- di.spec.md는 `InjectableOptions.visibleTo` 의미론을 판정한다.
- error-handling.spec.md는 Panic/Error 변환 규칙을 판정한다.

### 6.2 Layer Priority

본 문서는 L3 SPEC에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 상위 문서가 우선한다.
