# 미들웨어 아키텍처 재설계 및 Fluent API 구현 계획 (Multi-Adapter Support)

## 목표 설명 (Goal Description)
**"Named Adapter Access"** 패턴을 도입하여 다중 어댑터(예: Public API, Admin API) 환경에서 최상의 DX를 제공합니다. 또한 기존의 `Context` 기반 미들웨어를 제거하고 어댑터별로 엄격한 타입(`BunnerHttpMiddleware`)을 사용하는 시스템으로 전환합니다. 5단계 라이프사이클 훅을 통해 정교한 요청 제어를 지원하며, 빌드 타임 검증을 통해 안정성을 확보합니다.

## 사용자 검토 필요 (User Review Required)
> [!IMPORTANT]
> **다중 어댑터 및 Named Adapter Access**:
> - `BunnerApplication`에 어댑터를 등록할 때 **'이름(Name)'**을 부여하여 식별합니다.
> - `Configurer` 인터페이스의 `configure` 메서드는 `app`과 함께 **`adapters: AdapterCollection`**을 인자로 받습니다.
> - 사용자는 `adapters.http.get('public-server')` 또는 `adapters.http.forEach(...)`와 같이 직관적으로 어댑터를 선택하여 설정을 적용할 수 있습니다.
>
> **미들웨어 인터페이스 격리**:
> - Common 패키지에는 미들웨어 인터페이스를 정의하지 않습니다. (오직 데코레이터만)
> - `BunnerHttpMiddleware`는 `http-adapter` 패키지에 독립적으로 정의됩니다.
>
> **AOT 검증**:
> - `configure` 내에서 사용되는 미들웨어 클래스에 `@Middleware` 데코레이터가 없으면 빌드 타임에 에러를 발생시킵니다.

## 변경 제안 (Proposed Changes)

### @bunner/common (Component)

#### [NEW] [src/decorators/middleware.decorator.ts](file:///Users/pjh/Desktop/bunner/packages/common/src/decorators/middleware.decorator.ts)
- `@Middleware()` 데코레이터 정의.

#### [MODIFY] [src/interfaces/interfaces.ts](file:///Users/pjh/Desktop/bunner/packages/common/src/interfaces/interfaces.ts)
- **`AdapterGroup<T>`** 인터페이스 정의.
  ```typescript
  export interface AdapterGroup<T> {
    get(name: string): T | undefined;
    all(): T[];
    forEach(cb: (adapter: T) => void): void;
  }
  ```
- **`AdapterCollection`** 인터페이스 정의.
  ```typescript
  export interface AdapterCollection {
    [protocol: string]: AdapterGroup<any>;
    // http?: AdapterGroup<any>; // (실제 사용시 확장 가능하도록)
  }
  ```
- **`Configurer`** 인터페이스 정의.
  ```typescript
  export interface Configurer {
    configure(app: any, adapters: AdapterCollection): void;
  }
  ```

#### [MODIFY] [src/index.ts](file:///Users/pjh/Desktop/bunner/packages/common/src/index.ts)
- 새로운 심볼 export.

### @bunner/core (Component)

#### [DELETE] [src/middleware/middleware.ts](file:///Users/pjh/Desktop/bunner/packages/core/src/middleware/middleware.ts)
- 구 미들웨어 코드 삭제.

#### [MODIFY] [src/application/bunner-application.ts](file:///Users/pjh/Desktop/bunner/packages/core/src/application/bunner-application.ts)
- `addAdapter(adapter: BunnerAdapter, options?: { name?: string })`: 어댑터 등록 시 이름 식별 지원.
- 내부적으로 `adapters`를 Map 또는 그룹화된 구조로 관리.
- `init()` 시점에 `AdapterCollection`을 구성하여 각 모듈의 `configure` 메서드에 주입.

### @bunner/http-adapter (Component)

#### [MODIFY] [src/interfaces/index.ts](file:///Users/pjh/Desktop/bunner/packages/http-adapter/src/interfaces/index.ts)
- **`BunnerHttpMiddleware`** 독립적 정의 (`handle(req, res)`).

#### [MODIFY] [src/middlewares/cors/cors.middleware.ts](file:///Users/pjh/Desktop/bunner/packages/http-adapter/src/middlewares/cors/cors.middleware.ts)
- 리팩토링: `BunnerHttpMiddleware` 구현.

#### [MODIFY] [src/adapter/http-adapter.ts](file:///Users/pjh/Desktop/bunner/packages/http-adapter/src/adapter/http-adapter.ts)
- **Fluent API & Lifecycle Hooks**:
  - `beforeRequest`, `afterRequest`, `beforeHandler`, `beforeResponse`, `afterResponse` 구현.
- 각 단계별 미들웨어 실행 로직 구현.

### @bunner/cli (Build System)

#### [MODIFY] [src/analyzer/ast-parser.ts](file:///Users/pjh/Desktop/bunner/packages/cli/src/analyzer/ast-parser.ts)
- `configure` 메서드 분석 시 `@Middleware` 데코레이터 검증 로직 추가.

## 검증 계획 (Verification Plan)

### 자동화 테스트
- `examples`에서 두 개의 HTTP 어댑터(8080, 8081 포트)를 등록하여 테스트.
- `AppModule`의 `configure`에서 `adapters.http.get('adapter1')` 등으로 개별 설정 적용 확인.
- 각 어댑터별로 다른 미들웨어가 적용되는지 검증.

### 수동 검증
- `bunner build` 실행 및 데코레이터 검증 테스트.
- 서버 구동 후 각 포트로 요청을 보내 개별 설정된 미들웨어 동작 확인.
