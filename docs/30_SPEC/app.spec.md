# `App` Specification

L3 Implementation Contract
본 문서는 `App`에 대한 구현 계약이다.
본 계약은 기계적 검증 가능성(Mechanical Verifiability)을 최우선 기준으로 하며,
구현 방법, 튜토리얼, 사용 가이드를 포함하지 않는다.

---

## 1. Context

### 1.1 Purpose

본 SPEC은 Bunner의 애플리케이션(App) 부트스트랩과 생명주기(lifecycle),
그리고 App-External Code에서의 접근 표면이 유효한 구현으로 성립하는 조건을 정의한다.

### 1.2 Scope & Boundary

In-Scope:

- `createApp`의 부트스트랩 단계(Env/Config preload 포함)와 완료 조건
- `createApp`의 Entry Module 지정 입력 및 판정 규칙
- `app.start`, `app.stop`, `app.get(Token)`의 관측 가능한 의미론
- `app.applyAdapter(AdapterId, options)`의 판정 규칙 및 허용 범위
- App lifecycle hook의 수집(AST) 규칙 및 호출 순서(결정성)
- App 표면에서의 실패 표현(throw/panic) 및 금지 규칙

Out-of-Scope:

- DI 그래프 구성/순환 판정 → di.spec.md
- Provider init/dispose 및 scope 의미론 → provider.spec.md
- 어댑터 파이프라인(정상 실행) 의미론 → execution.spec.md
- 프로토콜별 입출력 표현 및 응답 렌더링 → adapter.spec.md
- throw 처리(에러 필터 체인) 의미론 → error-handling.spec.md
- Runtime Report(DevTools 목적) 형상 → devtools.spec.md

### 1.3 Definitions

Normative: 본 SPEC은 file-local 용어 정의를 포함하지 않는다.

---

## 2. Static Shape

본 섹션은 CLI, 정적 분석기, 코드 생성기가 참조하는 데이터 형상(Data Shape)만을 정의한다.

### 2.1 Core Data Shapes

Normative: 아래에 정의된 형상이 계약이다.

AppLifecycleHookMethodName:

- type: string
- allowed values:
  - "onModuleInit"
  - "onModuleDestroy"
  - "onApplicationBootstrap"
  - "beforeApplicationShutdown"
  - "onApplicationShutdown"

AppLifecycleHookTarget:

- type: string
- allowed values:
  - injectable

AppLifecycleHookDeclaration:

- type: object
- required:
  - target
  - methodName
- properties:
  - target: AppLifecycleHookTarget
  - methodName: AppLifecycleHookMethodName
  - token: Token (common.spec.md)

### 2.2 Shape Conformance Rules

- `AppLifecycleHookDeclaration.target`가 `injectable`인 경우, `token`은 반드시 존재해야 한다.

---

## 3. Invariants & Constraints

### 3.1 MUST

- `createApp`은 비동기적으로 완료되어야 한다.

- `createApp`은 정확히 1개의 Entry Module을 입력으로 받아야 한다.
  - Entry Module은 ModuleRef(common.spec.md)로 빌드 타임에 직접 판정 가능해야 한다.

- `createApp`은 Env/Config preload를 포함해야 하며, preload 결과는 런타임 동안 변경되지 않아야 한다.

- `createApp`은 빌드 타임에 생성된 Manifest 산출물을 기반으로 부트스트랩을 수행해야 한다.
  - Manifest 형상 및 결정성은 manifest.spec.md가 판정한다.

- App의 부트스트랩 이후 구조 판정을 위한 메타데이터는 실행 경로를 변경하는 근거로 사용되어서는 안 된다.
  - 상위 문서의 Metadata Volatility 전제를 위반하는 동작은 허용되지 않는다.

- `app.start`는 App의 실행을 시작해야 한다.

- `app.applyAdapter(AdapterId, options)`는 App-External Code에서 어댑터 옵션을 바인딩하기 위한 입력으로 사용될 수 있어야 한다.

- `app.applyAdapter`의 AdapterId 인자는 빌드 타임에 AdapterId(common.spec.md)로 직접 판정 가능해야 한다.

- `app.applyAdapter`는 정적 그래프(Manifest 및 정적 wiring)를 변경해서는 안 된다.

- `app.stop`는 App의 종료를 수행해야 하며, App이 소유하는 모든 리소스(Provider 및 Adapter-owned resources)를 정리해야 한다.

- `app.get(Token)`은 App-External Code에서 DI 결과에 접근하는 유일한 경로여야 한다.
  - `app.get(Token)`의 성공 조건은 di.spec.md의 규칙과 일치해야 한다.

- App lifecycle hook은 런타임 리플렉션이 아니라 AST 기반 수집 결과에 의해 결정되어야 한다.
  - 대상은 `@Injectable()`이 적용된 클래스(Provider)여야 한다.

- `onModuleInit` 훅은 Provider 초기화 순서와 동일한 결정적 순서로 호출되어야 한다.

- `onApplicationBootstrap` 훅은 모든 `onModuleInit` 훅 호출 이후에 1회 호출되어야 한다.

- 종료 시, `beforeApplicationShutdown` 훅은 `onModuleDestroy` 훅 호출 이전에 1회 호출되어야 한다.

- `onModuleDestroy` 훅은 Provider dispose 순서와 동일한 결정적 순서(의존성 그래프 역순)로 호출되어야 한다.

- `onApplicationShutdown` 훅은 모든 `onModuleDestroy` 훅 호출 이후에 1회 호출되어야 한다.

- `app.stop`은 어떤 경우에도 throw가 관측되어서는 안 된다.

### 3.2 MUST NOT

- `createApp | app.start | app.stop | app.get(Token)`은 Result를 반환해서는 안 된다.

- `app.applyAdapter`는 `app.start` 이후에 관측되어서는 안 된다.

- `createApp | app.start | app.stop | app.get(Token) | app.applyAdapter`는 Result를 반환해서는 안 된다.

- App lifecycle hook은 모듈 경계(module-system.spec.md)의 런타임 엔티티를 전제로 해서는 안 된다.

---

## 4. Observable Semantics

### 4.1 Input / Observable Outcome

- Input: App-External Code에서의 `createApp` 호출
- Observable:
  - `createApp`이 성공하면 App 인스턴스가 생성되어야 한다.
  - `createApp`이 실패하면 throw가 관측되어야 한다.

- Input: App-External Code에서의 `app.start` 호출
- Observable:
  - `app.start`가 성공하면 App은 실행 상태로 전이되어야 한다.
  - `app.start`가 실패하면 throw가 관측되어야 한다.

- Input: App-External Code에서의 `app.stop` 호출
- Observable:
  - `app.stop` 호출은 종료 처리를 수행해야 한다.
  - `app.stop` 호출에서 throw가 관측되어서는 안 된다.

### 4.2 State Conditions

- `app.stop` 호출 이후, App은 실행 경로를 생성해서는 안 된다.

---

## 5. Violation Conditions

- Build-Time Violation: App lifecycle hook이 런타임 리플렉션에 의해 결정되는데도 빌드가 성공하는 경우
- Runtime Violation: `app.stop`에서 throw가 관측되는 경우

---

## 6. Handoff & Priority

### 6.1 Handoff

- DI 그래프 판정 및 `app.get(Token)` 성공 조건 → di.spec.md
- Provider init/dispose 순서 및 의미론 → provider.spec.md
- 어댑터 파이프라인(정상 실행) 의미론 및 Result 사용 범위 → execution.spec.md
- throw 처리(에러 필터 체인) 의미론 → error-handling.spec.md

### 6.2 Layer Priority

본 SPEC은 L3에 속한다.
L1 불변식 또는 L2 아키텍처와 충돌할 경우, 상위 문서가 우선한다.
