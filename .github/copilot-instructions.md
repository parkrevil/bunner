# Bunner 프로젝트 룰 (Copilot / AI Agent Instructions)

이 문서는 Bunner 프로젝트에서 AI 에이전트가 **절대적으로** 따라야 하는 규칙이다.

- **우선순위**: 이 문서의 규칙은 에이전트의 일반적 판단/관행보다 우선한다.
- **목표**: 프로젝트의 아키텍처 일관성, 확장성, 유지보수성, 안정성을 보장한다.

---

## 1. 작업 범위 (Scope)

1. 사용자가 지시한 범위 내에서만 코드 생성/수정/삭제를 수행한다. 범위를 벗어나는 변경은 **금지**이며, 필요하다고 판단되면 반드시 사용자에게 **사전 승인**을 받아야 한다.
2. 코드를 변경하기 전에, 반드시 관련 패키지/폴더의 구조와 기존 스타일(파일 배치, 네이밍, export 정책, 테스트 방식)을 확인한 뒤 그 규칙에 **그대로** 맞춘다.
3. “리팩토링 겸 정리”, “김치국(추정) 기반 개선”, “겉보기엔 더 깔끔함” 같은 임의 확장은 **금지**다. 사용자가 요구하지 않은 정리는 하지 마라.

---

## 2. AOT (핵심 가치)

1. AOT 컴파일러는 Bunner Framework의 핵심 가치이며, 설계/구현의 최우선 제약이다.
2. 모든 기능은 “런타임 추론/스캔/반사(reflection)”가 아니라 “CLI 기반 AOT 산출물”을 전제로 설계해야 한다.
3. `reflect-metadata` 사용은 **전면 금지**다. 예외는 없다.
4. AOT 결과물/레지스트리(`__BUNNER_METADATA_REGISTRY__`)를 런타임이나 외부에서 임의로 수정/패치/주입하려는 시도는 **금지**다.
5. 런타임 오버헤드를 유발하는 문제(스캔, 반사, 동적 탐색)는 “편의상 런타임에서 처리”하지 말고, AOT/CLI 단계에서 해결해야 한다.

---

## 3. AST (의존성 트리)

AST(의존성 트리)는 Bunner의 **AOT 파이프라인의 단일 진실(SSOT)** 이다.
CORE 런타임은 소스를 스캔하지 않는다. 런타임은 오직 CLI가 만든 메타데이터 레지스트리(`__BUNNER_METADATA_REGISTRY__`)를 소비한다.
따라서 AST/의존성 트리에 “빠짐”이 생기면, 그 순간 AOT는 실패다. 예외는 없다.

1. **추적 범위는 “프로젝트 + 임포트된 패키지 전체”다**
   - 로컬 소스(`src/**`)만 보지 마라.
   - 사용자가 임포트한 워크스페이스 패키지(`packages/*`)와 외부 패키지(`node_modules`)까지 포함하여 의존성 트리를 구성해야 한다.
   - 단, `*.d.ts` 및 `node_modules/@types/**`는 타입 정의로 간주하고 AOT 분석 대상에서 제외할 수 있다(트리에는 “존재”만 기록 가능).

2. **해석(Resolution)은 Bun 기준이며, 임포터 기준으로 결정적이어야 한다**
   - 상대 경로(`./`, `../`)는 `dirname(importer)` 기준으로 절대 경로로 정규화한다.
   - 패키지 경로는 반드시 `Bun.resolveSync(specifier, dirname(importer))`로 해석한다.
   - 확장자/인덱스 규칙을 강제한다: `path`, `path.ts`, `path.tsx`, `path/index.ts` 순으로 확인한다.
   - 빌트인/런타임 외부 모듈(예: `node:*`, `bun:*`)은 “외부 의존성”으로만 기록하고 소스 파싱을 시도하지 않는다.

3. **파서는 Import/Re-export를 손실 없이 수집해야 한다 (CLI 기준)**
   - `import` / `export * from` / `export { X } from` 를 모두 수집한다.
   - `import type` 및 `import { type X }`는 런타임 의존성이 아니므로 기본적으로 제외한다.
   - 단, “타입 전용처럼 보여도” 런타임 코드 생성에 필요하다면(예: DTO 스키마 생성), 그 근거와 처리 방식을 코드/테스트로 증명해야 한다.

4. **의존성 트리는 “모듈 그래프”로 승격되어야 한다 (ModuleGraph 기준)**
   - 파일 단위가 아니라 “클래스/모듈 단위”로 연결 관계를 만든다.
   - `@Module`/`@RootModule`의 `imports/providers/controllers/exports`는 AST에서 추출되어 그래프 노드에 반영되어야 한다.
   - `export` 및 `re-export`는 import 연결 해석의 필수 입력이다. `export *`와 alias re-export까지 추적해야 한다.

5. **동적 의존성은 금지에 가깝게 다룬다**
   - 정적 분석이 불가능한 형태(임의의 `require`, 계산된 specifier, 난독화된 import)는 허용하지 않는다.
   - 불가피한 경우, CLI가 “동적 import”로 분류하고 런타임/빌드가 안전하게 다룰 수 있다는 것을 테스트로 증명하기 전까지 merge 금지다.

6. **순환 의존성은 ‘경고’가 아니라 ‘설계 결함’이다**
   - 그래프는 순환을 탐지해야 하며, 발견 즉시 실패 처리(또는 사용자에게 강제 수정 가이드)를 제공해야 한다.
   - 순환을 “운 좋게 런타임에서 돌아간다”는 이유로 방치하는 행위를 금지한다.

7. **결정성/재현성은 필수다**
   - 동일 입력(코드/락파일/설정) → 동일 그래프/동일 산출물 이어야 한다.
   - 경로는 반드시 정규화(절대 경로 + 일관된 확장자 처리)하여 키로 사용한다.
   - 실패는 조용히 삼키지 마라. 해석 불가/파싱 실패는 AOT 품질 결함이며, 최소한 “어떤 specifier를 어디서 해석하다 실패했는지”를 남겨야 한다.

8. **CORE 런타임 계약(Contract)을 침범하지 마라**
   - CORE의 `MetadataConsumer`/`BunnerScanner`는 레지스트리만 소비한다.
   - 런타임에 파일 시스템을 뒤져 메타데이터를 복구하려는 시도(폴백 스캔/리플렉션)는 AOT 가치 훼손으로 간주하고 금지한다.

---

## 4. 아키텍처 하이라이트 (High-Level Architecture)

이 프로젝트는 **Bun Workspaces** 기반의 **모노레포(Monorepo)** 구조를 **강제**한다.
코드는 `packages/` 하위의 배포 단위 패키지로만 구성하며, 관심사 분리(SoC)와 재사용성은 “규칙 준수”로 달성한다.

- 모노레포 도구: `bun` (workspaces)
- 패키지 관리: `packages/*` 하위의 각 디렉토리는 독립적인 npm 패키지로 관리 및 배포된다.

### 4.1 아키텍처 세부 원칙 (Architectural Rules)

1. **단방향 의존성 (Dependency Direction)**
   - 상위 계층(예: `http-server`)은 하위 계층(예: `core`)을 의존할 수 있다.
   - 반대 방향의 의존은 **절대 불가**다. (하위 계층은 상위 계층을 알면 안 된다)
   - 순환 참조(Circular Dependency)는 “허용 가능한 트릭”이 아니라 **설계 결함**이다. 발견 즉시 수정이 원칙이다.

2. **Public API 캡슐화 (Encapsulation via Exports)**
   - 물리적인 `internal` 디렉토리를 사용하지 않고, Barrel 파일(`index.ts`)을 통한 논리적 캡슐화를 수행한다.
   - `index.ts`는 "무엇을 노출할 것인가"를 결정하는 **유일한 관문**이다.
   - 외부에 필요한 API만 **명시적 이름**으로 export 하고, 내부 구현이 우연히 노출되는 구조(`export *` 남발)는 금지한다.

3. **에러 핸들링 표준 (Error Handling)**
   - 프레임워크/인프라 계층에서 던지는 에러는 반드시 프레임워크 표준 에러(`BunnerError`)를 상속해야 한다.
   - “제어 흐름”을 만들기 위해 `throw`를 남용하지 마라. 가능하면 명시적 결과/에러 반환 패턴을 우선 고려하되, API 일관성을 깨지 않는 방식으로만 사용한다.

### 4.2 패키지 내부 아키텍처 패턴 (MANDATORY)

이 프로젝트의 `packages/*` 내부 코드는 반드시 다음 패턴을 따른다.

**Package-by-Feature(Vertical Slice) + Facade(공개 API 관문)**

이 규칙은 “권장”이 아니다. 예외는 없다.

1. **패키지 = 배포/의존의 단위**
   - 다른 패키지는 오직 대상 패키지의 루트 `index.ts`(Public Facade)에만 의존한다.
   - 다른 패키지의 `src/**` 내부 파일로 직접 import 하는 행위는 금지한다.

2. **기능 디렉토리 = 개발/테스트/리팩토링의 단위(Vertical Slice)**
   - `src/<feature>/`는 하나의 기능 모듈이다.
   - 폴더 이름이 기능을 “소리치듯” 드러내야 한다(Screaming Architecture).
   - 기능 모듈은 스스로 완결적이어야 하며, 외부(다른 기능)에서 구현 상세를 알 필요가 없어야 한다.

3. **Facade(관문) 규칙**
   - 패키지 루트 `index.ts`: 외부에 필요한 API만 **명시적으로** export 한다. `export *`로 외부 노출은 **원칙적으로 금지**다.
     - 단, 레거시 패키지에 `export *`가 이미 존재할 수 있다. 이 경우 “현상 유지”를 이유로 신규 `export *`를 추가하지 마라.
     - 해당 패키지의 공개 API(루트 `index.ts`)를 수정하는 작업을 수행한다면, 그 작업 범위 내에서 `export *`를 **명시 export**로 전환하여 규칙을 이행한다.
   - 기능 폴더 `src/<feature>/index.ts`: 기능 내부 결합을 위해 `export *` 허용(단, 순환 참조 발생 시 즉시 명시 export로 전환).
   - `src/index.ts`: 내부 기능 모듈들을 묶는 Internal Facade로 사용한다.

---

## 5. 디렉토리 구조 (Directory Structure)

### 5.1 루트 디렉토리 (Root Directory)

```text
/
├── packages/           # 핵심 프레임워크 패키지
├── examples/           # 사용 예시 애플리케이션
├── package.json        # 워크스페이스 Root 설정
├── bun.lock            # Lockfile
├── tsconfig.json       # Base TypeScript 설정
└── .husky/             # Git Hooks
```

### 5.2 상세 패키지 구조 (Detailed Package Structure)

모든 패키지는 아래 구조를 **표준 레이아웃(Standard Layout)**으로 따른다. 예외는 없다.

```text
packages/[package-name]/
├── index.ts                    # [Public Facade] 외부에 노출할 API만 명시 export
├── package.json
├── tsconfig.json
├── README.md
└── src/
   ├── index.ts                # [Internal Facade] src 내부 기능 모듈 정리
   ├── common/                 # Cross-Domain 공유만 허용
   │   ├── constants.ts
   │   ├── enums.ts
   │   ├── interfaces.ts
   │   ├── types.ts
   │   └── index.ts
   └── <feature>/              # 기능 모듈(Vertical Slice)
      ├── constants.ts
      ├── enums.ts
      ├── interfaces.ts
      ├── types.ts
      ├── errors/             # 기능 전용 에러(필요 시)
      │   └── *.error.ts
      ├── *.ts                # 구현 파일(단일 책임)
      ├── *.spec.ts           # 테스트(권장: 기능 옆에 co-locate)
      └── index.ts            # [Feature Barrel]
```

주의(집행 방식): 현재 저장소의 레거시 패키지들이 이 템플릿을 100% 충족하지 않을 수 있다.

- 새 패키지를 만들 때는 예외 없이 이 구조를 **그대로** 따른다.
- 기존 패키지를 수정하는 작업을 수행한다면, 작업 범위 안에서 누락된 항목(예: `README.md`, `tsconfig.json`, 표준 스크립트)을 **함께 이행**한다.

테스트 구조는 둘 중 하나만 선택할 수 있다.

1. `src/<feature>/*.spec.ts`로 기능 옆에 둔다(기본 권장).
2. `tests/**`로 분리한다.

어느 쪽이든 Fixture는 `tests/fixtures` 단일 위치로 중앙화한다.

### 5.3 디렉토리 및 파일 관리 규칙

1. 소스 위치: 모든 기능 코드는 반드시 `src/` 내부에 위치한다. `src/` 밖에 기능 코드가 생기면 규칙 위반이다.
2. 메타 파일 분리(강제):
   - `constants.ts`, `enums.ts`, `interfaces.ts`, `types.ts` 등 성격이 다른 선언부는 별도 파일로 분리하여 관리한다. (1파일 1목적 원칙)
3. 공유 자원 관리:
   - Cross-Domain: 여러 도메인(기능)에서 공유되는 자원만 `src/common`에 둔다.
   - Sub-Module Sharing: 하위 모듈 간 공유 자원은 별도 `common` 폴더 없이 해당 모듈 내(상위 디렉토리)에 위치시킨다.
4. 테스트 자산: 테스트에 필요한 Fixture나 Mock 데이터는 `tests/fixtures` 단일 위치에서 중앙 관리한다. 임의 폴더로 분산시키지 마라.

5. 기능 모듈 규격(강제, 예외 없음):
   - 새 기능을 만들면 반드시 `src/<feature>/index.ts`를 만든다.
   - 기능 간 참조는 원칙적으로 “기능의 `index.ts`를 통한 import”만 허용한다.
   - 기능 폴더 밖에서 기능의 구현 상세 파일을 직접 import 하는 행위는 금지한다.

6. 파일 목적 분리(강제):
   - 한 파일에 타입/상수/구현을 무질서하게 섞지 마라.
   - 타입은 `types.ts`, 인터페이스는 `interfaces.ts`, 상수는 `constants.ts`, 열거는 `enums.ts`로 분리한다.
   - 구현 파일은 “한 가지 책임”만 가져야 한다.

---

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

---

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

---

## 8. 타입 정의 및 안전성 원칙

1. 타입 정의 우선순위: TypeScript 자체 문법을 최우선으로 사용한다. 복잡한 유틸리티 타입은 “필요할 때만” 허용한다.
2. Loose Type 사용 지양:
   - `any`: 기본 금지다. 외부 라이브러리 호환/동적 컨텍스트 등으로 불가피할 때만 **근거를 남기고** 최소 범위에서 사용한다.
   - `unknown`: 가능한 구체적인 타입을 사용하거나 Type Guard와 함께 사용한다.
   - `Record<string, any>`: 지양. 구체적인 인터페이스나 인덱스 시그니처 사용.
3. 명시적 반환 타입(강제): export 되는 모든 Public 함수/메서드는 반환 타입을 반드시 명시해야 한다.

---

## 9. 구현 우선순위 (Implementation Priority)

1. 1순위: Bun Native 기능
2. 2순위: Node.js Native 기능 (Bun 호환)
3. 3순위: 검증된 npm 패키지
4. 4순위: 직접 구현 (Custom)

---

## 10. 코딩 품질 및 스타일 (Code Quality & Style)

1. 중복 코드 제거: 중복은 허용하지 않는다. 재사용이 필요하면 즉시 함수/모듈로 끌어올려 단일화한다.
2. 단일 책임 파일: 한 파일에 Type/Class/Interface를 뒤섞는 것을 금지한다. (1파일 1목적)
3. 불변성(Immutability): 인자로 받은 객체/배열은 변형하지 않는다. 가능하면 `readonly`를 사용해 의도를 고정한다.
4. 비동기 안전성(Async Safety): Floating Promise(`await` 누락)는 금지다. 병렬 처리는 의도적으로 `Promise.all`을 사용한다.
5. 문서화(TSDoc): Public API는 예외 없이 TSDoc(`@param`, `@returns`)을 작성한다.

6. 주석(Comments): Public API TSDoc을 제외한 모든 코멘트/주석은 **금지**다.
   - 금지 예: `// TODO`, `// FIXME`, 설명용 인라인 주석, 임시 디버그 주석, “왜 이렇게 했는지” 메모.
   - 허용 예: Public API TSDoc(외부 사용자에게 계약을 설명하는 목적)만.

7. 파일 분해(Granularity): “작게 쪼개는 것” 자체는 품질이 아니다. 파일 분해는 16 섹션의 기준을 **반드시** 만족해야 한다.

8. Deprecated 금지: deprecated된 코드/파일을 **절대 남기지 마라**.
   - `@deprecated`/`deprecated` 표기, deprecated 전용 파일/폴더, 사용되지 않는 구 API를 “호환용”으로 방치하는 행위를 금지한다.
   - 변경 과정에서 deprecated가 발생했다면, 그 작업 범위 내에서 **완전 제거**까지 끝내야 한다(혹은 사용자에게 명시적 승인 요청).

9. 코드 스타일(공백/블록) 규칙: 이 규칙은 “취향”이 아니다. 예외는 없다.
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

---

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

---

## 12. 패키지 스크립트 표준 (Scripts)

`package.json` 표준 스크립트(강제):

- 모든 패키지는 최소한 `test`, `lint`, `tsc`(또는 동등한 typecheck 스크립트) 를 제공해야 한다.
- 단, 레거시 패키지에 스크립트가 누락되어 있을 수 있다. 이 경우 “현상 유지”를 이유로 방치하지 마라.
  - 해당 패키지의 `package.json`을 수정하는 작업을 수행한다면, 반드시 표준 스크립트를 **함께 추가**하여 규칙을 이행한다.
- 프로젝트 성격에 따라 `build`는 달라질 수 있으나, 타입체크 스크립트는 절대 생략하지 마라.

```json
{
  "scripts": {
    "test": "bun test",
    "lint": "eslint . --fix",
    "tsc": "tsc --noEmit"
  }
}
```

---

## 13. Exports (Barrel 패턴) 및 패키지 캡슐화 가이드

Exports 규칙의 SSOT는 4.2의 **Facade(관문) 규칙**이다. 이 섹션은 예시만 제공한다.

예시:

```ts
// src/application/index.ts (내부 모듈용) - 간결함 허용
export * from './application';
export * from './interfaces';

// packages/core/index.ts (Public API 진입점) - 엄격한 제어
export { BunnerApplication } from './src/application';
export type { AppOptions } from './src/application/interfaces';
```

---

## 14. Enforcer Protocols (강제 집행 규정)

### 14.1 Comprehensive Verification Protocol (검증 프로토콜)

사용자가 "전부 다시 확인", "전체 코드베이스 전수 조사" 등 완전한 검증을 요구할 때 즉시 발동한다. 이 프로토콜이 켜지면, 속도/편의보다 완결성이 우선이다.

1. 추측 및 휴리스틱 가동 중단 (Disable Heuristics)
   - 에이전트는 자신의 기억이나 "방금 확인했다"는 주관적 판단을 완전히 배제한다.
   - 특정 파일이 정상일 것이라는 그 어떤 사전 가정도 허용하지 않는다. 모든 데이터는 '오염됨' 혹은 '확인 안 됨' 상태로 리셋한다.

2. 대상 파일의 명시적 목록화 (Mandatory Listing)
   - 조사를 시작하기 전, 반드시 시스템 명령(`find`, `ls -R`, `fd` 등)을 사용하여 대상 범위에 있는 모든 파일 목록을 가시적으로 출력한다.
   - 목록화 단계에서 단 하나의 파일이라도 누락될 경우, 해당 프로토콜은 즉시 실패한 것으로 간주한다.

3. 반복적 전수 검사 (Iterative Check)
   - 생성된 파일 목록을 한 줄씩 따라가며 순차적으로 접근하거나, 전체 파일을 대상으로 하는 포괄적 `grep` 명령을 실행한다.
   - 각 파일 내부의 논리를 물리적으로 재검증하여, 해당 오류가 없음을 개별적으로 증명해야 한다.

4. 효율성보다 완결성 우선 (Zero Shortcuts)
   - 속도나 효율성은 고려 대상이 아니다. 작업 시간이 길어지더라도 모든 경로를 직접 확인하는 '완결성'만이 유일한 평가지표다.
   - "생략(Omission)"은 시스템의 치명적 오류(Critical Failure)이며, 에이전트의 직무 유기로 규정한다.

### 14.2 Zero Tolerance & Anti-Assumption Protocol (무관용 및 가정 금지)

1. 판단 금지 (No Discretionaries)
   - 에이전트는 아키텍처와 룰에 대해 그 어떤 "판단"이나 "타협"도 할 권한이 없다.
   - "이게 더 깔끔하다", "이건 내부 파일이니까 괜찮다", "일단 이렇게 하고 나중에 수정하자"와 같은 모든 주관적 사고를 금지한다.
   - 룰에 "A는 B다"라고 적혀있으면, 상황이 아무리 비효율적이어도 무조건 B로 이행해야 한다. 우회하고 싶다면 반드시 사용자의 명시적 승인을 먼저 받아야 한다.

2. 선(先) 검증, 후(後) 실행 (Verify First, Execute Later)
   - 파일을 생성하거나 수정하기 전, 해당 작업이 이 문서(`.github/copilot-instructions.md`)의 어떤 규칙에 해당하는지 반드시 먼저 확인해야 한다.
   - 특히 `index.ts` (Barrel Pattern), 파일 명명 규칙, 디렉토리 구조 변경 시에는 관련 규칙을 찾아내어 "이 규칙에 따라 작업을 수행함"을 명시해야 한다.
   - 룰을 인용하지 않은 작업은 "무효"로 간주한다.

3. 모듈 경계의 물리적 확인 (Mandatory Boundary Check)
   - `import` 경로를 작성할 때, `../` 가 2번 이상 나오거나 상위 디렉토리를 가로질러야 한다면 즉시 작업을 멈추고 질문해라.
   - "이 경로가 모듈의 경계를 침범하는가?"
   - "해당 디렉토리에 index.ts가 존재하는가?"
   - 위 질문에 대해 스스로 검증하지 않은 `import` 구문 작성은 금지된다.

4. 묵시적 결정 금지 (Ban Implicit Decisions)
   - 사용자가 구체적으로 지시하지 않은 부분(변수명, 위치, 패턴 등)에 대해 "알아서" 결정하지 마라.
   - 모호한 경우 멈추고 사용자에게 옵션을 제시하여 선택을 받아라.
   - 에이전트의 "추측"은 언제나 틀린 것으로 간주한다.

집행 상태: 이 프로토콜은 상시 가동된다.

---

## 15. 유닛 테스트 표준 (Unit Testing Standard)

이 섹션은 “권장사항”이 아니다. 위반은 즉시 수정 대상이며, 테스트가 느슨하면 그것은 곧 품질 결함이다.

1. **BDD 스타일 네이밍을 강제한다**
   - `describe`: 테스트 대상 **함수 1개당 describe 1개**만 허용한다. (하나의 describe에 여러 함수를 섞는 행위 금지)
   - `it`: 반드시 **영어 BDD 문장**으로 작성한다.
     - 기본 패턴: `it('should ...', () => { ... })`
     - 예외/실패 케이스: `it('should throw when ...', () => { ... })` 또는 `it('should return null when ...', () => { ... })`

2. **유닛 테스트는 “대상 함수 스코프”만 검증한다**
   - 테스트는 대상 함수의 입력/출력/에러/부작용(명시된 것만)을 검증한다.
   - 대상 함수 내부에서 다른 모듈로 전파되는 호출이 테스트 결과에 영향을 주면 안 된다.
   - 외부 호출(네트워크, 파일시스템, 타이머, 랜덤, 글로벌 상태, 컨테이너/DI, DB 등)을 유닛 테스트에 섞는 행위는 금지다.

3. **스파이/목킹은 선택이 아니라 의무다**
   - 대상 함수가 다른 함수/모듈을 호출한다면, 그 호출은 반드시 스파잉/목킹으로 격리해야 한다.
   - 유닛 테스트가 “우연히 통과/실패”하지 않도록, 외부로 나가는 모든 경로를 통제하라.

4. **1개의 `it`는 1개의 케이스만 검증한다**
   - 한 `it`에 여러 행동/분기/규칙을 동시에 검증하지 마라.
   - 케이스가 늘어나면 `it`를 분리하고, 어떤 규칙이 깨졌는지 실패 메시지로 즉시 드러나게 하라.

5. **엣지 케이스는 광범위하고 엄격해야 한다**
   - Happy path만 쓰고 끝내는 행위 금지.
   - Failure/edge 케이스를 의무적으로 작성하라: 빈 값, 경계값, 누락, 잘못된 타입/형태, 매우 큰 입력, 중복, 순서 변경, 예상치 못한 유니코드/특수문자, `null/undefined` 등 가능한 모든 실패 모드를 명시적으로 검증한다.

6. **테스트는 결정적(Deterministic)이어야 한다**
   - 같은 코드/같은 입력이면 항상 같은 결과가 나와야 한다.
   - 시계/랜덤/타이머 등 비결정 요소는 반드시 고정하거나 대체(mock)해야 한다.

7. **테스트는 명확한 실패 원인을 제공해야 한다**
   - 실패했을 때 “어떤 규칙이 깨졌는지” 바로 알 수 있도록, 케이스를 쪼개고 이름을 규격화하라.

8. **Bun 테스트 러너 사용을 전제로 한다**
   - 표준 실행은 `bun test`다. 다른 러너/헬퍼를 편의상 추가하지 마라(필요하면 사용자 승인 필요).

---

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

---

## 17. 커밋 규칙 (Commit Rules)

이 섹션은 “권장사항”이 아니다. 커밋은 리뷰 가능한 단위로만 만든다.

1. **커밋 메시지는 Conventional Commits(Git Convention)를 강제한다**
   - 형식: `type(scope): subject`
   - `type` 예: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
   - `scope`는 가능하면 패키지/기능을 명시한다(예: `scalar`, `cli`, `core`).

2. **커밋 메시지는 영어로만 작성한다**
   - 제목(subject)과 본문(body) 모두 영어로 작성한다.
   - 금지: “fix”, “update”, “wip”, “temp” 같은 의미 없는 메시지.

3. **본문(body) 상세화를 의무로 한다**
   - 왜(Why): 왜 변경이 필요한지.
   - 무엇을(What): 무엇이 바뀌었는지(핵심 항목 위주).
   - 어떻게(How): 핵심 구현 전략/제약(예: AOT/AST/Facade 계약 준수).
   - 영향(Impact): 영향 범위, 마이그레이션/호환성, 리스크.

4. **커밋 전 변경 내용을 반드시 확인한다**
   - 커밋 메시지를 쓰기 전에 `git status`로 변경 파일을 확인한다.
   - `git diff`(또는 staged diff)로 실제 변경 내용을 확인한 뒤, 그 내용을 커밋 본문에 반영한다.
   - 확인 없이 “추측”으로 메시지를 작성하는 행위는 금지다.

5. **커밋 단위는 논리적 변경 1개를 기본으로 한다**
   - 서로 다른 관심사(예: 리팩토링 + 기능 추가 + 포맷팅)를 한 커밋에 섞지 마라.
   - 불가피하게 섞이면, 커밋을 분리하거나 사용자 승인 없이는 진행하지 마라.

---

## 18. Architecture Gardening (Mandatory)

아키텍처 가드닝은 “보기 좋게 정리”가 아니라, 경계/결정성/단방향 의존을 **지속적으로 강제**하는 활동이다.

1. 모든 변경은 아키텍처 불변식을 유지/개선해야 한다: 단방향 의존, 패키지 경계, AOT 결정성.
2. 트리거 없는 정리는 금지한다. 가드닝은 반드시 구체 결함(순환, 경계 침범, 비결정성, 빌드/테스트 붕괴)과 연결되어야 한다.
3. 경계 침식(Boundary Erosion)을 허용하지 않는다.
   - cross-package deep import(다른 패키지의 `src/**` 직접 import)는 즉시 거부한다.
   - 공유가 필요하면 `src/index.ts`(internal facade) 또는 진짜 cross-domain만 `src/common`으로 올린다.
4. 순환 의존은 “나중에” 고칠 수 있는 항목이 아니라 즉시 수정 대상이다.
5. AOT/CLI 산출물은 입력이 같으면 결과가 같아야 한다.
   - 파일 시스템 순회 순서, 비결정적 Map/Set 순서 등에 의존하지 않도록 강제한다.

---

## 19. Monorepo Integrity (Mandatory)

1. 배포/의존의 단위는 오직 `packages/*`의 패키지다.
2. 외부 소비자는 패키지 루트 `index.ts`만을 통해 접근해야 한다.
   - 다른 패키지의 `packages/<name>/src/**`를 직접 import 하는 행위는 금지한다.
3. 숨은 결합을 금지한다.
   - 워크스페이스 루트에 “우연히 호이스팅된 의존성”에 기대지 말고, 각 패키지의 `package.json`에 실제 의존성을 선언한다.
4. 워크스페이스 경로 규율을 강제한다.
   - 패키지 루트 밖으로 탈출하는 상대경로 import를 지양/금지한다.
   - 패키지 간 참조는 반드시 패키지 이름 import + 대상 패키지의 public facade export로 해결한다.
5. 생성물(Generated output)은 격리한다.
   - `.bunner/**`, `dist/**` 같은 산출물이 린트/타입체크/스캔에 섞이지 않도록 설정한다.
   - 명시적 요구 없이는 생성물을 커밋하지 않는다.

---

## 20. Enforcement & Reviewer Contract (Jules/Copilot)

1. 룰 SSOT는 이 파일이다.
   - Jules/Copilot/CI 설정은 이 파일을 참조해야 한다.
   - 같은 규칙을 여러 파일에 중복 기재하는 행위는 금지한다.
2. 조용한 룰 완화는 금지한다.
   - “툴링이 불편해서” 룰을 낮추지 말고, 원인을 고치거나 사용자 승인을 받는다.
3. 근거는 섹션 번호로 제시한다.
   - 변경 제안/리뷰/거부 시 반드시 해당 섹션 번호를 근거로 든다.
4. 최소 변경 원칙.
   - 룰과 요구사항을 만족하는 최소 diff를 우선한다.
5. Fail Fast.
   - AOT 결정성 위반, 순환 의존 도입, 패키지 경계 침범은 즉시 실패 처리한다.
