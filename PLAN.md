# ErrorFilter 표준화 계획 (ErrorHandler 완전 제거)

이 문서는 **ErrorFilter 관련 내용만** 포함한다.
미들웨어/스칼라/용어 정의 등 다른 계획은 이 문서에서 다루지 않는다.

---

## 0. 목표와 범위

### 0.1 목표

- 기존 `ErrorHandler` 기반 에러 처리(타입/데코레이터/런타임 실행)를 **ErrorFilter 단일 모델**로 표준화한다.
- 결정적인 실행 규칙을 제공한다(arity 추론/런타임 스캔/묵시적 동작 제거).
- `@bunner/common`은 transport-agnostic 경계를 유지한다(HTTP 시그니처 금지).
- AOT(CLI)에서 사용된 Filter 토큰이 유효한지 검증 가능해야 한다.

### 0.2 비목표

- “필터가 응답 body를 자동으로 만들어 주는” 규칙을 표준으로 넣지 않는다.
- 런타임 reflection/scan(`reflect-metadata`)은 하지 않는다(레지스트리 소비만).

---

## 1. 핵심 결정(확정)

1. `ErrorHandler`는 **완전히 제거**하고 `ErrorFilter`로 네이밍을 통일한다(레거시/호환 API 금지).

2. ErrorFilter는 DI 기반으로 생성된다.

3. ErrorFilter의 실행 메서드는 `catch()`이며 반환값은 없다.

```ts
catch(error, context): void | Promise<void>
```

4. ErrorFilter는 `@Catch(...)`로 식별한다.

5. 등록 API는 다음 2가지가 SSOT이다.

- 스코프(Controller/Method): `@UseErrorFilters(...)`
- 전역(HTTP Adapter): `httpAdapter.addErrorFilters([...])`

6. ErrorFilter는 **beforeResponse 직전까지 발생한 에러만** 처리한다.

- `beforeResponse` / `afterResponse` 단계에서 발생한 에러는 ErrorFilter로 절대 넘기지 않는다.
- 해당 단계 에러는 (가능하면) `status=500`만 설정하고, **body는 설정하지 않는다**.

---

## 2. 공개 DX (사용자 API)

### 2.1 ErrorFilter 선언

```ts
@Catch()
export class UnknownErrorFilter extends BunnerErrorFilter {
  public async catch(error: unknown, ctx: Context): Promise<void> {
    // HTTP에서 응답을 만들고 싶으면:
    // const http = ctx.to(BunnerHttpContext);
    // http.response.setStatus(500);
  }
}
```

규칙:

- ErrorFilter는 반드시 클래스여야 한다(함수형 핸들러 금지).
- 인스턴스를 `new`로 직접 넘기는 등록 방식은 금지한다(DI로만 생성).

### 2.2 스코프 등록(Decorator)

```ts
@UseErrorFilters(PaymentErrorFilter)
export class BillingController {}
```

규칙:

- `@UseErrorFilters(...)` 인자는 반드시 클래스 토큰(Identifier)이어야 한다(AOT 결정을 위해).

### 2.3 전역 등록(HTTP Adapter)

```ts
httpAdapter.addErrorFilters([HttpErrorFilter, PaymentErrorFilter, UnknownErrorFilter]);
```

규칙:

- 인자는 배열 1개만 받는다.
- 배열 원소는 ErrorFilter “클래스 토큰”만 허용한다.

---

## 3. 공용 계약(SSOT): @bunner/common

### 3.1 타입/클래스 추가 위치

- SSOT: `packages/common/src/interfaces.ts`

### 3.2 ErrorFilter 베이스 클래스

```ts
export abstract class BunnerErrorFilter<TError = unknown> {
  public abstract catch(error: TError, context: Context): void | Promise<void>;
}
```

정책:

- 기본 `TError = unknown`이지만 작성자가 직접 지정할 수 있다.
- 런타임에서 들어오는 값이 `Error`일 필요는 없다(매칭 규칙으로 실행 대상을 결정).

### 3.3 토큰 타입

```ts
export type ErrorFilterToken = Class<BunnerErrorFilter> | symbol;
```

주의:

- HTTP 전용 시그니처(`err, req, res, next`)는 `@bunner/common`에 존재하면 안 된다.

---

## 4. 데코레이터(SSOT): @bunner/common

변경 대상: `packages/common/src/decorators/exception.decorator.ts`

### 4.1 `@Catch(...)`

- 식별자이며 런타임 구현은 no-op이어도 된다(레지스트리 기반).

### 4.2 `@UseErrorHandlers` 제거, `@UseErrorFilters` 추가

- `UseErrorHandlers`는 완전히 제거한다(alias/Deprecated 금지).
- `UseErrorFilters(...filters)`를 추가한다.

---

## 5. 런타임(HTTP Adapter): 에러 파이프라인 확정

### 5.1 요청 처리 흐름(요약)

정상 경로:

```text
beforeRequest middlewares
  -> routing
    -> scoped middlewares
      -> handler
        -> beforeResponse middlewares
          -> afterResponse middlewares
            -> response end
```

에러 경로(탈출로):

- 위 정상 경로 중 **beforeResponse 직전까지** throw/reject가 발생하면 ErrorFilter로 이동한다.
- ErrorFilter가 실행되면 정상 흐름으로 되돌아가지 않는다.

### 5.2 실행 대상(순서)

1. 스코프(라우트) ErrorFilters
2. 전역(어댑터 등록) ErrorFilters

### 5.3 매칭 규칙(@Catch)

메타데이터 레지스트리에서 해당 Filter 클래스의 `@Catch(...)` 인자를 읽어 매칭한다.

- `@Catch()` (인자 없음): 모든 에러를 매칭
- `@Catch(SomeClass)`: `error instanceof SomeClass`
- `@Catch(String)`: `typeof error === 'string'` 또는 `error instanceof String`
- `@Catch(Number)`: `typeof error === 'number'` 또는 `error instanceof Number`
- `@Catch(Boolean)`: `typeof error === 'boolean'` 또는 `error instanceof Boolean`
- `@Catch('LITERAL')`: `error === 'LITERAL'`

### 5.4 호출 규칙

- 항상 `filter.catch(error, ctx)`로만 호출한다.
- arity(`fn.length`) 기반 분기/HTTP 시그니처 호출은 존재하면 안 된다.

### 5.5 전파/종료 규칙 (NestJS 대비: Bunner 선택)

NestJS는 “매칭된 필터가 응답을 안 쓰고 return 하면 요청이 멈출 수 있는 모델”을 채택한다.

Bunner는 DX/안정성 관점에서 다음 규칙을 공식 정의로 채택한다.

확정(요약):

- ErrorFilter에서 발생한 throw/reject는 다음 ErrorFilter로 전파될 수 있다(의도/버그 구분 없음).
- 전파가 끝날 때까지도 처리되지 않으면 최종 책임은 어댑터(Default Error Handler)다.

전제(중요):

- ErrorFilter는 **항상 beforeResponse 이전 단계**에서만 실행된다.
- 따라서 ErrorFilter는 “응답을 전송(send)해서 종결”하는 컴포넌트가 아니다.
  - ErrorFilter의 역할은 **(transport별 컨텍스트를 통해) 응답 상태를 ‘조정’**하는 것에 한정된다.
  - 이후 파이프라인은 **항상** `beforeResponse -> afterResponse -> response end`로 진행된다.
- `catch()`는 반환값으로 처리 여부를 표현하지 않는다(`return true/false` 같은 모델 금지).

실행 규칙:

1. 선언 순서대로 “매칭되는 필터”만 실행한다.

2. 매칭된 filter 실행 중 throw가 발생하면:

이 시점에서 “사용자 의도 위임(=rethrow)”과 “필터 버그”를 런타임이 구분하는 것은 원칙적으로 불가능하다.
따라서 Bunner는 **NestJS와 유사하게** throw/reject 자체를 “다음 필터로 전달되는 에러 값”으로 취급한다.

- (규칙) Filter 내부에서 throw/reject가 발생하면:
  - 그 값을 “새 error”로 간주하고 다음 ErrorFilter 매칭/실행을 계속한다.

관측 가능성(권장):

- 런타임은 내부적으로 `(originalError -> thrownError -> ...)` 형태의 체인을 로깅에 남길 수 있다.
- 다만 매칭 규칙의 결정성을 해치지 않기 위해, 기본적으로 다음 필터로 전달되는 error 자체를 임의 wrapper로 바꿔치기하지 않는다.

3. filter가 정상 종료했을 때:

- 해당 filter의 역할은 “그 시점에서 끝”이다.
- 다음 filter 실행 여부는 **매칭 규칙**과 **선언 순서**에 의해 결정된다.

4. 모든 filter 실행이 끝나면:

- 요청은 **항상** `beforeResponse` 단계로 진행한다(정상 흐름으로 “복귀”가 아니라, 응답을 마무리하는 고정된 후속 단계).

추가 규칙(운영 안정성 / 기본 에러 응답 보장):

- ErrorFilter 체인 이후에도 응답 상태가 “결정되지 않은” 경우를 허용하지 않는다.
- 이때의 “결정”은 transport별이지만, HTTP에서는 최소한 아래를 보장한다.
  - (필수) 에러 경로로 진입한 경우, 사용자가 명시적으로 status를 설정하지 않았다면 어댑터가 `status=500`을 설정한다.
  - body는 프레임워크가 임의로 풍부하게 만들지 않는다(최소/보수적으로).

참고(HTTP Adapter의 기본 동작 예):

- 에러 경로로 진입했는데 status가 설정되지 않았다면 `status=500`을 설정한다.
- 이후 `beforeResponse/afterResponse`를 실행하고, 마지막에 `response end`로 종료한다.

### 5.6 무한루프/재진입 방지(강제)

- `runErrorFilters()`는 재진입을 금지한다(플래그로 1회만 진입).
- ErrorFilter 실행기 내부에서 예외가 나거나, 필터 내부 예외가 연쇄로 터지는 경우:
  - ErrorFilter를 다시 호출하지 않는다(무한루프 차단).
  - 즉시 “Adapter Default Error Handler(=Emergency Handler)”로 위임한다.

추가 규칙(관측 가능성):

- Emergency Fallback은 “사용자 로직이 개입할 수 없는 시스템 경로”임을 명시한다.
- 이 경로에서는 최소한 아래 정보가 로그/메트릭에 남아야 한다.
  - stage(어떤 단계에서 터졌는지)
  - filterToken(필터 실행 중이었다면)
  - originalError/thrownError(해당 시)

### 5.7 beforeResponse/afterResponse 에러 정책(재확정)

확정(요약):

- beforeResponse/afterResponse 단계에서 발생한 에러는 “시스템 에러”로 분류한다.
- 이 에러는 ErrorFilter로 절대 넘기지 않으며, 어댑터(Default Error Handler)가 처리한다.

개발자 인지(문서 강제):

- 이 구간의 에러는 사용자 ErrorFilter가 처리할 수 없다.
- 대신 프레임워크(어댑터)는 이를 “시스템 장애 경로”로 분류하고 Default Error Handler에서 반드시 처리한다.
- 즉, 이 정책은 “무한루프 방지/일관성”을 위한 의도된 트레이드오프이며, 사용자는 이 구간에서 에러를 ‘커스텀 응답’으로 바꾸는 것을 기대하면 안 된다.

### 5.8 Adapter Default Error Handler (강제 계약)

모든 어댑터는 “필터 밖 에러”를 종결시키는 Default Error Handler를 반드시 제공해야 한다.

확정(요약):

- ErrorFilter 체인이 끝날 때까지 처리되지 않은 에러의 최종 종착점은 어댑터(Default Error Handler)다.
- 시스템 에러 구간(beforeResponse/afterResponse)의 에러도 어댑터(Default Error Handler)에서 처리한다.

역할:

- (필수) 아래 케이스에서 **기본 실패 응답/실패 상태를 결정적으로 보장**한다.
  1. ErrorFilter가 없거나, 있더라도 응답 상태를 명시적으로 결정하지 않음(HTTP: status 미설정)
  2. ErrorFilter 체인 실행 중/이후에 추가 에러가 발생하여 “시스템 장애 경로”로 분류됨
  3. beforeResponse/afterResponse 등 필터 금지 구간에서 발생한 에러

요구사항:

- transport별로 “실패 보장”의 의미가 다르므로, 구체 동작은 어댑터가 정의한다.
  - HTTP: 에러 경로 + status 미설정이면 `status=500`을 강제 설정(정책에 따라 body는 최소/보수)
  - 그 외 어댑터: 해당 transport의 실패 응답/ack/nack/종료 규약에 따라 처리
- 이 경로는 사용자 ErrorFilter를 다시 호출하지 않는다(무한루프 방지).
- 반드시 로깅/메트릭이 남아야 한다(stage 포함).

---

## 6. HTTP Adapter 공개 API: addErrorFilters

변경 대상: `packages/http-adapter/src/bunner-http-adapter.ts`, `packages/http-adapter/src/bunner-http-server.ts`

요구 API:

```ts
addErrorFilters(filters: readonly ErrorFilterToken[]): this;
```

등록 처리(결정성):

- `addErrorFilters([...])`는 토큰 목록만 저장한다.
- 서버 부팅 시점에 컨테이너로 resolve하여 전역 ErrorFilter 인스턴스를 확정한다.
- `RequestHandler`는 토큰(`HTTP_ERROR_FILTER`)을 통해 전역 필터를 로드한다.

---

## 7. AOT/CLI 검증

변경 대상(예): `packages/cli/src/analyzer/graph/module-graph.ts`, `packages/cli/src/analyzer/ast-parser.ts`

검증 목표:

- `@UseErrorFilters(Foo)`로 참조된 `Foo`는 반드시 `@Catch(...)`를 가진 클래스여야 한다.
- `configure()`에서 `addErrorFilters([...])`로 참조된 토큰도 동일하게 검증한다.

주의:

- 런타임 스캔/reflect-metadata 금지. CLI는 AST 기반으로 “사용된 토큰”을 결정적으로 수집해야 한다.

---

## 8. 코드 변경 목록(파일 단위)

### 8.1 common

- `packages/common/src/interfaces.ts`
  - `BunnerErrorFilter<TError = unknown>` 추가
  - `ErrorFilterToken` 추가
  - `ErrorHandler` 및 HTTP 전용 시그니처 제거
- `packages/common/src/decorators/exception.decorator.ts`
  - `UseErrorHandlers` 제거
  - `UseErrorFilters` 추가
  - `Catch` 유지
- `packages/common/index.ts`
  - 공개 export 목록에서 `ErrorHandler` 제거 및 ErrorFilter 관련 export 추가

### 8.2 http-adapter

- `packages/http-adapter/src/constants.ts`
  - `HTTP_ERROR_HANDLER` -> `HTTP_ERROR_FILTER`
- `packages/http-adapter/src/interfaces.ts`
  - `RouteHandlerEntry.errorHandlers` 제거
  - `RouteHandlerEntry.errorFilters` 추가
- `packages/http-adapter/src/route-handler.ts`
  - `UseErrorHandlers` 참조 제거 -> `UseErrorFilters`
  - resolve 함수/필드명을 ErrorFilters로 통일
  - resolve 실패를 조용히 삼키지 않고 명확한 에러로 실패
- `packages/http-adapter/src/request-handler.ts`
  - `runErrorHandlers` 제거 -> `runErrorFilters` 구현
  - arity 추론/req-res-next 호출 제거
  - 재진입 방지 + Emergency Fallback 구현

### 8.3 examples

- `examples/src/filters/http-error.handler.ts` 등
  - ErrorHandler -> ErrorFilter로 rename
  - `@UseErrorHandlers` -> `@UseErrorFilters`

---

## 9. 마이그레이션 가이드(레거시 미유지)

### 9.1 사용자 코드

- `@UseErrorHandlers(...)` -> `@UseErrorFilters(...)`
- `ErrorHandler` 타입/함수형 핸들러 제거 -> 클래스 기반 `BunnerErrorFilter` 구현
- `catch(error, ctx)` 내부에서 HTTP 응답이 필요하면 `ctx.to(BunnerHttpContext)`를 통해 직접 설정

### 9.2 프레임워크 내부

- `HTTP_ERROR_HANDLER` 및 관련 로직/타입 제거
- `RouteHandlerEntry.errorHandlers` 제거

---

## 10. 클린업 체크리스트

- `ErrorHandler`, `UseErrorHandlers`, `HTTP_ERROR_HANDLER`, `runErrorHandlers`가 저장소에 남지 않도록 전수 제거
- `@bunner/common`에 HTTP 전용 시그니처가 남지 않도록 확인
- `any` 노출 API가 생기지 않도록 public export 점검

---

## 11. 검증(Verification)

- 타입/빌드: `bun run tsc`
- 린트: `bun run lint`
- 예제 앱 실행 후:
  - handler에서 throw 시 ErrorFilter가 호출되는지
  - beforeResponse/afterResponse 에러가 ErrorFilter로 재진입하지 않는지
  - 필터 no-op이면 다음 필터로 넘어가고, 최종적으로 hang가 발생하지 않는지
  - 필터 내부 throw가 다음 필터로 전파되는지
