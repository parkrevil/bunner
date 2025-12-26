# 미들웨어 재설계 계획 (단일 인터페이스 + DI 기반 등록 + AOT 정합성)

## 0. 요약

이 계획의 목표는 “미들웨어 계약/등록/실행/AOT 검증”을 하나의 일관된 모델로 통합해, 새로운 어댑터가 늘어나도 확장 가능하고 결정적인(Deterministic) DX를 제공하는 것이다.

핵심 결정(확정 사항):

- `BunnerHttpMiddleware`는 완전히 제거한다. 미들웨어 계약은 **단일 추상 클래스** `BunnerMiddleware<TOptions = void>`만 유지한다(컨텍스트 기반).
- HTTP 어댑터의 `.use()/.beforeRequest()/.afterRequest()...` 형태의 API는 제거한다.
- 대신 `addMiddlewares(라이프사이클 enum, [미들웨어.withOptions(...) 또는 미들웨어 클래스])` 형태로 통일한다.
- 미들웨어는 DI로 생성되며, `withOptions`는 베이스 클래스의 static 메서드를 그대로 사용한다(각 미들웨어가 재정의할 필요 없음). 옵션은 프레임워크가 결정적으로 생성한 토큰으로 자동 주입한다(@InjectOptions 불필요).
- `ctx.to()`는 변환 실패 시 `BunnerContextError`(메시지만 포함)를 던진다. `tryTo`나 `isHttpContext` 같은 안전/가드 API는 제공하지 않는다.

이 문서는 PLAN.md만 보고 그대로 구현할 수 있도록 “파일 단위 변경 목록 + 타입 시그니처 + 런타임 흐름 + AOT 업데이트 + 마이그레이션 + 정리(클린업) 체크리스트”를 포함한다.

---

## 1. 배경(현재 문제)

### 1.1 계약이 2개라서 생기는 문제

현재는 미들웨어가 2종이다.

- 공용(컨텍스트 기반): `BunnerMiddleware.handle(context)`
- HTTP 전용(req/res 기반): `BunnerHttpMiddleware.handle(req, res)`

이로 인해 다음 문제가 발생한다.

- 라우트 스코프(`@UseMiddlewares`)는 실제 실행이 `handle(ctx)`인데, 타입은 `BunnerHttpMiddleware[]`로 되어 있어 계약이 깨져도 컴파일러가 못 잡는다.
- HTTP 어댑터 등록은 인스턴스(`new`)를 넘기는 것이 일반적인데, CLI(AOT)는 `configure()`에서 `Identifier`만 추적/검증하므로 AOT 정합성이 깨진다.
- 실행기(서버 스테이지 vs RequestHandler)가 단락(`false`) 처리 규칙이 서로 다르다.

### 1.2 AOT/결정성 제약

이 프로젝트는 런타임 스캔/반사가 아니라 CLI(AOT) 산출물 기반이 SSOT다.

따라서 미들웨어 등록은 다음을 만족해야 한다.

- `configure()`의 정적 분석으로 “어떤 미들웨어가 사용되는지”가 결정 가능해야 한다.
- 등록 방식이 인스턴스 생성(`new`)에 의존하면 AOT가 추적할 수 없다.

---

## 2. 목표(Design Goals)

### 2.1 DX 목표

- 미들웨어 작성자는 “하나의 인터페이스”만 배우면 된다.
- 애플리케이션 개발자는 “등록 API 하나(addMiddlewares)”만 배우면 된다.
- DI(주입)와 옵션(withOptions)이 자연스럽고, `new` 없이도 옵션을 넣을 수 있어야 한다.
- AOT가 `configure()`를 통해 미들웨어 사용을 추적/검증할 수 있어야 한다.

### 2.2 아키텍처 목표

- 런타임 스캔/폴백 금지(SSOT는 AOT).
- 어댑터가 늘어나도 공용 컨텍스트 계약은 유지되고, 어댑터별 접근은 “어댑터 패키지의 타입가드/헬퍼”로 확장한다.

---

## 3. 최종 사용자 API (공개 DX)

### 3.1 등록 API (HTTP 어댑터)

HTTP 어댑터는 다음 메서드만 제공한다.

```ts
httpAdapter.addMiddlewares(HttpMiddlewareLifecycle.BeforeRequest, [
  LoggerMiddleware,
  CorsMiddleware.withOptions({ origin: '*' }),
]);
```

규칙:

- 두 번째 인자는 반드시 배열이다.
- 배열 원소는 다음 중 하나만 허용한다.
  - 미들웨어 클래스 토큰 (예: `LoggerMiddleware`)
  - `withOptions()` 호출 결과(등록 디스크립터)
- `new`로 만든 인스턴스 전달은 금지(지원하지 않음).

### 3.2 라이프사이클 enum (HTTP 전용)

HTTP 어댑터 패키지 내부에 enum을 둔다.

```ts
export enum HttpMiddlewareLifecycle {
  BeforeRequest = 'BeforeRequest',
  AfterRequest = 'AfterRequest',
  BeforeHandler = 'BeforeHandler',
  BeforeResponse = 'BeforeResponse',
  AfterResponse = 'AfterResponse',
}
```

---

## 4. 타입/계약 (SSOT)

### 4.1 단일 미들웨어 계약(추상 클래스 + 제네릭 옵션)

`@bunner/common`에는 추상 클래스 하나만 남긴다.

변경 대상: `packages/common/src/interfaces.ts` (또는 `base-middleware.ts`로 분리 후 재export)

요구 시그니처:

```ts
export abstract class BunnerMiddleware<TOptions = void> {
  public static withOptions<T extends typeof BunnerMiddleware, TOptions>(
    this: T,
    options: TOptions,
  ): MiddlewareRegistration<TOptions> {
    return {
      token: this,
      options,
    };
  }

  public abstract handle(context: Context): void | boolean | Promise<void | boolean>;
}
```

정책:

- `false` 반환 시 체인 중단(다음 미들웨어/핸들러 실행 금지)
- `void` 또는 `true`는 계속 진행
- `withOptions`는 베이스 클래스 제공 메서드를 그대로 사용한다(미들웨어별 재정의 불필요)

### 4.2 Context 타입 최소 개선(미들웨어 계약에 직접 영향)

현재 `Context.get<T = any>` 및 `BunnerMiddleware.handle(context: any)` 등 `any`가 많다.
이번 변경에서 미들웨어 계약을 강제하기 위해 아래는 같이 수정한다.

- 변경 대상: `packages/common/src/interfaces.ts`

- `Context.get<T = unknown>(key: string): T | undefined`로 변경
- `BunnerMiddleware<TOptions>` 추상 클래스 도입에 맞춰 관련 타입을 제네릭으로 전파

주의: 다른 영역의 `any` 대청소는 범위 밖이다. “미들웨어 계약에 직접 연결된 부분”만 최소 변경한다.

---

## 5. 옵션(withOptions) 표준

### 5.1 목적

`new Middleware(opts)`를 금지하면 “옵션 전달”이 문제다.
이를 DI 방식으로 풀기 위해 `withOptions()`는 “옵션만 담은 등록값”을 반환하고, DI 토큰/프로바이더 구성은 프레임워크(어댑터/서버)가 내부에서 결정적으로 처리한다. `@InjectOptions` 같은 데코레이터 없이도 자동 주입된다.

### 5.2 표준 디스크립터 타입

변경/추가 대상(권장 위치): `packages/common/src/interfaces.ts` 또는 `packages/common/src/types.ts`

```ts
export type MiddlewareToken<TOptions = unknown> = Class<BunnerMiddleware<TOptions>>;

export interface MiddlewareRegistration<TOptions = unknown> {
  token: MiddlewareToken<TOptions>;
  options?: TOptions;
}
```

규칙:

- `token`은 미들웨어 클래스(컨테이너가 생성할 대상)
- `options`는 미들웨어 옵션 데이터만 담는다(Provider/Token 노출 금지)
- 옵션 주입을 위한 토큰 생성/등록은 런타임에서 결정적으로 수행되어야 한다(비결정적/랜덤 토큰 금지). `@InjectOptions`는 필요하지 않으며, 프레임워크가 옵션 토큰을 생성해 생성자 인자에 직접 바인딩한다.
- 옵션 토큰 네이밍은 `Symbol.for('middleware:<ClassName>:options:<index>')` 같은 결정적 규약을 사용해 다중 등록 시에도 충돌을 방지한다.
- 동일 미들웨어를 여러 번 등록할 수 있으며, 각 등록은 index 기반 옵션 토큰으로 분리된다. 옵션 제네릭을 선언만 하고 실제로 주입받지 않아도 허용된다(사용자가 주입을 생략할 수 있음).
- 미들웨어 인스턴스 토큰도 등록별로 분리한다(예: `Symbol.for('middleware:<ClassName>:instance:<index>')`). 컨테이너 캐시는 토큰 단위로 싱글턴이므로, 멀티 옵션 등록 시 인스턴스를 분리하려면 토큰이 달라야 한다.
- 옵션 주입 위치는 CLI/타입 분석으로 결정하며, 사용자가 별도 데코레이터나 위치 규약을 맞출 필요가 없다.

### 5.3 withOptions 구현 규칙

각 미들웨어는 필요 시 아래 형태를 제공한다.

```ts
export class CorsMiddleware extends BunnerMiddleware<CorsOptions> {
  // handle(ctx) 구현
}
```

주의:

- `withOptions()`는 “옵션만 담은 등록값 생성”만 한다. 인스턴스 생성(`new`)을 하면 안 된다.
- 옵션을 DI로 주입하는 구체 방법(토큰/프로바이더 등록)은 프레임워크가 내부에서 처리한다. 멀티 등록 시 옵션 토큰/인스턴스 토큰을 등록 순번으로 분리해 충돌을 방지한다.

---

## 6. 런타임 실행 흐름 (HTTP)

### 6.1 변경 후 파이프라인(요약)

HTTP 서버는 모든 스테이지에서 동일한 실행기를 사용한다.

- 입력: `BunnerMiddleware[]` + `Context`
- 규칙: `false` 반환 시 즉시 중단
- 미들웨어 인스턴스 스코프 기본값은 싱글턴으로 둔다(성능/경량 우선). 주입받는 서비스는 자신의 선언 스코프를 따른다. 요청 스코프 미들웨어가 필요할 경우 별도 옵션/설정을 통해 opt-in하도록 한다.
- 동일 미들웨어의 다중 등록(옵션 차이 포함)은 등록별 인스턴스 토큰을 분리해 각각 싱글턴 캐시를 갖도록 한다.

### 6.2 BunnerHttpServer에서의 적용

변경 대상: `packages/http-adapter/src/bunner-http-server.ts`

현재 문제:

- 서버 스테이지가 `BunnerHttpMiddleware[]`를 실행하며 반환값을 무시한다.

변경 후:

- 서버 스테이지도 `BunnerMiddleware[]`를 실행한다.
- `BunnerHttpServer.boot(container, options)`에서 다음을 수행한다.
  1. 옵션으로 전달된 stage별 `MiddlewareRegistration[]`를 수집한다.
  2. 등록 순번별 옵션 토큰(`Symbol.for('middleware:<Class>:options:<index>')`)을 값 프로바이더로 컨테이너에 등록한다.
  3. 등록 순번별 미들웨어 인스턴스 토큰(`Symbol.for('middleware:<Class>:instance:<index>')`)을 컨테이너에 등록하여, 각기 별도 인스턴스로 resolve한다(캐시는 토큰 단위 싱글턴).
  4. stage별 미들웨어 인스턴스를 컨테이너에서 resolve하여 `BunnerMiddleware[]`로 확정한다.
  5. 확정된 `BunnerMiddleware[]`를 런타임 실행에 사용한다(요청마다 resolve하지 않음).

중요: 컨테이너가 싱글턴/스코프를 어떻게 다루는지는 현재 구현에 따르되, 본 변경의 기본값은 “부팅 시 resolve 후 재사용”이다.

### 6.3 RequestHandler와의 정합성

변경 대상: `packages/http-adapter/src/request-handler.ts`, `packages/http-adapter/src/interfaces.ts`

- `RequestHandler.runMiddlewares(middlewares: BunnerMiddleware[], ctx: Context)`는 이미 `false` 단락을 구현하고 있으므로 이를 SSOT로 삼는다.
- `RouteHandlerEntry.middlewares`는 `BunnerMiddleware[]`로 바꿔서 “스코프 미들웨어는 항상 ctx 기반”을 타입으로 강제한다.

---

## 7. 어댑터별 접근(DX) 설계: toXxx 금지, 클래스 토큰 기반 변환

### 7.1 원칙

- 공용 컨텍스트는 어떤 어댑터가 늘어나도 고정 계약을 유지한다.
- 특정 어댑터 기능(예: HTTP의 req/res)은 `ctx.to(HttpContext)`처럼 “어댑터가 제공하는 컨텍스트 클래스”로 좁힌다.

### 7.2 사용 예

```ts
const http = ctx.to(HttpContext);
http.response.setHeader('x', 'y');
```

### 7.3 실패 시 동작

- `ctx.to(SomeContext)` 실패 시 `BunnerContextError`(메시지만 포함, 코드 없음)를 던진다.
- `tryTo`/`isHttpContext` 같은 안전/가드 API는 제공하지 않는다.

---

## 8. AOT/CLI 업데이트 (configure 추출 규칙 변경)

### 8.1 현행 제약

현재 CLI는 `configure()` 본문에서 메서드명이 `use/beforeRequest/...`인 호출을 찾고, 인자가 `Identifier`인 것만 미들웨어로 추출한다.
즉, `new Middleware()`는 AOT가 추적하지 못한다.

### 8.2 변경 목표

변경 대상: `packages/cli/src/analyzer/ast-parser.ts`

- `extractMiddlewaresFromConfigure()`가 `addMiddlewares(...)` 호출만 대상으로 한다.
- 추출 대상 형태:
  - `httpAdapter.addMiddlewares(Lifecycle, [A, B.withOptions(...)])`
  - 배열 원소가 `Identifier`면 해당 이름을 수집
  - 배열 원소가 `CallExpression`이고 callee가 `MemberExpression(Identifier, 'withOptions')`면 “object Identifier”를 수집

구체 AST 패턴(필수):

- CallExpression
  - callee: MemberExpression (property.name === 'addMiddlewares')
  - `arguments[1]`: ArrayExpression
    - `elements[i]`:
      - Identifier -> push(name)
      - CallExpression where callee is MemberExpression and property.name === 'withOptions'
        - callee.object is Identifier -> push(callee.object.name)

지원하지 않는 패턴(명시적으로 무시 또는 실패):

- SpreadElement
- 동적 계산 specifier
- 배열이 아닌 두 번째 인자
- 위 패턴이 감지되면 “addMiddlewares는 리터럴 배열 + Identifier/withOptions만 지원” 형태의 오류를 명시적으로 발생시킨다(조용한 누락 금지).
- `withOptions` 호출은 베이스 클래스 static 호출(`Identifier.withOptions(...)`)을 포함하며, 배열 내 각 요소의 index를 함께 기록해 옵션/인스턴스 토큰을 결정한다.

### 8.3 그래프 검증

변경 대상: `packages/cli/src/analyzer/graph/module-graph.ts`

- 현재는 “추출된 클래스 이름이 @Middleware 데코레이터가 있는지”만 검증한다.
- `addMiddlewares`로 변경해도 같은 정책을 유지한다.
- 단, 검증 메시지/설명은 `use()`가 아니라 `addMiddlewares()` 기준으로 업데이트한다.

---

## 9. 코드 변경 목록(파일 단위)

### 9.1 공용(common)

- `packages/common/src/interfaces.ts`
  - `BunnerMiddleware<TOptions = void>` 추상 클래스 + `static withOptions` 추가
  - `handle(context: Context): void | boolean | Promise<void | boolean>` 유지
  - `Context.get<T = unknown>`로 변경
  - `MiddlewareToken<TOptions>`, `MiddlewareRegistration<TOptions>` 제네릭 타입 추가(적절한 위치에 배치)
  - `BunnerContextError` 타입 정의 추가(메시지 필드만, 코드 없음) — `ctx.to()` 실패 시 사용

### 9.2 HTTP 어댑터

- `packages/http-adapter/src/interfaces.ts`
  - `BunnerHttpMiddleware` 제거
  - `HttpMiddlewareLifecycle` 추가
  - `RouteHandlerEntry.middlewares: BunnerMiddleware[]`로 변경
  - `BunnerHttpServerOptions.middlewares` 타입을 stage별 `MiddlewareRegistration[]`(또는 token 배열)로 변경

- `packages/http-adapter/src/bunner-http-adapter.ts`
  - `.use/.beforeRequest/.afterRequest/.beforeHandler/.beforeResponse/.afterResponse` 제거
  - `addMiddlewares(lifecycle: HttpMiddlewareLifecycle, middlewares: readonly (MiddlewareToken | MiddlewareRegistration)[]): this` 추가
  - 내부 저장 구조는 “stage별 등록 디스크립터 배열”로 유지

- `packages/http-adapter/src/bunner-http-server.ts`
  - stage 실행을 `BunnerMiddleware[] + Context` 기반으로 통일
  - boot 시점에 등록 디스크립터 → 컨테이너 등록 → 인스턴스 resolve → stage별 실행 리스트 확정
  - 실행기는 `false` 단락을 존중

- `packages/http-adapter/src/request-handler.ts`
  - `RouteHandlerEntry` 타입 변경에 맞춘 정합성 수정
  - (필요 시) runMiddlewares를 공용 유틸로 올리거나 서버가 동일 로직을 사용하도록 정리

- `packages/http-adapter/src/middlewares/**`
  - 파일 위치는 유지한다(요구사항)
  - 각 미들웨어는 `BunnerMiddleware`를 구현하도록 변경
  - HTTP 전용 접근은 `ctx.to(HttpContext)`로 좁힌다(실패 시 예외).
  - 옵션이 필요한 미들웨어는 베이스 클래스의 `static withOptions()`를 그대로 사용한다(재정의 불필요).

### 9.3 CLI

- `packages/cli/src/analyzer/ast-parser.ts`
  - `extractMiddlewaresFromConfigure()`가 `addMiddlewares()` + 배열 인자 + withOptions 패턴을 추출하며, 배열 index를 함께 기록해 옵션/인스턴스 토큰 결정에 활용

- `packages/cli/src/analyzer/graph/module-graph.ts`
  - 검증 메시지/설명 업데이트(필요 시)

### 9.4 예제

- `examples/src/app.module.ts`
  - `httpAdapter.use(new ...)` 제거
  - `httpAdapter.addMiddlewares(HttpMiddlewareLifecycle.BeforeRequest, [...])` 형태로 교체
  - `withOptions()`를 사용하도록 교체

---

## 10. 마이그레이션 가이드(사용자 코드)

### 10.1 등록 API

Before:

```ts
httpAdapter.use(new LoggerMiddleware(), new CorsMiddleware({ origin: '*' }));
```

After:

```ts
httpAdapter.addMiddlewares(HttpMiddlewareLifecycle.BeforeRequest, [
  LoggerMiddleware,
  CorsMiddleware.withOptions({ origin: '*' }),
]);
```

### 10.2 미들웨어 구현

Before:

```ts
export class CorsMiddleware implements BunnerHttpMiddleware {
  handle(req, res) { ... }
}
```

After:

```ts
export class CorsMiddleware extends BunnerMiddleware<CorsOptions> {
  public async handle(ctx: Context): Promise<void | boolean> {
    const http = ctx.to(HttpContext);

    const req = http.request;
    const res = http.response;
    ...
  }
}
```

---

## 11. 정리(클린업) 단계: 불필요해진 파일/코드 제거 체크리스트

모든 기능 변경이 끝난 뒤, 아래를 “정리 전용 커밋/작업”으로 수행한다.

- `BunnerHttpMiddleware` 정의/exports/사용처가 완전히 사라졌는지 전수 확인
  - `packages/http-adapter/src/interfaces.ts`
  - `packages/http-adapter/src/bunner-http-adapter.ts`
  - `packages/http-adapter/src/bunner-http-server.ts`
  - `packages/http-adapter/src/middlewares/**`
  - `examples/**`
- 제거된 `.use/.beforeRequest/...`가 문서/예제/테스트에 남아있는지 전수 확인
- CLI analyzer가 더 이상 `use/beforeRequest/...`를 추출하지 않는지 확인
- 타입 정합성:
  - `RouteHandlerEntry.middlewares`가 `BunnerMiddleware[]`로 고정됐는지
  - 서버 스테이지 실행기가 `false` 단락을 존중하는지
- public facade(index.ts)에서 불필요한 export가 남지 않았는지 확인(명시 export 유지)

---

## 12. 검증(Verification)

최소 검증 시나리오(반드시 통과해야 함):

1. AOT 분석

- `Configurer.configure()`에 `addMiddlewares()`가 있는 예제를 만들어 CLI 분석이 미들웨어 클래스를 정확히 추출하는지 확인
- `withOptions()` 패턴도 추출되는지 확인

2. 런타임 HTTP

- `BeforeRequest`에 CORS/QueryParser 같은 미들웨어를 등록하고 실제 요청에서 동작 확인
- 미들웨어가 `false`를 반환하면 핸들러가 호출되지 않는지 확인
- 잘못된 컨텍스트에서 `ctx.to(HttpContext)` 호출 시 `BunnerContextError`가 발생하는지 확인

3. 타입 안전

- 라우트 스코프 `@UseMiddlewares`에 req/res 기반 구현을 붙일 수 없게(컴파일 단계에서) 막히는지 확인

4. 회귀

- `bun test` / `tsc` / `eslint`가 통과하는지 확인

---

## 13. 구현 순서(권장)

1. common 계약/타입 추가(단일 미들웨어 인터페이스 확정)
2. http-adapter: interfaces.ts 타입 변경 + addMiddlewares API 추가(아직 실행기는 구버전일 수 있음)
3. http-adapter: server 실행기 ctx 기반으로 통합 + stage 단락 처리 통일
4. http-adapter: built-in middlewares를 단일 인터페이스로 마이그레이션 + withOptions 도입
5. cli: addMiddlewares 추출/검증으로 업데이트
6. examples: addMiddlewares로 마이그레이션
7. 정리(클린업) 전수 확인 및 불필요 코드 제거

## 9. 오픈 이슈(결정 필요)

1. `httpTargets` 기본값

- 안전 우선: 기본값 없음(명시 강제)
- DX 우선: 기본값 `'all'`

2. base path(`/api-docs`) 커스터마이즈

- v1: 고정
- v2: `basePath` 옵션 추가(옵션 증가)

3. 문서 생성 소스

- 현재는 `globalThis.__BUNNER_METADATA_REGISTRY__` 기반(OpenAPIFactory)
- WS/GRPC/QUEUE는 producer 확장 포인트를 어떻게 표준화할지

---

## 10. 용어 및 경계 정의(필수 규범)

이 프로젝트는 NestJS에서 애매했던 경계를 명확히 하기 위해 아래 규칙을 “공식 정의”로 채택한다.

### 10.1 Adapter / Plugin / Module 정의

#### Adapter (어댑터)

- **정의**: `BunnerAdapter`를 구현하고 `start(context)` / `stop()`으로 **런타임 리소스(서버/워커/리스너)를 직접 실행/중지**하는 단위
- **소유권**: 프로세스/네트워크/워커 등 “실행 단위”를 소유한다.
- **부착 지점**: `BunnerApplication.addAdapter()`로 등록되며, `AdapterCollection`을 통해 이름으로 선택된다.
- **예시**: HTTP, WS, gRPC, Queue 어댑터

#### Plugin (플러그인)

- **정의**: 어댑터 또는 컨테이너에 **설치(attach/setup)** 되어 기능을 확장하지만, 스스로 `BunnerAdapter`로서 서버/워커를 “실행”하지는 않는 단위
- **소유권**: 실행 단위를 소유하지 않고, 기존 실행 단위에 기능을 “붙인다”.
- **부착 지점**: 명확해야 한다.
  - 예: `Scalar -> (선택된) HTTP adapter(들)`
  - 예: `TypeORM -> Container(또는 App)`
- **예시**: 문서 호스팅, 메트릭/트레이싱 설치, DB 연결/Repository 설치

#### Module (모듈)

- **정의**: DI 스캐너가 읽는 **구성 그래프 단위**(controllers/providers/imports)
- **역할**: 앱 기능 조립(비즈니스 로직 구성)과 의존 주입 관계를 선언한다.
- **원칙**: 인프라를 “켜는 행위(연결/호스팅/마이그레이션 실행 등)”를 모듈이 숨기지 않는다.
- **예시**: Users/Posts/Billing 같은 도메인 모듈

### 10.2 판정 규칙(결정 트리)

아래 질문으로 분류가 결정된다.

1. `start/stop`으로 서버/워커/리스너를 직접 실행해야 하는가?

- Yes => Adapter

2. DI 그래프(controllers/providers/imports)를 구성하는가?

- Yes => Module

3. 기존 실행 단위(어댑터/컨테이너)에 설치되어 기능을 추가하는가?

- Yes => Plugin

> NOTE: 하나의 기능이 Module+Plugin처럼 보이면, “인프라를 켜는 부분”은 Plugin으로 분리하고,
> Module은 주입받아 사용하는 쪽만 남긴다.

### 10.3 금지 규칙(경계 강제)

- (금지) Plugin을 Module로 위장하여 `imports: [XxxModule.forRoot()]`로 인프라 설치를 숨기지 않는다.
  - 예: DB 연결/문서 호스팅/트레이싱 설치를 Module import로 해결하는 패턴 금지
- (금지) Adapter가 도메인 기능을 직접 포함하지 않는다.
  - Adapter는 transport 실행과 요청/메시지 전달에 집중한다.

### 10.4 이 문서 범위에서의 확정 분류

- Scalar: **Plugin**
  - 역할: 문서 생성 대상 선택(`documentTargets`) + HTTP 호스팅 대상 선택(`httpTargets`)
  - 부착 지점: 선택된 HTTP adapter(들)

- TypeORM 통합: **Plugin**
  - 역할: DataSource/Repository 설치, 연결 라이프사이클, (선택) 마이그레이션
  - 부착 지점: Container(또는 App)
  - 도메인 모듈은 TypeORM을 “설치”하지 않고 주입받아 사용만 한다.
