# PLAN (AOT-Driven Modular Standalone)

이 문서는 Bunner의 차세대 아키텍처/디자인 패턴을 고정하고, 그 결정을 근거로 SSOT 문서들을 재작성(최소 diff)하기 위한 단일 기준(Plan)이다.

핵심 의도:

- 개발자는 Standalone처럼 작성한다(등록 지옥 제거).
- 시스템은 모듈 경계를 가진다(캡슐화/규율).
- 경계/스코프/순환/금지 import는 AOT(CLI)가 빌드 타임에 강제한다.
- 실패(에러/진단)는 매우 친절하고 안내 중심이어야 한다.

본 문서는 구현 세부(코드) 대신, 결정 사항 + 집행 규칙 + 산출물 + 작업 순서를 정의한다.

---

## 0. 목표와 범위

### 0.1 목표

- 모듈을 디렉토리 단위로 인식하고, `__module__.ts`가 해당 모듈의 정체성(Identity)을 가진다.
- `@Controller`, `@Service` 같은 Standalone 컴포넌트를 `__module__.ts`에 등록하지 않아도 AOT가 수집하여 모듈 스코프로 귀속시킨다.
- 모듈 간 결합은 인스턴스(클래스) 단위 공개(`visibility`)로 제어하고, AOT가 경계 통과 주입을 빌드 타임에 판정한다.
- 런타임은 소스를 스캔하지 않고, CLI(AOT) 산출물(Registry/Plan/Manifest)을 consumption만 한다.
- 앱 라이프사이클 훅은 AOT 산출물 기반으로 적용한다.
- HTTP 미들웨어/에러 필터는 현재 구현 방식을 그대로 활용하되, 문자열 기반 DSL로 바꾸지 않는다.
- HTTP 어댑터는 멀티 인스턴스 구성이 가능하므로, 단일 `http:` 접두 기반 구성 모델을 금지한다.

추가 핵심 결정(용어/모델):

- Bunner에는 런타임 확장 모델(훅 컨테이너/레지스트리/실행 모델)을 별도로 두지 않는다.
  - 외부 기능은 모두 **provider bundle(`provideXxx() => Provider[]`)** 로만 제공/소비한다.

### 0.2 비목표

- 런타임 reflection/scan(`reflect-metadata`) 도입은 하지 않는다.
- TS 제약을 무시한 DX(예: import 없이 constructor 타입만으로 DI)는 목표로 하지 않는다.
  - 목표는 등록 배열(`imports/providers/controllers/exports`)을 직접 유지하지 않아도 되는 DX다.
- Router module 같은 별도 라우터 모듈을 제공하지 않는다.
- 패키지 경계(`packages/*`) 자체를 재편하는 아키텍처 변경은 이 문서의 범위가 아니다.

---

## 1. 핵심 모델(정의)

### 1.1 Module

- Module은 디렉토리 단위다.
- 모듈 디렉토리는 `__module__.ts`를 MUST 포함한다.
- 모듈 이름은 기본값으로 디렉토리명이지만, 필요 시 `__module__.ts`에서 override 할 수 있다.

### 1.2 Standalone Component

- Standalone Component는 데코레이터로 식별되는 클래스 단위다.
- `@Controller`, `@Service`는 AOT가 수집하는 선언 채널이다.
- 런타임에서 해당 데코레이터를 스캔하거나 메타를 생성/수정하려는 흐름은 금지다.

---

## 2. `__module__.ts`의 역할(정체성)

`__module__.ts`는 등록 배열이 아니라 정체성(Identity) + 정책(Policy) + 커스텀 바인딩만 담당한다.

### 2.1 최소 선언

- 자동 수집이 해결하지 못하는 케이스만 명시한다.
  - 커스텀 바인딩(아래 `providers` 형식)
  - 환경별 바인딩(예: prod/test)

커스텀 바인딩은 반드시 `providers` 배열로만 표현한다.

- `providers`는 아래 4종만 허용한다(MUST).
  - `{ provide, useClass }`
  - `{ provide, useValue }`
  - `{ provide, useFactory, inject }`
  - `{ provide, useExisting }`
- `provide`는 클래스 식별자뿐 아니라 `string | symbol` 토큰도 허용한다(MUST).
- `useExisting`(alias)는 반드시 지원해야 한다(MUST).

키 이름 선택(시장 관례):

- Provider object의 키는 `token`이 아니라 `provide`를 정본으로 사용한다.
  - 이유: 프레임워크 생태계(특히 Angular/NestJS)에서 provider object 키는 `provide`가 사실상 표준이다.
  - 여기서 “token”은 **값의 개념(ProviderToken)** 을 의미하며, 객체 키 이름이 아니다.

### 2.2 금지

- `__module__.ts`에서 컴포넌트 목록을 수동 등록하는 방식(`controllers/providers` 나열)은 금지한다.
- 모듈 간 결합을 수동으로 `@Module({ imports })` 같은 등록 배열로 유지하는 방식은 금지한다.

---

## 3. 공개 모델(인스턴스 단위 공개)

### 3.1 `@Service` 옵션

서비스는 라이프사이클과 가시성(모듈 경계)을 분리해서 선언한다.

- `lifetime`: `singleton` | `request-context` | `transient`
- `visibility`: `internal` | `exported`

### 3.2 `@Controller` 옵션

- Controller는 기본적으로 `visibility: internal`로 취급한다.
- 외부에서 Controller를 직접 DI 대상으로 쓰는 모델을 기본값으로 삼지 않는다.

---

## 4. AOT 집행 규칙(빌드 실패 조건)

이 섹션은 룰을 시스템이 집행 가능하게 만드는 최소 규칙이다.

### 4.1 모듈 귀속(Ownership)

- AOT는 컴포넌트가 속한 모듈을 결정해야 한다.
  - 기본값: 파일 경로 기준(가장 가까운 상위 `__module__.ts` 디렉토리)
  - 충돌/모호성은 빌드 실패로 취급한다.

### 4.2 경계 통과 주입(Cross-Module Injection)

- 어떤 모듈 A의 컴포넌트가 모듈 B의 컴포넌트를 주입하려는 경우:
  - 대상이 `visibility: exported`가 아니면 빌드 실패다.

### 4.3 스코프 검증(Scope Validation)

- `singleton`이 `request-context`를 직접 주입하려는 경우는 빌드 실패다.
- 예외/우회 패턴(예: factory/provider accessor)을 허용하려면, 그 패턴은 프레임워크 공식 API로 고정되어야 한다.

### 4.4 모호성(Ambiguity)

- 같은 타입/토큰에 대한 후보가 2개 이상이면 빌드 실패다.
- 해결은 `__module__.ts`의 커스텀 바인딩(`providers`)으로만 한다.

### 4.5 순환(Cycle)

- 모듈 간 순환 의존은 빌드 실패다.
- 컴포넌트 그래프 순환도 빌드 실패다.

### 4.6 진단(Diagnostics) UX (친절/안내 중심)

- CLI는 실패를 친절한 진단으로 보고해야 한다.
- 진단 메시지는 아래 정보를 MUST 포함한다.
  - 무엇이 실패했는지(요약)
  - 어디서 실패했는지(파일 경로/심볼/관련 토큰)
  - 왜 실패했는지(규칙 이름 + 위반 조건)
  - 어떻게 고칠지(구체적인 해결 방법 1~3개)
- 모호성(후보 2+) 진단은 후보 목록(모듈/토큰)을 MUST 포함하고, 선택을 강제하는 최소 변경(`__module__.ts`의 `providers`)을 안내해야 한다.
- 순환 진단은 순환 경로(모듈/파일/토큰 체인)를 MUST 포함하고, 끊을 지점 후보를 안내해야 한다.

---

## 5. 엔트리(Composition Root)와 앱 라이프사이클

### 5.1 Entry Module (코드로 명확히 정의)

- 프로젝트는 엔트리 모듈(Composition Root)을 반드시 1개로 고정한다.
- 엔트리 모듈은 CLI가 분석 시작점으로 사용하는 단일 소스(파일 경로)다.
- 엔트리 모듈 지정은 단일 설정 파일로 고정한다.
  - A안: `bunner.config.ts` 단일 파일

추가로, 엔트리 설정은 앱 전역 `providers`를 선택적으로 포함할 수 있다.

- 전역 `providers`는 “여러 모듈에서 공통으로 쓰는 진짜 싱글턴”에만 사용한다(MUST).
- 모듈/컨트롤러/어댑터 정책(예: middleware/errorFilters)을 엔트리 설정으로 끌어올리는 방식은 금지한다(MUST NOT).

- 외부 통합(TypeORM/Redis 등)은 `providers`로만 표현한다(MUST).
  - provider bundle 패키지는 `provideTypeOrm(...) => Provider[]` 같은 provider bundle 함수를 제공하고,
    소비자는 그 반환값을 `providers`에 펼쳐 넣는다.

### 5.2 Application Lifecycle (적용 방식)

- 라이프사이클 훅은 모듈 등록 배열이 아니라, AOT가 수집한 메타데이터와 런타임 조립 결과를 기반으로 실행된다.
- 훅 순서는 아래를 기준으로 고정한다.
  - `onInit` → `beforeStart` → `onStart` → `onShutdown` → `onDestroy`

---

## 6. Tooling 설정과 Adapter/Middleware/ErrorFilter 모델

### 6.1 TypeScript 설정(tsconfig) 3종

Dev/Build/Test는 역할이 다르므로 기본적으로 분리한다.

- Dev: 개발 환경에서 사용할 기본 tsconfig
- Build: 배포/산출물 중심 tsconfig
- Test: 테스트 전용 tsconfig

### 6.2 Adapter는 다중 인스턴스를 지원한다

- 어댑터는 2개 이상 멀티 인스턴스 구성이 가능하다.
  - 예: HTTP 어댑터는 `main`, `admin` 같은 다중 인스턴스를 가질 수 있다.
- 따라서 `http:` 같은 프로토콜 접두 문자열로 단일 어댑터를 가정하는 방식은 금지한다.
- 어댑터는 반드시 인스턴스 이름을 갖는다(예: `main`, `admin`).
- 어댑터 인스턴스 정책에는 `'*'`(wildcard) 키를 허용한다(MUST).
  - 의미: 해당 어댑터의 모든 인스턴스에 공통으로 적용되는 정책
  - 병합 규칙: `'*'` 정책 적용 후, 인스턴스별 정책을 적용한다(MUST).
    - 예: 동일 라이프사이클의 `middlewares`가 둘 다 존재하면 `'*'` 배열 다음에 인스턴스 배열을 이어붙인다.
    - 예: `errorFilters`가 둘 다 존재하면 `'*'` 배열 다음에 인스턴스 배열을 이어붙인다.
- AOT 산출물(Plan/Registry)은 어댑터 인스턴스 이름을 기준으로 대상 어댑터에 바인딩된다.

### 6.3 Middleware (문자열 형식 금지, 라이프사이클/옵션 지원)

- 미들웨어 사용/설정은 문자열 기반 DSL(예: `"http:beforeResponse:Foo"`)을 금지한다.
- 미들웨어는 라이프사이클별로 설정 가능해야 하고, 미들웨어마다 옵션을 줄 수 있어야 한다.
- 현재 구현 방식을 그대로 활용하는 것을 기본값으로 둔다.
  - `BunnerMiddleware.withOptions(options)` 또는 `MiddlewareRegistration`(token/options)
  - HTTP는 `HttpMiddlewareLifecycle` 기반 레지스트리(`HttpMiddlewareRegistry`) 모델을 사용한다.

### 6.4 Error Filter (에러핸들러 X, 문자열 형식 금지)

- Error Filter는 에러핸들러 개념으로 바꾸지 않는다.
- Error Filter 사용/설정은 문자열 기반 DSL을 금지한다.
- 현재 구현된 토큰 기반 모델을 유지한다.
  - `UseErrorFilters(SomeFilter)` 같은 토큰 기반 선언
  - 어댑터 전역(글로벌) 적용이 필요하면 어댑터 옵션의 `errorFilters` 같은 토큰 배열로 표현한다.

---

## 7. 완료 기준(Acceptance Criteria)

- 모듈 경계 통과 주입이 `visibility`로 판정되며, 위반은 빌드 실패다.
- `singleton -> request-context` 스코프 위반은 빌드 실패다.
- 모호성(후보 2+)은 빌드 실패이며, `__module__.ts` 커스텀 바인딩으로만 해소된다.
- 순환 의존은 빌드 실패다.
- 동일 입력에서 동일 산출물(결정성)이 재현된다.
- 빌드 실패는 항상 친절한 진단(무엇/어디/왜/어떻게)을 제공한다.

---

## 8. 예제(모듈/컨트롤러/서비스)

여기서는 examples 앱 전체를 재현하는 게 아니라, 우리가 합의한 Plan 기준 DX(모듈/컨트롤러/서비스 3가지)만 최소로 보여준다.

핵심:

- 모듈은 디렉토리 단위이고, `__module__.ts`가 정체성/정책을 가진다.
- 미들웨어/에러필터는 “메인 설정 파일에 박아두는 것”이 아니라, 모듈/컨트롤러 스코프에서 설정할 수 있어야 한다.

추가로, NestJS의 모듈 기능들(`useValue/useClass/useFactory`, `provideXxx(...)`류)은 “런타임에서 모듈이 동적으로 그래프를 반환”하는 방식이 아니라,
`__module__.ts`에 정적 바인딩 데이터로 표현되어 AOT가 결정적으로 분석/집행할 수 있어야 한다.

### 8.1 모듈 DX (`__module__.ts`에 정체성 + 정책)

아래는 Plan에서 의도하는 모듈 정체성/정책 형태의 예시다.
현행 런타임의 `@Module()/Configurer` 패턴을 예제의 기본값으로 삼지 않는다.

```ts
import { HttpMiddlewareLifecycle } from '@bunner/http-adapter';

import { AuthMiddleware } from '../http/middleware/auth.middleware';
import { PaymentErrorFilter } from './payment-error.filter';
import { UsersRepository } from './users.repository';

export const module = {
  name: 'billing',
  providers: [
    { provide: 'db.url', useValue: 'postgres://user:pass@localhost:5432/app' },
    { provide: 'DATABASE_URL', useExisting: 'db.url' },
    {
      provide: 'db.connection',
      useFactory: (url: string) => ({ kind: 'db-connection', url }) as const,
      inject: ['db.url'],
    },
    { provide: 'users.repository', useClass: UsersRepository },
  ],
  adapters: {
    http: {
      '*': {
        errorFilters: [PaymentErrorFilter],
      },
      main: {
        middlewares: {
          [HttpMiddlewareLifecycle.BeforeRequest]: [AuthMiddleware.withOptions({ mode: 'required' })],
        },
      },
      admin: {
        middlewares: {
          [HttpMiddlewareLifecycle.BeforeRequest]: [AuthMiddleware.withOptions({ mode: 'optional' })],
        },
      },
    },
  },
} as const;
```

`as const`를 쓰는 이유(Plan 기준):

- 이 객체를 “실행 로직”이 아니라 AOT가 소비하는 “정적 정책 데이터”로 취급하기 위해서다.
- 리터럴 타입(예: `'billing'`, `'optional'`)을 유지하면 AOT/타입체크가 정책을 더 결정적으로 다룰 수 있다.
- `providers` 같은 커스텀 바인딩 선언도 문자열/동적 스캔이 아니라, AOT가 읽을 수 있는 정적 데이터 형태를 목표로 한다.

위 `providers` 예시는 NestJS의 아래 개념을 Plan 방식으로 표현한 것이다.

- `useValue` → `{ provide, useValue }`
- `useClass` → `{ provide, useClass }`
- `useFactory` / `forRootAsync` → `{ provide, useFactory, inject }`
- `useExisting` → `{ provide, useExisting }`

Plan의 provider object는 `{ provide, useValue/useClass/useFactory/inject/useExisting }` 형태로 고정한다.

### 8.2 컨트롤러 DX (컨트롤러/라우트 단위 설정)

컨트롤러(또는 메서드) 단위로도 `UseMiddlewares` / `UseErrorFilters`를 선언할 수 있다.

```ts
import { UseErrorFilters, UseMiddlewares } from '@bunner/common';
import { RestController } from '@bunner/http-adapter';
import { ApiOperation, ApiTags } from '@bunner/scalar';

import { AuthMiddleware } from '../http/middleware/auth.middleware';
import { PaymentErrorFilter } from './payment-error.filter';

@ApiTags('Billing')
@RestController('/billing')
@UseMiddlewares(AuthMiddleware.withOptions({ mode: 'required' }))
@UseErrorFilters(PaymentErrorFilter)
export class BillingController {
  @ApiOperation({ summary: 'Charge a user' })
  public async charge(): Promise<void> {
    return;
  }
}
```

권장 DX 요약:

- `@RestController(path)`는 라우팅/컨트롤러 식별만 담당한다.
- middlewares/errorFilters는 전용 데코레이터(`UseMiddlewares/UseErrorFilters`)로 확장한다.
- docs는 HTTP 컨트롤러 옵션이 아니라, 확장 패키지(`@bunner/scalar`) 데코레이터로 확장한다.

### 8.3 서비스 DX (Plan의 `lifetime` + `visibility` 옵션)

아래는 Plan에서 합의한 `lifetime`/`visibility` 모델이 코드에서 어떤 형태로 보일지를 보여주는 예시다.
(`@bunner/common`에 이 옵션을 수용하는 데코레이터가 아직 없다면, 이는 Plan 구현 항목이다.)

```ts
import { Injectable } from '@bunner/common';

@Injectable({ lifetime: 'singleton', visibility: 'exported' })
export class UsersService {}

@Injectable({ lifetime: 'request-context', visibility: 'internal' })
export class BillingService {
  constructor(private readonly usersService: UsersService) {}
}
```

### 8.4 엔트리 DX (`bunner.config.ts`)

현행 구현(코드베이스 기준)은 `entry`가 파일 경로(string)다.

```ts
export default {
  entry: './src/main.ts',
};
```

Plan 권장(Standalone 스타일)은 엔트리에서 전역 `providers`에 외부 통합 provider bundle을 함께 포함하는 것이다.
(단, 전역화가 필요한 것에만 한정한다.)

```ts
import { provideTypeOrm } from '@bunner/typeorm';

export default {
  entry: './src/main.ts',
  providers: [
    ...provideTypeOrm({
      adapter: 'postgres',
      url: 'postgres://user:pass@localhost:5432/app',
    }),
  ],
} as const;
```

SSOT 고정: 엔트리는 현행처럼 파일 경로(string)로 유지한다(MUST).

- “엔트리 모듈을 직접 참조하는 형태”는 본 Plan의 범위 밖이며, 별도 Plan/승인 없이는 도입하지 않는다.

### 8.5 DB Connection 제공 형태(모듈 vs provider bundle 패키지)

Plan 관점 권장안(딱 두 줄):

- 이 앱에서만 쓰는 DB 연결/설정이면, 해당 모듈(`__module__.ts`)의 `providers`로 끝낸다.
- 프레임워크가 “공식 제공”으로 제공할 거면, 소비자는 provider bundle 패키지의 provider bundle을 `providers`에만 추가한다.

즉, TypeORM을 공식 통합으로 제공하더라도 사용하는 쪽에서는 `providers`만 만진다.

provider bundle 패키지 사용 형태(예시, 스케치):

```ts
import { provideTypeOrm } from '@bunner/typeorm';

export const module = {
  name: 'billing',
  providers: [
    ...provideTypeOrm({
      adapter: 'postgres',
      url: 'postgres://user:pass@localhost:5432/app',
    }),
  ],
} as const;
```

## 9. Provider Bundle 패키지 제작 DX (외부 생태계)

provider bundle 패키지는 “앱 기능 모듈(디렉토리)”과 다르게, 재사용 가능한 provider 묶음을 제공한다.

### 9.1 provider bundle 패키지 노출 형태

provider bundle 패키지는 사용자가 복잡한 등록을 직접 하지 않도록, `provideXxx(...)` 같은 함수가 `providers`에 넣을 수 있는 provider bundle(`Provider[]`)을 반환하는 형태를 기본값으로 둔다(MUST).

- 소비자는 그 결과를 `providers` 배열에 펼쳐 넣는다(MUST).
- AOT는 `providers`만 소비해 DI 그래프를 고정한다(MUST).

provider bundle 패키지의 목표는 “새 런타임 개념”이 아니라, Provider primitive 위에 얹는 DX 번들(매크로)이다.

- provider bundle 패키지를 DI 대상으로 주입하는 모델은 기본값이 아니다.
- 대신 provider bundle 패키지가 설치한 결과물(예: `DataSource`, `RedisClient`)을 일반 DI로 주입받는 모델을 기본값으로 둔다.
- 초기화/종료가 필요한 경우는, 라이프사이클 훅 인터페이스를 구현하는 구성요소를 함께 제공하고 그 구성요소도 `providers`로 등록한다.

#### 9.1.1 `...provideXxx(...)` 스프레드를 왜 쓰는가?

`provideXxx(...)`의 반환값은 `Provider[]`(배열)이다. 반면 `providers`는 `Provider`의 **평평한(flat) 배열**이어야 한다.

- 따라서 `providers: [...provideXxx(opts)]`는 `providers` 안에 “배열 한 덩어리”가 들어가는 것을 방지하고, provider 원소들을 **같은 레벨로 펼쳐 넣기 위해** 사용한다.
- 대체 표현(의미 동일):
  - `providers: provideXxx(opts)` (다른 provider를 섞지 않을 때만)
  - `providers: provideXxx(a).concat(provideXxx(b))`
  - `providers: [provideA(), provideB()].flat()`

본 Plan은 “provider bundle 패키지 소비가 한 줄로 끝나는 DX”를 목표로 하므로, 기본 예시는 스프레드 형태를 사용한다.

권장 반환 타입(개념):

```ts
export type BunnerProvider =
  | { readonly provide: string | symbol | (new (...args: readonly unknown[]) => unknown); readonly useClass: unknown }
  | { readonly provide: string | symbol | (new (...args: readonly unknown[]) => unknown); readonly useValue: unknown }
  | {
      readonly provide: string | symbol | (new (...args: readonly unknown[]) => unknown);
      readonly useFactory: (...args: readonly unknown[]) => unknown;
      readonly inject: readonly (string | symbol | (new (...args: readonly unknown[]) => unknown))[];
    }
  | {
      readonly provide: string | symbol | (new (...args: readonly unknown[]) => unknown);
      readonly useExisting: string | symbol | (new (...args: readonly unknown[]) => unknown);
    };

export type BunnerProviderBundle = readonly BunnerProvider[];
```

### 9.2 `provideXxx` 네이밍 정책

- provider bundle 패키지는 `provideXxx(...)` 형태를 기본 API로 제공하는 것을 권장한다(SHOULD).
- `provideXxxAsync` 같은 별도 네이밍을 “모델의 일부”로 강제하지 않는다(MUST NOT).
  - 비동기/지연 의존은 `providers`의 `{ provide, useFactory, inject }`로 표현하는 것을 기본값으로 둔다(MUST).

### 9.3 provider bundle 패키지를 “번들”로 제공해야 하는 기준(판정 가능)

다음 중 하나라도 해당되면, provider bundle 패키지는 단일 provider가 아니라 provider bundle 형태로 제공하는 것을 기본값으로 둔다(SHOULD).

- provider가 2개 이상 항상 함께 설치된다.
- 초기화/종료가 필요하다(연결 열기/닫기, 워밍업 등).
- 옵션 조합/검증이 필요하다(url vs host/port 등).
- 관측/헬스체크/리트라이 같은 부가 기능이 표준적으로 따라온다.
- 테스트에서의 오버라이드 패턴을 표준 제공해야 한다.

### 9.4 provider bundle 패키지 구조(권장)

provider bundle 패키지는 `packages/*`의 독립 패키지로 제공한다(MUST).

```text
packages/typeorm/
├── index.ts
├── package.json
├── tsconfig.json
├── README.md
└── src/
   ├── index.ts
   └── typeorm/
      ├── types.ts
  ├── provide-typeorm.ts
  └── index.ts
```

- 패키지 루트 `index.ts`는 public facade이며, `export *`로 외부 노출을 확장하지 않는다(MUST).
- 소비자는 `@bunner/typeorm` 같은 패키지 엔트리포인트로만 import 해야 한다(MUST).

### 9.5 provider bundle 패키지 구현 제약(결정성/부작용)

- provider bundle 패키지의 `provideXxx(...)`는 “provider bundle 생성”만 수행해야 한다(MUST).
- 런타임 스캔/동적 탐색을 도입하거나, AOT 산출물/레지스트리를 수정하려는 흐름은 금지다(MUST NOT).

## 10. 검증(Verification)

- 타입/빌드: `bun run tsc`
- 린트: `bun run lint`

---

## 11. 실행 계획(매우 구체적) — Provider-only + Scalar Provider 전환

이 섹션은 “코드 수정 지시”가 아니라, 앞으로 진행할 작업을 **Plan에 고정**하기 위한 실행 계획이다.
여기서 정한 항목/순서/삭제 목록이 SSOT이며, 실제 코드는 이 계획을 그대로 구현한다.

### 11.1 최종 DX 예제(완성본)

목표: 앱 코드는 `Scalar.setup(...)` 같은 런타임 설치 호출이 아니라, **provider bundle 추가**만 한다.

#### 11.1.1 예제 앱(개념) — `@Module`에 provider bundle 추가

주의: 아래 예시는 “현행 런타임(@Module 기반)에서 Scalar 설치 API를 provider bundle로 전환”하는 실행 계획이다.
본 Plan의 목표 모듈 모델(`__module__.ts`)을 예제의 기본값으로 삼지 않는다는 원칙(8.1)과 충돌하지 않는다.

```ts
import { Module } from '@bunner/common';
import { provideScalar } from '@bunner/scalar';

@Module({
  providers: [
    ...provideScalar({
      documentTargets: 'all',
      httpTargets: ['http-server'],
    }),
  ],
})
export class AppModule {}
```

#### 11.1.2 예제 앱(개념) — Configurer 직접 호출 제거

- 제거 대상: `Scalar.setup(adapters, options)` 같은 수동 호출
- 대체: `provideScalar(...)`가 등록하는 구성요소가 `configure(app, adapters)`를 통해 라우트를 바인딩한다.

### 11.2 “런타임 확장 모델 없음”을 문서/정책에 반영하는 작업 목록

이 작업은 용어/모델 혼선을 제거하기 위한 문서 정합성 작업이며, 런타임 개념을 새로 만들지 않는다.

- PLAN 정합성(현재 문서):
  - 런타임 확장 모델(훅 컨테이너/레지스트리/실행 모델)을 도입하는 문장/예시는 금지
  - 외부 기능은 전부 “provider bundle 패키지 = provider bundle”로만 서술
- SSOT 문서 정합성(필수 상태):
  - [ARCHITECTURE.md](ARCHITECTURE.md): provider bundle 패키지를 별도 개념 없이 provider bundle로만 서술
  - [DEPENDENCIES.md](DEPENDENCIES.md): provider bundle 패키지 분류를 provider bundle 패키지로만 서술
  - [TOOLING.md](TOOLING.md): CLI의 의존 금지 대상 표현은 유지하되, 용어는 provider bundle 중심으로 정리

### 11.3 Scalar를 Provider로 전환하기 위한 설계 고정

#### 11.3.1 Scalar의 public API 목표

- 유지(그대로): 데코레이터들(`ApiOperation`, `ApiProperty`, `ApiResponse`, ...)
- 변경(Provider-only로 전환):
  - 제거 대상: `Scalar.setup(adapters, options)` (직접 설치 API)
  - 신규/기본 API: `provideScalar(options) => Provider[]`

#### 11.3.2 Scalar provider bundle이 반드시 포함해야 하는 구성요소

`provideScalar(options)`는 최소한 아래 2종 provider를 생성한다.

- `ScalarSetupOptions` 제공 provider
  - `{ provide: <ScalarSetupOptionsToken>, useValue: options }`
- Scalar 설치 수행 provider(= 구성요소)
  - `Configurer`를 구현하여 `configure(_app, adapters)` 시점에 `setupScalar(adapters, options)`를 수행
  - 중복 바인딩 방지(현재 Scalar 구현의 `WeakSet`/`boundAdapters` 정책)는 유지

옵션 토큰이 필요한 이유(SSOT 고정):

- `provideScalar(options)`는 “옵션 값”을 DI 그래프에 올려야 하고, 그래프에서 값은 반드시 식별자(token)를 가져야 한다.
- Scalar 설치 구성요소(`Configurer`)는 옵션을 `inject`로 주입받아야 하므로, 옵션 provider는 토큰을 통해서만 참조된다.

`ScalarSetupOptionsToken` 형태 고정:

- `ScalarSetupOptionsToken`은 반드시 `symbol`이어야 한다(MUST).
- 토큰은 반드시 `Symbol.for('@bunner/scalar:setup-options')`로 생성한다(MUST).
  - 이유: 패키지가 중복 로드되거나 번들링 경계가 생겨도 동일 토큰이 안정적으로 매칭되어야 한다.

추가로, “반드시 필요할 때만” 아래를 포함한다.

- `OnInit`/`OnStart`/`OnShutdown` 등 라이프사이클 훅이 필요한 경우(예: 워밍업/정리)

#### 11.3.3 결정성/부작용 제약(Scalar에도 동일 적용)

- 런타임 소스 스캔 금지: Scalar는 “어댑터 인스턴스(런타임 객체)”만 사용해 라우트를 바인딩한다.
- AOT 산출물/레지스트리 수정 금지: Scalar는 `__BUNNER_METADATA_REGISTRY__` 등을 수정하지 않는다.

### 11.4 실제 코드 작업이 들어갈 패키지와 디렉토리 구조(예정)

아래 목록은 “어느 패키지/어느 파일을” 수정/추가/삭제하는지까지 구체적으로 고정한다.

#### 11.4.1 패키지: `packages/scalar`

- 수정(예정)
  - packages/scalar/index.ts
    - public facade에서 `provideScalar`를 명시 export
    - `Scalar` export 제거(또는 완전 삭제 후 README 반영)
  - packages/scalar/src/index.ts
    - 내부 export 정합성 반영
  - packages/scalar/README.md
    - Public API를 `provideScalar(options)` + decorators로 재정의

- 추가(예정)
  - packages/scalar/src/scalar/provide-scalar.ts
    - `provideScalar(options): Provider[]` 구현
  - packages/scalar/src/scalar/scalar-configurer.ts
    - `Configurer` 구현체(옵션 token 주입 → `setupScalar` 호출)
  - packages/scalar/src/scalar/tokens.ts
    - `ScalarSetupOptions` token(문자열/심볼/클래스 중 1개로 고정)
  - packages/scalar/src/scalar/index.ts
    - feature barrel에 `provideScalar`/token/타입 export

- 삭제(예정)
  - packages/scalar/src/scalar.ts
    - `Scalar.setup(...)` 래퍼 클래스 제거(Provider-only로 전환)

#### 11.4.2 패키지: `examples` (예제 앱)

- 수정(예정)
  - examples/src/app.module.ts
    - `import { Scalar } from '@bunner/scalar'` 제거
    - `Scalar.setup(...)` 호출 제거
    - `provideScalar(...)` provider bundle을 `@Module({ providers: [...] })`에 추가

#### 11.4.3 패키지: `packages/common` (DI Provider primitive 정합성)

Provider-only 방향을 고정하려면 provider object shape는 **단 하나**여야 한다.
이 Plan은 “프레임워크 시장에서 가장 널리 쓰이는” 형태로 `provide` 키를 정본으로 선택한다.

- 목표: Plan의 표기와 런타임/CLI의 실제 타입/파싱을 `{ provide, useClass/useValue/useFactory/inject/useExisting }`로 완전히 일치시킨다.

- 수정(예정)
  - packages/common/src/interfaces.ts
    - `ProviderToken`이 `string | symbol | Class`를 수용함을 정본으로 유지
    - `ProviderUseExisting.useExisting`가 token(alias)를 수용하도록 정합(문서의 string token 허용과 일치)
  - packages/common/src/types.ts
    - `Provider` 타입 정의를 위 변경에 맞춰 정합

#### 11.4.4 패키지: `packages/core` (Container/provider 로딩)

- 수정(예정)
  - packages/core/src/injector/container.ts
    - provider object 로딩 시 `p.provide`를 사용하도록 정합
    - `useExisting`/`useClass`/`useFactory` 전 케이스를 실제 동작으로 완성
      - 현행은 `useValue`/`useFactory`만 동작하고, 나머지는 `null` factory로 떨어지는 경로가 존재함

#### 11.4.5 패키지: `packages/cli` (AOT generator/provider normalize)

- 수정(예정)
  - packages/cli/src/analyzer/graph/module-graph.ts
    - provider normalize 로직이 `provide`/`inject`/`useExisting`를 정확히 해석하도록 정합
  - packages/cli/src/generator/injector.ts
    - AOT 산출물에서 factory deps 추출/정규화가 provider primitive와 일치하도록 정합

### 11.5 삭제되어야 할 코드/파일(명시 목록)

Provider-only로 전환하면서 “중복 API/개념”을 남기지 않는다(Deprecated 금지).

- packages/scalar/src/scalar.ts (삭제)
- examples/src/app.module.ts 내 `Scalar.setup(...)` 호출부(삭제)
- packages/scalar/README.md 내 `Scalar.setup` 문서(삭제)

추가 삭제 후보(실제 구현 단계에서 확정):

- `Scalar` 클래스가 남아있는 export/테스트/사용처 전체

### 11.6 테스트/검증 단계(예정)

최소 검증 루틴(변경 반영 후 실행):

- `bun run tsc`
- `bun run lint`
- `bun test`

Scalar 전환 관련 유닛 테스트 범위(예정):

- `provideScalar()`가 반환하는 provider bundle의 shape(결정적/순서 고정)
- Configurer 구현체가 `configure()`에서 `setupScalar()`를 정확히 호출
