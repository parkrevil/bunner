---
trigger: always_on
---

# 아키텍처 및 디렉토리 구조 가이드

`bunner` 프로젝트의 아키텍처 원칙, 디렉토리 구조, 그리고 코딩 표준을 정의한다.
이 문서는 프로젝트의 일관성, 확장성, 그리고 유지보수성을 보장하기 위한 **Single Source of Truth**이다.

## 1. 하이라이트 아키텍처 (High-Level Architecture)

이 프로젝트는 **Bun Workspaces**를 기반으로 한 **모노레포(Monorepo)** 아키텍처를 따른다.
코드는 `packages/` 내의 모듈식 패키지로 구성되어 **관심사 분리(SoC)**와 **재사용성**을 극대화한다.

- **모노레포 도구**: `bun` (workspaces)
- **패키지 관리**: `packages/*` 하위의 각 디렉토리는 독립적인 npm 패키지로 관리 및 배포된다.

### 아키텍처 세부 원칙 (Architectural Rules)

프레임워크 수준의 품질과 안정성을 위해 다음 원칙을 엄격히 준수한다.

1.  **단방향 의존성 (Dependency Direction)**
    - 상위 계층(예: `http-server`)은 하위 계층(예: `core`)을 의존할 수 있다.
    - **반대 방향의 의존은 절대 불가**하다. (하위 계층은 상위 계층을 알면 안 된다)
    - 순환 참조(Circular Dependency)를 원천 차단한다.

2.  **Public API 캡슐화 (Encapsulation via Exports)**
    - 물리적인 `internal` 디렉토리를 사용하지 않고, **Barrel 파일(`index.ts`)을 통한 논리적 캡슐화**를 수행한다.
    - `index.ts`는 **"무엇을 노출할 것인가"**를 엄격하게 결정하는 관문이다.
    - 외부에 반드시 필요한 API만 명시적으로 선택하여 Export 하며, 내부 구현 로직이 실수로 노출되지 않도록 엄격히 통제한다.

3.  **에러 핸들링 표준 (Error Handling)**
    - 모든 시스템 에러는 프레임워크 표준 Error 클래스(예: `BunnerError`)를 상속받아야 한다.
    - 비즈니스 로직 제어 흐름에 `throw`를 남용하지 않으며, 명시적 에러 반환 패턴을 고려한다.

---

## 2. 디렉토리 구조 (Directory Structure)

### 루트 디렉토리 (Root Directory)

````text
/
├── packages/           # 핵심 프레임워크 패키지
├── examples/           # 사용 예시 애플리케이션
├── package.json        # 워크스페이스 Root 설정
├── bun.lock            # Lockfile
├── tsconfig.json       # Base TypeScript 설정
└── .husky/             # Git Hooks
```text

### 상세 패키지 구조 (Detailed Package Structure)
모든 패키지는 아래와 같이 **메타 파일(상수, 타입, 인터페이스 등)**과 **배럴 파일(`index.ts`)**이 명확히 배치된 구조를 따른다.
아래는 프레임워크 코어(`core`) 패키지의 예시이다.

```text
packages/[package-name]/
├── src/
│   ├── injector/               # 모듈/기능 단위 (예: 의존성 주입)
│   │   ├── errors/             # 해당 기능 전용 에러
│   │   │   ├── circular-dependency.error.ts
│   │   │   └── unknown-provider.error.ts
│   │   ├── container.ts        # 핵심 구현체
│   │   ├── instance-loader.ts
│   │   ├── constants.ts        # 상수 (INJECTION_TOKEN 등)
│   │   ├── enums.ts            # Enum (Scope 등)
│   │   ├── interfaces.ts       # 인터페이스 (Provider, Type 등)
│   │   ├── types.ts            # 타입 정의
│   │   └── index.ts            # [중요] 해당 모듈의 Export 관리
│   │
│   ├── metadata/               # 메타데이터 관리 모듈
│   │   ├── scanner.ts          # 스캐너 구현체
│   │   ├── reflector.ts
│   │   ├── constants.ts
│   │   └── index.ts
│   │
│   ├── common/                 # 패키지 공통 유틸리티
│   │   ├── helpers.ts
│   │   ├── constants.ts
│   │   ├── interfaces.ts
│   │   └── index.ts
│   │
│   └── index.ts                # [Internal Public API] src 내부 정리용
│
├── tests/                      # 테스트 환경
│   ├── fixtures/               # 테스트 픽스처 (Mock Classes)
│   │   ├── mock-provider.ts
│   │   └── index.ts
│   ├── integrations/           # 통합 테스트
│   │   └── container.spec.ts
│   └── e2e/                    # E2E 테스트
│       └── application-lifecycle.spec.ts
│
├── index.ts                    # [Package Entry] 최종 Public API 진입점
├── package.json
├── tsconfig.json
└── README.md
```text

### 디렉토리 및 파일 관리 규칙
1.  **소스 위치**: 모든 기능 코드는 반드시 `src/` 내부에 위치한다.
2.  **메타 파일 분리**:
    -   `constants.ts`, `enums.ts`, `interfaces.ts`, `types.ts` 등 성격이 다른 선언부는 별도 파일로 분리하여 관리한다. (1파일 1목적 원칙)
3.  **공유 자원 관리**:
    -   **Cross-Domain**: 여러 도메인(기능)에서 공유되는 자원만 `src/common`에 둔다.
    -   **Sub-Module Sharing**: 하위 모듈 간 공유 자원은 별도 `common` 폴더 없이 **해당 모듈 내(상위 디렉토리)**에 위치시킨다.
4.  **테스트 자산**: 테스트에 필요한 Fixture나 Mock 데이터는 `tests/fixtures`에서 중앙 관리한다.

---

## 3. 구현 가이드라인 (Implementation Guidelines)

### 네이밍 규칙 (Naming Conventions)
일관성은 유지보수의 핵심이다.

| 대상 | 규칙 | 예시 | 비고 |
|:---:|:---|:---|:---|
| **디렉토리** | `kebab-case` | `http-server`, `user-auth` | |
| **패키지명** | `kebab-case` (Scoped) | `@bunner/http-server` | |
| **파일명** | `kebab-case` | `user-controller.ts` | |
| **클래스** | `PascalCase` | `UserController` | |
| **인터페이스** | `PascalCase` | `HttpRequest` | `I` 접두사 금지 |
| **타입(Type)** | `PascalCase` | `UserResponse` | |
| **함수/변수** | `camelCase` | `getUser`, `isValid` | |
| **상수** | `SCREAMING_SNAKE_CASE` | `MAX_CONNECTIONS` | `const` assertion 권장 |
| **Enum** | `PascalCase` | `UserRole` | |

### Type, Interface, Enum 사용 기준 (Selection Criteria)
각 문법의 특성에 맞춰 적절한 선택을 해야 한다.

1.  **Type vs Interface**
    -   **Interface**: **확장성**이 필요한 객체 구조 정의, `implements`/`extends` 사용 시.
    -   **Type**: 유니온(`|`), 교차(`&`), 튜플, Alias 등 **기능적 타입 정의** 시.

2.  **상수 집합(Enum) 선택 기준**
    -   **Enum (권위와 표준)**: 시스템의 핵심 규격이거나 외부 표준 프로토콜을 따를 때 사용합니다. 코드에 이것은 단순한 값이 아니라 프레임워크가 공식적으로 관리하는 독립적인 엔티티라는 권위를 부여할 때 적합합니다. 런타임에 실제 객체로 존재하므로 값의 존재 여부를 검증하거나 도메인의 실체를 명시해야 하는 `HttpMethod`, `HttpStatus`, `UserRole` 등에 사용하며 문자열 기반의 **String Enum**을 권장합니다.
    -   **Union Type (실용적 제약)**: 단순히 변수에 들어갈 값의 범위를 제한하고 싶을 때 사용합니다. 별도의 임포트 과정 없이 문자열만으로 직관적인 사용이 가능한 개발자 경험이 중요할 때 가장 적합합니다. 컴파일 후 코드가 남지 않는 제로 오버헤드를 지향하며 `SortOrder`나 `Size`와 같이 가벼운 옵션 성격의 데이터에 사용합니다.
    -   **as const (매핑과 순회)**: 런타임에 데이터 구조로서 값의 목록을 순회하거나 키와 값을 룩업 테이블로 활용해야 할 때 사용합니다. 타입 정의를 넘어 실제 객체 데이터로서 런타임 로직에 참여해야 하는 `ErrorMessages`나 `ConfigMap`과 같은 사전 형태의 데이터를 관리할 때 필수적입니다.
    -   **const enum (최적화된 명명)**: 의미 있는 이름을 부여하여 가독성을 높이고 싶지만 런타임에 객체가 생성되는 오버헤드는 완전히 제거하고 싶을 때 사용합니다. 컴파일 시점에 모든 값이 인라인으로 치환되어 Union Type처럼 가볍게 동작하면서도 코드상에서는 매직 넘버나 매직 스트링 대신 명확한 상수의 이름을 유지할 수 있습니다. 주로 프레임워크 내부 로직에서 성능 최적화와 명명 규칙을 동시에 챙겨야 하는 `LogLevel`이나 `Flag` 등에 사용합니다.

### 타입 정의 및 안전성 원칙
1.  **타입 정의 우선순위**: **TypeScript 자체 문법**을 최우선으로 사용한다. (복잡한 유틸리티 타입보다 가독성 중시)
2.  **Loose Type 사용 지양**:
    -   `any`: 기본적으로 사용을 지양하지만, **타입 정의가 지나치게 복잡하거나 불가능한 경우(예: 외부 라이브러리 호환, 동적 컨텍스트)**에 한해 예외적으로 허용한다.
    -   `unknown`: 가능한 구체적인 타입을 사용하거나 Type Guard와 함께 사용한다.
    -   `Record<string, any>`: 지양. 구체적인 인터페이스나 인덱스 시그니처 사용.
3.  **명시적 반환 타입 (Explicit Return Types)**:
    -   Export 되는 모든 Public 함수/메서드는 **반환 타입을 명시**해야 한다.

### 구현 우선순위 (Implementation Priority)
1.  **1순위**: **Bun Native** 기능
2.  **2순위**: **Node.js Native** 기능 (Bun 호환)
3.  **3순위**: 검증된 **npm 패키지**
4.  **4순위**: **직접 구현** (Custom)

### 코딩 품질 및 스타일 (Code Quality & Style)
1.  **중복 코드 제거**: 중복은 없어야 하며, 필요 시 좁은 범위에서 확장을 통해 해결한다.
2.  **단일 책임 파일**: 한 파일에 Type, Class, Interface를 몰아넣지 않는다. (1파일 1주요 선언)
3.  **불변성(Immutability)**: 인자로 받은 객체/배열은 변형하지 않으며, `readonly`를 적극 사용한다.
4.  **비동기 안전성(Async Safety)**: Floating Promise(`await` 누락)를 금지하고, 루프 내 `Promise.all` 사용을 권장한다.
5.  **문서화(TSDoc)**: 모든 Public API에는 TSDoc(`@param`, `@returns`)을 작성한다.

### 함수 및 메서드 설계 원칙 (Func/Method Design Principles)
코드의 원자성(Atomicity) 확보와 결합도 최소화를 위해 다음 규칙을 강제한다.

1.  **원자성 준수 (Atomicity Enforcement)**
    -   모든 함수/메서드는 단일 오퍼레이션(Single Atomic Operation)만을 수행해야 한다.
    -   제어 흐름 분기(Branching)가 많은 복합 로직은 반드시 하위 `private` 메서드나 별도 헬퍼 함수로 분해한다.

2.  **구현체 선택 엄격 기준 (Construct Selection Rules)**
    -   **Standalone Function (Pure Logic)**:
        -   상태(State) 의존성이 없는 모든 로직은 **반드시** 독립 함수로 구현한다.
        -   클래스 내부 메서드로 불필요하게 귀속시키는 것을 금지한다.
    -   **Instance Method (State/DI Context)**:
        -   인스턴스 상태(`this`) 접근 또는 의존성 주입(DI)이 필수적인 경우에 한하여 사용한다.
    -   **Static Method (Namespace Scope)**:
        -   특정 클래스의 네임스페이스 종속성이 명확한 팩토리 패턴이나 유틸리티에 한해 제한적으로 허용한다.
        -   단순 공유 로직은 Static Method가 아닌 Standalone Function 사용을 원칙으로 한다.

### 패키지 스크립트 표준 (Scripts)
`package.json` 표준 스크립트:
```json
"scripts": {
  "test": "bun test",
  "lint": "eslint . --fix",
  "build": "tsc --noEmit"
}
```text

### Exports (Barrel 패턴) 및 패키지 캡슐화 가이드
패키지의 루트 `index.ts`는 패키지의 **유일한 경계(Boundary)**이다.

-   **엄격한 노출 제어 (Strict Export Control)**:
    -   Barrel 파일(`index.ts`)을 통한 논리적 캡슐화를 수행한다.
    -   **내부(Internal) 사용**: 패키지 내부(src)에서 모듈을 합칠 때는 간결함을 위해 `export *` 사용을 허용한다. 단, 순환 참조 발생 시에는 즉시 명시적 export로 전환한다.
    -   **공개(Public) 사용**: 패키지 최상위 루트 `index.ts`에서는 외부 사용자에게 필요한 API만 **명시적 이름(`export { ... }`)으로 선별하여 Export** 한다.

예시:
```ts
// src/application/index.ts (내부 모듈용) - 간결함 허용
export * from './application';
export * from './interfaces';

// packages/core/index.ts (Public API 진입점) - 엄격한 제어
export { BunnerApplication } from './src/application';
export type { AppOptions } from './src/application/interfaces';
```text
````
