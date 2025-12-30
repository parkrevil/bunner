# STYLEGUIDE

## 목적

- 네이밍/타입/코드 스타일/함수 설계/파일 분해 기준을 일관되게 적용한다.
- 리뷰 기준을 객관화해서 “취향” 논쟁을 차단한다.

## 적용 범위

- TypeScript 코드 및 문서화된 예시 코드 전반

## 정본/우선순위

- 최상위 정본은 [SPEC.md](SPEC.md)다.
- 아키텍처 경계/Facade 규칙은 [ARCHITECTURE.md](ARCHITECTURE.md)가 우선한다.

## 구현 우선순위 (Implementation Priority)

1. 1순위: Bun Native 기능
2. 2순위: Node.js Native 기능 (Bun 호환)
3. 3순위: 검증된 npm 패키지
4. 4순위: 직접 구현 (Custom)

## 핵심 규칙 요약 (Quick Reference)

| #   | 규칙                                    | 위반 예                           | 섹션  |
| --- | --------------------------------------- | --------------------------------- | ----- |
| 1   | 파일명 `kebab-case` (예약 파일 제외)    | `UserService.ts` ❌               | 6.1   |
| 2   | 한 글자 식별자 금지 (`i/j/k`, `_` 제외) | `p`, `v`, `x` ❌                  | 6.2.1 |
| 3   | 축약어 금지 (`id` 제외)                 | `ctx`, `req`, `res` ❌            | 6.2.3 |
| 4   | 인라인 오브젝트 타입 금지               | `{ a: number }` ❌                | 10.3  |
| 5   | 타입/인터페이스는 구현 파일 분리        | `types.ts` / `interfaces.ts` 사용 | 10.2  |
| 6   | `any`/`unknown` 금지 (필수 경우만)      | 정확한 타입 정의                  | 8.2   |
| 7   | Public 함수는 반환 타입 명시            | `function foo(): string`          | 8.3   |
| 8   | 선언/제어문 사이 빈 줄                  | `const x=1; if(...)` ❌           | 10.9  |
| 9   | Early return은 블록 형태                | `if(x) return;` ❌                | 10.9  |
| 10  | 클래스는 `this` 필요 시만               | Standalone Function 우선          | 11.2  |

상세 규칙은 아래 각 섹션 참조.

## 6. 네이밍 규칙 (Naming Conventions)

이 규칙은 “권장”이 아니다. 위반은 즉시 수정 대상이다.

|    대상    | 규칙                   | 예시                       | 비고                   |
| :--------: | :--------------------- | :------------------------- | :--------------------- |
|  디렉토리  | `kebab-case`           | `http-server`, `user-auth` |                        |
|  패키지명  | `kebab-case` (Scoped)  | `@bunner/http-server`      |                        |
|   파일명   | `kebab-case`           | `user-controller.ts`       |                        |
|   클래스   | `PascalCase`           | `UserController`           |                        |
| 인터페이스 | `PascalCase`           | `HttpRequest`              | `I` 접두사 금지        |
| 타입(Type) | `PascalCase`           | `UserResponse`             |                        |
| 함수/변수  | `camelCase`            | `getUser`, `isValid`       |                        |
|    상수    | `SCREAMING_SNAKE_CASE` | `MAX_CONNECTIONS`          | `const` assertion 권장 |
|    Enum    | `PascalCase`           | `UserRole`                 |                        |

### 6.1 예약 파일명 (Reserved Filenames)

이 프로젝트에는 “예외”가 아니라 **예약 파일명**이 존재한다.
예약 파일명은 역할(Contract/Facade/Meta)을 나타내는 표준 이름이며, 파일명 `kebab-case` 규칙의 적용 대상이 아니다.

예약 파일명(대표):

- `index.ts`: Barrel/Facade 파일
  - 패키지 루트 `index.ts`: Public Facade
  - `src/index.ts`: Internal Facade
  - `src/<feature>/index.ts`: Feature Barrel
- `constants.ts`: 상수 선언 파일
- `enums.ts`: enum 선언 파일
- `interfaces.ts`: interface(계약) 선언 파일
- `types.ts`: type(조합/alias) 선언 파일
- `*.spec.ts`: 테스트 파일
- `*.error.ts`: 에러 클래스 파일

위 예약 파일명이 아닌 “구현 파일”은 `kebab-case`를 강제한다.

### 6.2 식별자 명확성 규칙 (Identifier Clarity Rules)

이 섹션은 “취향”이 아니다. 애매한 네이밍은 코드 리뷰와 에이전트 집행에서
동일한 판정을 불가능하게 만들므로, 다음 규칙을 강제한다.

#### 6.2.1 한 글자 식별자 금지 (Single-letter Identifier Ban)

- 기본 규칙: 한 글자 식별자(`p`, `v`, `x`, `t`, `n` 등)는 금지한다(MUST NOT).
- 예외(허용): 아래 경우에만 허용한다(MAY).
  - 단순 인덱스 루프의 인덱스: `i`, `j`, `k`
    - 조건: 숫자 인덱스가 핵심이고 스코프가 루프 블록에 국한되며, 본문이 짧다.
  - 의도적으로 사용하지 않는 값: `_`, `_e`, `_err`, `_unused` 형태
    - 조건: “정말로 사용하지 않음”을 표현하는 경우에만 사용한다.
- 금지(예외 남용): 콜백 파라미터를 한 글자로 두는 행위는 금지한다(MUST NOT).
  - 예: `forEach((p) => ...)`, `map((v) => ...)`

#### 6.2.2 콜백 파라미터 네이밍 (Callback Parameter Naming)

- 콜백 파라미터는 데이터 의미를 드러내는 이름을 사용해야 한다(MUST).
  - 예: `provider`, `providerDef`, `moduleNode`, `entry`, `token`, `importItem`
- 컬렉션/반복 네이밍은 자연어 규칙을 따른다(MUST).
  - 배열/리스트는 기본값으로 **복수 명사**를 사용한다(MUST).
    - 예: `products`, `users`, `routes`
  - 순회 변수는 기본값으로 **단수 명사**를 사용한다(MUST).
    - 예: `product`, `user`, `route`
  - `*List`, `*Map` 같은 접미사는 “자료구조 의미”가 실제로 중요할 때만 허용한다(MAY).
    - 단순 나열/집합 의미라면 `products`처럼 자연어 복수형을 우선한다(MUST).
  - Map은 키 의미를 드러내는 이름을 사용한다(MUST).
    - 예: `productsById`, `userByEmail`
- 아래 중 하나라도 해당하면, 콜백 파라미터는 반드시 의미 기반 이름이어야 한다(MUST).
  - 콜백 바디가 1줄을 초과한다.
  - 파라미터에서 프로퍼티 접근이 발생한다(예: `provider.name`).
  - 콜백 스코프에서 파라미터가 2회 이상 사용된다.

#### 6.2.3 축약어 사용 제한 (Abbreviation Control)

- 기본 규칙: 의미가 불명확한 축약어를 관습으로 도입하지 않는다(MUST NOT).
- 예외(허용): `id` 단 하나만 허용한다(MAY).
- 그 외 모든 축약어(`ctx`, `req`, `res`, `err` 등 포함)는 금지한다(MUST NOT).
- 애매한 경우: 축약어를 쓰지 말고 풀어서 쓴다(MUST).

## 7. Type / Interface / Enum 선택 기준 (Selection Criteria)

### 7.1 Type vs Interface

- Interface: 아래 목적 중 하나라도 해당하면 Interface를 사용한다.
  - `implements`/`extends`가 설계의 일부인 “계약(Contract)” 타입(가장 우선). 구현 클래스가 계약을 **강제**해야 한다.
  - 데이터 스키마(요청/응답/저장/직렬화)처럼 “객체 형태”가 시스템 경계에 걸려 있고, 팀/도메인에서 **규격으로 유지**되어야 하는 구조.
    - 강제(MUST): 위와 같은 데이터 스키마/경계 계약(Object shape)은 `type X = { ... }`가 아니라 **반드시** `interface X { ... }`로 선언한다.
    - 예외: 유니온(`|`), 교차(`&`), 튜플, Alias 등 “조합/제약”이 핵심인 경우는 `type`을 사용한다.
  - (부수적) 확장 가능성이 핵심인 객체 구조.
- Type: 유니온(`|`), 교차(`&`), 튜플, Alias 등 “조합/제약”이 핵심이면 Type을 사용한다. 런타임 오브젝트를 남기지 않는 제로 오버헤드를 기본값으로 둔다.
- 금지: 기준 없이 Interface/Type을 혼용하지 마라. 애매하면 기본은 **Type**로 시작하고, “`implements` 강제” 또는 “스키마 규격화” 요구가 생길 때만 Interface로 승격한다.

### 7.2 Enum / Union Type / as const / const enum

- Enum(문서/규격): 시스템의 핵심 규격이거나 외부 표준 프로토콜을 따를 때만 사용한다. 기본은 문자열 Enum을 사용한다.
- Union Type(제로 오버헤드): 단순 값 범위 제약이면 Union Type을 사용한다(컴파일 후 런타임 객체를 남기지 않는 것을 우선한다).
- `as const`(룩업/순회): 런타임에서 값 목록을 순회하거나 룩업 테이블로 쓸 필요가 있을 때만 사용한다.
- `const enum`(최적화): 런타임 오브젝트를 없애면서도 이름을 남겨야 할 때만 예외적으로 사용한다.

## 8. 타입 정의 및 안전성 원칙

1. 타입 정의 우선순위: TypeScript 자체 문법을 최우선으로 사용한다. 복잡한 유틸리티 타입은 “필요할 때만” 허용한다.
2. Loose Type 사용 지양:

- `any`: TypeScript로 **절대 표현할 수 없는 타입**인 경우에만 사용한다(MAY). 그 외 사용은 금지한다(MUST NOT).
- `unknown`: TypeScript로 **절대 표현할 수 없는 타입**인 경우에만 사용한다(MAY). 그 외 사용은 금지한다(MUST NOT).
- `Record<string, any>`: 금지한다(MUST NOT). 필요한 경우 목적에 맞는 타입/인터페이스를 정의한다(MUST).

1. 명시적 반환 타입(강제): export 되는 모든 Public 함수/메서드는 반환 타입을 반드시 명시해야 한다.

2. TypeScript 문법 최대 활용(강제):

- TypeScript는 방대하고 강력한 문법을 제공한다.
- 구현은 <https://www.typescriptlang.org/docs> 에 정의된 문법을 **최대한 활용**해야 한다(MUST).
- 타입 단언, 인라인 오브젝트 타입, loose type로 문제를 덮는 행위는 금지한다(MUST NOT).

## 10. 코딩 품질 및 스타일 (Code Quality & Style)

1. 중복 코드 제거: 중복은 허용하지 않는다. 재사용이 필요하면 즉시 함수/모듈로 끌어올려 단일화한다.
2. 단일 책임 파일: 한 파일에 Type/Class/Interface를 뒤섞는 것을 금지한다. (1파일 1목적)

판정 기준(강제):

- 구현 파일이 클래스(또는 함수) 구현을 담는 경우, 그 파일은 해당 책임의 구현만 담는다(MUST).
- 보조 타입(alias/interface)이 필요하면, 우선 같은 feature의 `types.ts`/`interfaces.ts`로 둔다(MUST).
- 타입/인터페이스를 구현 파일에 남겨 두는 예외는 존재하지 않는다(MUST NOT).
- 위 처리가 불가능하거나 판단이 애매하면, 임의로 섞지 말고 중단 후 확인한다(MUST).

1. 인라인 오브젝트 타입 금지(강제):

- 코드에 `{ a: number; b: number }` 같은 오브젝트 타입 리터럴을 직접 작성하는 행위는 금지한다(MUST NOT).
- 오브젝트 shape는 항상 목적에 맞는 `type` 또는 `interface`로 정의해서 사용한다(MUST).

1. 불변성(Immutability): 인자로 받은 객체/배열은 변형하지 않는다. 가능하면 `readonly`를 사용해 의도를 고정한다.
2. 비동기 안전성(Async Safety): Floating Promise(`await` 누락)는 금지다. 병렬 처리는 의도적으로 `Promise.all`을 사용한다.
3. 문서화(TSDoc): Public API는 예외 없이 TSDoc(`@param`, `@returns`)을 작성한다.

4. 주석(Comments): Public API TSDoc을 제외한 모든 코멘트/주석은 **금지**다.
   - 금지 예: `// TODO`, `// FIXME`, 설명용 인라인 주석, 임시 디버그 주석, “왜 이렇게 했는지” 메모.
   - 허용 예: Public API TSDoc(외부 사용자에게 계약을 설명하는 목적)만.

5. 파일 분해(Granularity): “작게 쪼개는 것” 자체는 품질이 아니다. 파일 분해는 16 섹션의 기준을 **반드시** 만족해야 한다.

6. Deprecated 금지: deprecated된 코드/파일을 **절대 남기지 마라**.
   - `@deprecated`/`deprecated` 표기, deprecated 전용 파일/폴더, 사용되지 않는 구 API를 “호환용”으로 방치하는 행위를 금지한다.
   - 변경 과정에서 deprecated가 발생했다면, 그 작업 범위 내에서 **완전 제거**까지 끝내야 한다(혹은 사용자에게 명시적 승인 요청).

7. 코드 스타일(공백/블록) 규칙: 이 규칙은 “취향”이 아니다. 예외는 없다.
   - 선언 블록 분리: `const`/`let` 선언 라인과 `if`/`for`/`while`/`try` 같은 제어문 라인은 **붙여 쓰지 않는다**. 사이에 **빈 줄 1줄**을 강제한다.
   - Early return 강제: 유효성/가드 조건은 가능한 한 빨리 실패로 종료한다.
     - 금지: one-line early return (예: `if (invalid) return ...;`)
     - 강제: 블록 형태로 작성한다.
   - 호출 라인 그룹 규칙:
     - “단순 호출”끼리는 붙여 쓸 수 있다.
     - “값을 받는 호출”(예: `const x = fn()`) 라인과 “단순 호출” 라인은 **붙여 쓰지 않는다**. 사이에 **빈 줄 1줄**을 강제한다.
   - 로깅 라인 격리:
     - 로깅 라인은 로깅 라인끼리만 붙여 쓴다.
     - 로깅 블록은 그 외 어떤 라인과도 붙여 쓰지 않는다. 로깅 블록의 앞/뒤에 **빈 줄 1줄**을 강제한다.
   - `else` 금지(가드 스타일): early return을 사용한 분기에는 `else`를 붙이지 않는다.

예시(규칙 준수):

```ts
if (invalid) {
  return result;
}

const value = compute();

doSideEffect();

logger.info('a');
logger.info('b');

if (otherInvalid) {
  return other;
}
```

복잡 예시(규칙 준수 결과):

- 목표: 검증(가드) / 값-받는 호출 / 단순 호출 / 로깅 블록 / 외부 의존(목킹 대상) / 에러 처리까지 한 함수에 들어간 “현실적인” 서비스 함수.
- 관찰 포인트:
  - early return은 블록 형태로만 사용한다.
  - 선언 라인과 제어문 라인을 붙여 쓰지 않는다.
  - 값-받는 호출과 단순 호출을 붙여 쓰지 않는다.
  - 로깅 라인은 로깅끼리만 붙여 쓰고, 로깅 블록 전/후는 빈 줄로 분리한다.

```ts
import { BunnerError } from '@bunner/common';

type PaymentRequest = {
  readonly userId: string;
  readonly amount: number;
  readonly currency: 'KRW' | 'USD';
};

type PaymentResult = {
  readonly receiptId: string;
  readonly chargedAmount: number;
  readonly currency: 'KRW' | 'USD';
};

type PaymentGateway = {
  charge(input: { userId: string; amount: number; currency: string }): Promise<{ receiptId: string }>;
};

type AuditLogger = {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
};

type UserRepository = {
  exists(userId: string): Promise<boolean>;
};

export async function processPayment(params: {
  readonly req: PaymentRequest;
  readonly userRepo: UserRepository;
  readonly gateway: PaymentGateway;
  readonly logger: AuditLogger;
}): Promise<PaymentResult> {
  const { req, userRepo, gateway, logger } = params;

  if (!req.userId) {
    throw new BunnerError('Invalid userId');
  }

  if (!Number.isFinite(req.amount) || req.amount <= 0) {
    throw new BunnerError('Invalid amount');
  }

  const userExists = await userRepo.exists(req.userId);

  if (!userExists) {
    throw new BunnerError('User not found');
  }

  logger.info('payment:charge:requested', { userId: req.userId, amount: req.amount, currency: req.currency });

  const receipt = await gateway.charge({
    userId: req.userId,
    amount: req.amount,
    currency: req.currency,
  });

  logger.info('payment:charge:succeeded', { userId: req.userId, receiptId: receipt.receiptId });

  return {
    receiptId: receipt.receiptId,
    chargedAmount: req.amount,
    currency: req.currency,
  };
}
```

유닛 테스트 예시(규칙 준수 결과):

```ts
import { describe, expect, it, mock } from 'bun:test';
import { BunnerError } from '@bunner/common';

import { processPayment } from './process-payment';

describe('processPayment', () => {
  it('된다: 유효한 입력이면 결제를 수행하고 영수증을 반환한다', async () => {
    const exists = mock(async (_userId: string) => true);
    const charge = mock(async (_input: any) => ({ receiptId: 'r_123' }));
    const info = mock((_m: string, _meta?: Record<string, unknown>) => {});
    const warn = mock((_m: string, _meta?: Record<string, unknown>) => {});

    const result = await processPayment({
      req: { userId: 'u1', amount: 1000, currency: 'KRW' },
      userRepo: { exists },
      gateway: { charge },
      logger: { info, warn },
    });

    expect(exists).toHaveBeenCalledTimes(1);
    expect(charge).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ receiptId: 'r_123', chargedAmount: 1000, currency: 'KRW' });
  });

  it('되면 안 된다: userId가 빈 문자열이면 BunnerError를 던진다', async () => {
    const exists = mock(async (_userId: string) => true);
    const charge = mock(async (_input: any) => ({ receiptId: 'r_123' }));
    const info = mock((_m: string, _meta?: Record<string, unknown>) => {});
    const warn = mock((_m: string, _meta?: Record<string, unknown>) => {});

    await expect(
      processPayment({
        req: { userId: '', amount: 1000, currency: 'KRW' },
        userRepo: { exists },
        gateway: { charge },
        logger: { info, warn },
      }),
    ).rejects.toBeInstanceOf(BunnerError);

    expect(charge).toHaveBeenCalledTimes(0);
  });

  it('되면 안 된다: amount가 0이면 BunnerError를 던진다', async () => {
    const exists = mock(async (_userId: string) => true);
    const charge = mock(async (_input: any) => ({ receiptId: 'r_123' }));
    const info = mock((_m: string, _meta?: Record<string, unknown>) => {});
    const warn = mock((_m: string, _meta?: Record<string, unknown>) => {});

    await expect(
      processPayment({
        req: { userId: 'u1', amount: 0, currency: 'KRW' },
        userRepo: { exists },
        gateway: { charge },
        logger: { info, warn },
      }),
    ).rejects.toBeInstanceOf(BunnerError);

    expect(charge).toHaveBeenCalledTimes(0);
  });

  it('되면 안 된다: 존재하지 않는 유저면 BunnerError를 던진다', async () => {
    const exists = mock(async (_userId: string) => false);
    const charge = mock(async (_input: any) => ({ receiptId: 'r_123' }));
    const info = mock((_m: string, _meta?: Record<string, unknown>) => {});
    const warn = mock((_m: string, _meta?: Record<string, unknown>) => {});

    await expect(
      processPayment({
        req: { userId: 'u1', amount: 1000, currency: 'KRW' },
        userRepo: { exists },
        gateway: { charge },
        logger: { info, warn },
      }),
    ).rejects.toBeInstanceOf(BunnerError);

    expect(charge).toHaveBeenCalledTimes(0);
    expect(info).toHaveBeenCalledTimes(0);
  });
});
```

## 11. 함수 및 메서드 설계 원칙 (Func/Method Design Principles)

이 섹션은 “권장사항”이 아니다. 기준을 어기면 설계 결함이다.

### 11.1 원자성 (Atomicity)

1. 모든 함수/메서드는 단일 오퍼레이션만 수행한다.
2. 분기/예외/케이스가 늘어날수록 더 작은 단위로 쪼개라.
3. 공개 메서드(public)는 오케스트레이션만 하고, 세부 로직은 하위 단위로 내려보낸다.

### 11.2 Standalone Function vs Private Method 선택 기준 (절대 기준)

다음 중 **하나라도 YES**면, 기본값(Standalone Function)에서 벗어날 수 있다.

1. `this`(인스턴스 상태)를 읽거나 변경하는가?
2. DI로 주입된 의존성(예: logger, adapter, container)을 직접 사용해야 하는가?
3. 클래스의 불변식(invariant) 유지/검증이 핵심 책임인가?

위 3개가 전부 NO면, 기본값은 **Standalone Function**이다.

추가 규칙(강제):

- “나중에 확장될 수 있다”는 이유로 클래스를 선택하지 않는다(MUST NOT).
- 클래스를 도입/유지하는 변경은, 아래 체크리스트 중 최소 1개를 YES로 만들 수 있어야 한다(MUST).
  - `this`(인스턴스 상태)를 읽거나 변경한다.
  - DI로 주입된 의존성(예: logger, fs, resolver)을 직접 사용한다.
  - 클래스의 불변식(invariant) 유지/검증이 핵심 책임이다.
- 위 3개가 전부 NO인데도 클래스가 필요하다고 주장하려면, 중단 후 명시 승인을 받아야 한다(MUST).

#### A. Standalone Function (기본값)

- 조건: 상태/DI 의존이 없다. 입력을 받아 결과를 낸다.
- 배치: 해당 기능 모듈 내부 파일(또는 `utils.ts`)에 둔다.
- 규칙:
  - 테스트 가능한 순수 로직은 절대 클래스에 가두지 마라.
  - 같은 로직이 2곳에서 필요해지면 즉시 함수로 끌어올려 중복을 제거한다.

#### B. Private Class Method (필요할 때만)

- 조건: `this` 접근이 필요하거나, 공개 메서드의 원자성을 유지하기 위해 클래스 내부로 쪼개야 한다.
- 규칙:
  - `private` 메서드는 “공개 메서드 1개”를 보조하도록 좁게 유지한다.
  - 재사용 가능성이 보이면 즉시 Standalone Function으로 승격한다.

#### C. Public Instance Method

- 조건: 외부에서 호출되는 API(서비스/핸들러/오케스트레이터)다.
- 규칙:
  - 반환 타입을 반드시 명시한다.
  - TSDoc(`@param`, `@returns`)을 반드시 작성한다.
  - 내부 구현은 Standalone Function 또는 private method로 분해해 짧게 유지한다.

#### D. Static Method (최후의 수단)

- 기본 금지. 아래 경우에만 예외 허용:
  - Factory(생성) 패턴
  - 클래스 네임스페이스에 귀속된 순수 유틸리티(단, 재사용 가능하면 standalone function 우선)
  - 런타임 캐시 등 “정적 공유 상태”가 설계적으로 필요한 경우

## 16. 파일 분해/응집도 표준 (File Granularity Standard)

이 섹션은 “권장사항”이 아니다. **과도한 마이크로 파일 분해는 금지**이며, 아래 기준으로만 분해를 허용한다.

1. **기본 원칙: 파일은 ‘책임의 단위’다**
   - 파일 1개는 1문장으로 책임을 설명할 수 있어야 한다.
   - 그 1문장이 “그리고(and)”로 늘어나기 시작하면 분해 신호다. 반대로, 1문장이 지나치게 빈약하면(단순 위임/래핑) 합침 신호다.

2. **분해 허용 조건(아래 중 하나라도 충족해야 한다)**
   - **공개 API 경계**: 외부에 노출되는 안정적인 심볼(예: 데코레이터/어댑터/퍼블릭 팩토리)을 1파일 1심볼로 제공해야 한다.
   - **독립적 변경 이유**: 해당 파일이 다른 책임과 “변경 이유”가 분리되어 있고, 실제로 독립적으로 변경/리뷰/테스트될 수 있어야 한다.
   - **테스트 격리**: 테스트가 해당 파일의 동작을 직접 검증하며, 타 파일과 분리됨으로써 테스트가 더 결정적/명확해진다.
   - **순환 참조 차단**: 분해가 순환 의존을 방지하거나 import 방향을 단방향으로 고정하는 데 실질적으로 기여한다.
   - **재사용 경계**: 최소 2개 이상의 소비자가 있고(다른 파일/기능), 재사용 경계가 명확하다.

3. **분해 금지 패턴(발견 즉시 병합/정리)**
   - **무의미한 래핑**: 단순히 다른 함수를 호출만 하는 thin wrapper(로직 없음/분기 없음/변환 없음)는 분해 금지.
   - **LOC 절감 목적 분해**: “파일이 길어 보여서” 쪼개는 행위 금지. 분해는 책임/변경 이유/테스트 격리로만 정당화된다.
   - **과도한 공용화**: 재사용 근거 없이 `utils.ts`/`helpers.ts`로 던져 넣는 행위 금지.

4. **마이크로 파일(극소 단위) 가드레일**
   - 비테스트 코드가 **매우 작은 파일**(대략 20 LOC 미만)이고, **단일 함수/단일 상수 수준**이라면 기본값은 **병합**이다.
   - 예외는 아래 중 하나라도 명확히 충족할 때만 허용한다.
     - **Public Facade/Feature Barrel**: `index.ts`처럼 “관문 역할” 자체가 책임인 파일
     - **공개 API 경계**: 외부에 노출되는 안정적인 심볼을 1파일 1심볼로 고정해야 할 때
     - **테스트 격리**: 해당 파일 단위로 테스트가 직접 붙고, 분리로 인해 테스트가 더 결정적/명확해질 때
     - **재사용 경계**: 최소 2개 이상의 소비자가 있고, 이 파일이 재사용 단위로 유지되는 것이 자연스러울 때
   - 위 예외 근거가 약하면, “작아 보이니 쪼갠다”가 아니라 **기존 책임 파일로 합쳐서 관리한다.**

5. **스칼라 패키지 기준 해석(적용 예)**
   - 스칼라처럼 “퍼블릭 API(데코레이터 등)”를 **명시 export로 엄격히 통제**해야 하는 경우, 1파일 1심볼 분해는 허용된다.
   - 단, 새 파일을 추가할 때마다 16-2의 정당화 조건을 만족하지 못하면 분해는 금지다.

## 16.6 단일-심볼 파일(마이크로 파일) 추가 규칙 (Enforced)

- “단일 함수/상수 1개만 export”하는 신규 파일을 추가하려면, 16-2의 정당화 조건 중
  최소 1개를 **구체적 근거**로 충족해야 한다(MUST).
- 정당화가 없다면 기본값은 병합이다(MUST).
- 금지: 근거 없는 `utils.ts`/`helpers.ts`로의 덤핑(레거시 유지와 신규 확장은 구분되며,
  신규 확장은 금지다)(MUST NOT).
