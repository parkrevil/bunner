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
export type ErrorFilterToken = Class<BunnerErrorFilter>;
```

주의:

- HTTP 전용 시그니처(`err, req, res, next`)는 `@bunner/common`에 존재하면 안 된다.
- 공개 DX(`@UseErrorFilters`, `addErrorFilters`)는 결정성과 AOT 검증을 위해 **클래스 토큰만** 허용한다.
  - symbol 기반 토큰이 필요하다면 어댑터/내부 구현에서 별도의 내부 토큰으로 사용하되,
    본 문서의 범위(사용자 API / AOT 검증)에서는 다루지 않는다.

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
  - 여기서 “정상 흐름으로 되돌아가지 않는다”는 의미는 다음을 뜻한다.
    - routing / scoped middlewares / handler를 **재실행하지 않는다**
    - 단, 응답을 마무리하기 위한 고정된 후속 단계(`beforeResponse -> afterResponse -> response end`)는 실행한다

### 5.2 실행 대상(순서)

1. 스코프(라우트) ErrorFilters
2. 전역(어댑터 등록) ErrorFilters

스코프 결합 규칙(결정성 / 구현 계획):

- `@UseErrorFilters`가 method와 controller 둘 다에 존재하는 경우:
  - **Method -> Controller** 순서로 결합한다.
- 중복 토큰이 존재하면 1회만 실행한다.
  - 중복 제거 기준: 앞에서 먼저 등장한 토큰을 유지(=Method 우선), 뒤의 중복은 제거한다.

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

current/original error 정의(결정성 / 구현 계획):

- `originalError`: 에러 경로 진입을 유발한 최초의 에러 값
- `currentError`: 필터 체인 실행 중 “현재 처리 대상”으로 간주되는 에러 값
  - Filter 내부에서 throw/reject가 발생하면, 그 값이 다음 단계의 `currentError`가 된다.
- ErrorFilter 매칭/실행과 어댑터 최종 처리(Default/SystemErrorHandler)는 **항상 `currentError`를 기준으로 동작**한다.
  - 이유: 필터가 의도적으로 에러 타입/값을 교체해 다음 필터 매칭을 유도할 수 있기 때문
- 단, 관측(로깅/메트릭)에서는 `originalError`와 체인 정보를 함께 남기는 것을 권장한다.

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
- 이 에러는 ErrorFilter로 절대 넘기지 않으며, 어댑터(최종 에러 처리: 5.8/5.9)가 처리한다.

afterResponse의 의미(구현 계획, 문서 강제):

- afterResponse는 “네트워크 전송 완료”가 아니라, **beforeResponse가 끝난 시점**에 실행되는 라이프사이클을 의미한다.
  - 즉, “응답을 구성하기 위한 모든 결정(status/headers/body)이 끝난 이후”를 afterResponse의 기준 시점으로 둔다.
- 따라서 “정상/에러 경로와 무관하게, beforeResponse가 종료되면 afterResponse는 실행된다”를 기본 원칙으로 둔다.
- HTTP(Bun fetch)에서 afterResponse 실행 위치(결정성 / 구현 계획):
  - afterResponse는 `Response`를 런타임에 반환하기 **직전**에 실행한다.
  - `Response`를 반환한 이후에 동일 요청 컨텍스트로 afterResponse를 호출하는 것은 결정적으로 보장할 수 없으므로,
    해당 모델은 표준 경로로 채택하지 않는다.
- afterResponse에서 발생한 에러는 아래 원칙을 따른다.
  - ErrorFilter로 재진입 금지
  - SystemErrorHandler / Default Error Handler로 재진입 금지(이미 응답이 확정된 이후이므로)
  - best-effort로 로깅만 남긴다

개발자 인지(문서 강제):

- 이 구간의 에러는 사용자 ErrorFilter가 처리할 수 없다.
- 대신 프레임워크(어댑터)는 이를 “시스템 장애 경로”로 분류하고 Default Error Handler에서 반드시 처리한다.
- 즉, 이 정책은 “무한루프 방지/일관성”을 위한 의도된 트레이드오프이며, 사용자는 이 구간에서 에러를 ‘커스텀 응답’으로 바꾸는 것을 기대하면 안 된다.

### 5.8 Adapter Default Error Handler (강제 계약)

모든 어댑터는 “필터 밖 에러”를 종결시키는 Default Error Handler를 반드시 제공해야 한다.

확정(요약):

- ErrorFilter 체인이 끝날 때까지 처리되지 않은 에러의 최종 종착점은 어댑터(Default Error Handler)다.
- 시스템 에러 구간(beforeResponse/afterResponse)의 에러도 어댑터(Default Error Handler)에서 처리한다.

추가(확정):

- 사용자는 “어댑터 최종 에러 처리”를 대체할 수 있는 단 하나의 옵션(5.9)을 제공받는다.
- 단, 어떤 경우에도 에러 처리는 **어댑터에서 종결**되며, 사용자 핸들러에서 발생한 에러는 다른 레이어로 전파되지 않는다.

역할:

- (필수) 아래 케이스에서 **기본 실패 응답/실패 상태를 결정적으로 보장**한다.
  1. ErrorFilter가 없거나, 있더라도 응답 상태를 명시적으로 결정하지 않음(HTTP: status 미설정)
  2. ErrorFilter 체인 실행 중/이후에 추가 에러가 발생하여 “시스템 장애 경로”로 분류됨
  3. beforeResponse/afterResponse 등 필터 금지 구간에서 발생한 에러

요구사항:

- transport별로 “실패 보장”의 의미가 다르므로, 구체 동작은 어댑터가 정의한다.
  - HTTP: 에러 경로 + status 미설정이면 `status=500`을 강제 설정(정책에 따라 body는 최소/보수)
  - 그 외 어댑터: 해당 transport의 실패 응답/ack/nack/종료 규약에 따라 처리

HTTP에서 “status 미설정”의 정의(결정성 / 구현 계획):

- HTTP Response의 status 기본값은 `0`(unset)이다.
- 따라서 “status 미설정”은 `status === 0`인 경우만을 의미한다.
- Error 경로에서 `status === 0`이면 어댑터는 반드시 `status=500`으로 설정한다.
- 이 경로는 사용자 ErrorFilter를 다시 호출하지 않는다(무한루프 방지).
- 반드시 로깅/메트릭이 남아야 한다(stage 포함).

### 5.9 Adapter Final Error Handler Override (SystemErrorHandler)

문제:

- Default Error Handler(어댑터 기본 폴백)의 응답/로깅 정책을 사용자가 싫어할 수 있다.
- 이를 ErrorFilter로 다시 열어버리면 “시스템 경계”가 흐려지고, 재진입/루프/일관성이 깨질 수 있다.

해결(확정):

- 어댑터는 최종 에러 처리를 대체할 수 있는 **단 하나의 사용자 핸들러**를 옵션으로 제공한다.
- 이 핸들러는 관측/응답 커스텀을 모두 할 수 있다.
- 단, 이 핸들러는 **체인/매칭/전파 모델이 아니다** (ErrorFilter와 명확히 분리).

계약(핵심):

- 이름: SystemErrorHandler(어댑터 패키지에서 제공)
- 시그니처(HTTP 기준):

```ts
handle(error: unknown, ctx: Context): void | Promise<void>
```

규칙:

1. 등록은 토큰(클래스) 기반이며, DI로 생성된다(`new` 금지).

1.1) 등록 방식 SSOT(결정성 / 구현 계획):

- HTTP Adapter는 SystemErrorHandler를 아래 토큰에서 resolve한다.
  - `HTTP_SYSTEM_ERROR_HANDLER`
- resolve 규칙은 다른 HTTP 토큰 로딩과 동일하게 적용한다.
  - (1) 전역 토큰 키 직접 매칭
  - (2) namespaced 토큰(`Module::Token`) 매칭
- 해당 토큰이 등록되지 않은 경우, built-in Default Error Handler만 사용한다.

2. 호출 지점은 아래로 고정한다(결정성):

- (A) ErrorFilter 체인 이후에도 응답 상태가 결정되지 않은 경우(예: HTTP에서 status 미설정)
- (B) beforeResponse/afterResponse 등 “필터 금지 구간”에서 발생한 에러
- (C) ErrorFilter 실행기 자체 예외/재진입 차단 등 Emergency 경로

3. **전파 금지(가장 중요)**:

- SystemErrorHandler 내부에서 어떤 예외(throw/reject)가 발생해도, 해당 예외는 어떤 레이어로도 전파되지 않는다.
- ErrorFilter를 다시 호출하지 않는다(재진입/무한루프 방지).

4. 실패 시 정책(하드 폴백):

- SystemErrorHandler가 실패하면(throw/reject), 어댑터는 반드시 자신의 built-in Default Error Handler로 즉시 폴백하여 종결한다.
- 이때 최소한의 로깅/메트릭(stage + handlerToken + originalError + handlerError)을 남긴다.

5. 호출 횟수 제한:

- 요청당 SystemErrorHandler는 최대 1회만 호출한다(플래그로 재진입 차단).

6. 범위(요청 컨텍스트 한정):

- SystemErrorHandler는 **요청 파이프라인 내부**에서만 호출된다.
  - 즉, (A)/(B)/(C)와 같은 “어댑터가 현재 처리 중인 요청 컨텍스트(ctx)를 보유한 경우”에만 호출된다.
- `unhandledRejection` / `uncaughtException` 같은 **프로세스 레벨 이벤트 처리**는 SystemErrorHandler의 범위가 아니다.
  - 이유: 해당 이벤트는 특정 요청 컨텍스트로 **결정적으로 매핑할 수 없으며**, 매핑이 가능해 보이더라도 응답을 ‘보장’할 수 없다.
  - 따라서 전역 이벤트에서 SystemErrorHandler를 호출하는 모델은 금지한다(결정성/안정성/책임 경계 붕괴 방지).

7. “응답 보장” 금지(문서 강제):

- SystemErrorHandler는 커스텀 응답/로깅을 수행할 수 있지만, **어떤 상황에서도 “항상 응답한다”를 보장하지 않는다.**
- 특히 (C) Emergency 경로에서는 런타임 상태가 손상되었을 수 있으므로, 실패 시 즉시 하드 폴백으로 종료한다.

설명:

- 이 방식은 “NestJS처럼 최후 응답을 통째로 커스터마이즈”할 수 있는 지점을 제공하면서도,
  에러 처리의 종결 책임(어댑터)과 시스템 경계(before/afterResponse 금지)는 유지한다.

### 5.10 Process-level Fatal Errors (unhandledRejection / uncaughtException)

목표:

- “전역 예외를 복구(recovery)하려고 하지 않는다.”
- 대신 **관측(로그/메트릭) + 안전한 종료(terminate)**로 장애 확산을 막는다.

정의:

- Process-level Fatal Error란 아래 이벤트로 관측되는 오류를 의미한다.
  - `unhandledRejection`
  - `uncaughtException`

핵심 원칙(강제):

1. 전역 예외는 recoverable 하지 않다.

- 이 이벤트가 발생한 시점에서 애플리케이션 상태는 신뢰할 수 없다.
- “계속 서비스”는 프레임워크가 제공하는 선택지가 아니다.

2. 요청 응답 보장 금지(best-effort만 허용).

- 전역 이벤트는 특정 요청으로 **결정적으로** 매핑할 수 없다.
- AsyncLocalStorage(예: reqId)는 상관관계(관측)를 개선할 수는 있으나,
  해당 이벤트에서 “해당 요청의 응답을 종결”하는 것을 보장할 수 없다.

3. ErrorFilter / SystemErrorHandler 재진입 금지.

- process-level fatal error를 ErrorFilter 또는 SystemErrorHandler로 넘기는 모델은 금지한다.
  - 무한루프/재진입 위험
  - 시스템 경계 붕괴
  - 책임 불명확

4. 종료 정책(구현 계획):

- 프레임워크(혹은 어댑터/호스트)는 process-level fatal error 발생 시 아래 순서를 따른다.
  - (a) **fatal 로그**를 남긴다(가능하면 reqId/workerId 포함)
  - (b) (가능하면) 새 요청 수락을 중단한다(예: 서버 stop/worker shutdown)
  - (c) 짧은 유예(grace period) 후 프로세스를 종료한다

주의(구현 책임):

- “프로세스를 종료한다”의 구현 주체는 런타임/배포 모델에 따라 달라질 수 있다.
  - 단일 프로세스: `process.exit(1)`
  - cluster/worker: 해당 worker 종료 후 supervisor가 재시작
- Bunner는 “종료가 필요한 상황”과 “종료 전 관측/정리 범위”를 문서로 강제하고,
  구체 구현은 어댑터/호스트에서 제공할 수 있다.

### 5.11 Bun.serve-level Error Hook (HTTP Server)

의도:

- 요청 처리 흐름이 예상치 못한 방식으로 깨질 때(=요청 컨텍스트 내부 try/catch로 회수되지 않았을 때)
  클라이언트 타임아웃을 줄이기 위한 **마지막 보루**로 사용한다.

규칙(구현 계획):

- HTTP Server는 Bun의 서버 설정에서 제공되는 error 훅(가능한 경우)을 통해,
  최소한의 500 응답을 반환할 수 있다.
- 이 훅은 ErrorFilter/SystemErrorHandler와 별개의 경로이며,
  여기서도 “응답 보장”은 금지한다(best-effort).

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
