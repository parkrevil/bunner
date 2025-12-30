# ARCHITECTURE

## 역할

- **이 문서는 시스템 구조/의존 방향/패키지 경계/Facade 규칙을 정의한다.**

---

## 목적

- 시스템 구조/의존 방향/패키지 경계/Facade 규칙을 SSOT 하위 문서로 고정한다.
- 모노레포 무결성 및 AOT 결정성에 영향을 주는 구조적 규칙을 명시한다.

## 적용 범위

- `packages/*` 전 패키지 및 `examples/*`를 포함한 레포 전체

## 정본/우선순위

- 최상위 정본은 [SPEC.md](SPEC.md)다.
- 이 문서의 규칙은 구현 세부보다 우선한다.

## 문서 지도 (역할 분리)

- 구조/파일 배치(Placement): [STRUCTURE.md](STRUCTURE.md)
- 의존성 선언(`package.json`): [DEPENDENCIES.md](DEPENDENCIES.md)
- 툴링/CLI 운영 정책: [TOOLING.md](TOOLING.md)

## 규범 용어 (Normative Keywords)

이 문서는 “사람/에이전트/CI”가 같은 판정을 내릴 수 있도록, 규칙 강도를 다음 키워드로 정규화한다.

- MUST: 위반 시 변경은 거부되어야 한다.
- MUST NOT: 절대 금지이며, 위반 시 변경은 거부되어야 한다.
- SHOULD: 강력 권장이며, 예외가 필요하면 근거와 영향 범위를 함께 제시해야 한다.
- MAY: 선택 사항이다.

이 문서에서 “예시”, “현재 구현”, “참고”로 표시된 내용은 **비규범(Non-normative)** 이며, 아키텍처 불변식이 아니다.

## 4. 아키텍처 하이라이트 (High-Level Architecture)

이 프로젝트는 **Bun Workspaces** 기반의 **모노레포(Monorepo)** 구조를 **강제**한다.
코드는 `packages/` 하위의 배포 단위 패키지로만 구성하며, 관심사 분리(SoC)와 재사용성은 “규칙 준수”로 달성한다.

- 모노레포 도구: `bun` (workspaces)
- 패키지 관리: `packages/*` 하위의 각 디렉토리는 독립적인 npm 패키지로 관리 및 배포된다.

## 패키지 레이어 및 책임 (SSOT)

이 레포의 패키지들은 “런타임 프레임워크”, “툴링(CLI/AOT)”, “예제 애플리케이션”으로 구분된다.

### 패키지 분류

- 런타임 프레임워크(Framework Runtime)
  - `@bunner/common`: 공용 타입/유틸/데코레이터 등 기반 구성요소
  - `@bunner/logger`: 로깅 기반 구성요소
  - `@bunner/core`: 프레임워크 코어 런타임
  - `@bunner/http-adapter`: HTTP 어댑터(런타임)
  - `@bunner/scalar`: Scalar 연동(런타임)
- 툴링(Tooling)
  - `@bunner/cli`: AOT/분석/빌드 등 CLI 도구
- 예제(Examples)
  - `examples/*`: 프레임워크 사용 예시(애플리케이션)

### 핵심 개념(용어) 정의 (코드베이스 기준, 패키지/의존 판정용)

이 섹션은 “현재 코드베이스에 실제로 구현/노출된 개념”을 기준으로 용어를 고정하되,
그 개념이 **프레임워크 레벨 핵심 개념**인지, 아니면 **어댑터(전송 계층) 단위 개념**인지까지 함께 구분한다.
목표는 (1) 패키지 책임을 직관적으로 이해하고, (2) `dependencies`/`peerDependencies`/`devDependencies`를 판정 가능한 규칙으로 만드는 것이다.

핵심 전제(AOT/메타데이터 계약):

- Metadata Registry (`globalThis.__BUNNER_METADATA_REGISTRY__`)
  - 개념(규범): CLI(AOT)가 생성한 메타데이터를 런타임이 소비하는 “논리적 레지스트리”다.
  - 규칙(규범): 런타임은 CLI가 생성한 레지스트리를 소비해야 한다(MUST).
  - 규칙(규범): 런타임이 메타데이터를 생성하거나 수정하는 흐름을 도입해서는 안 된다(MUST NOT).
  - 구현 전략(비규범): 전역 객체(`globalThis`) 기반 구현은 현재 선택지 중 하나이며, 아키텍처 요구사항이 아니다.

프레임워크 레벨 핵심 개념:

- Core(Runtime)
  - 의미: 애플리케이션 실행과 런타임 수명주기(시작/종료/워커 관리)를 책임지는 프레임워크 런타임.
  - 패키지 매핑: `@bunner/core`
  - 대표 Public API: `Bunner`, `BunnerApplication`, `Container`, cluster 관련 API, validator/transformer compiler

- Module System (모듈 시스템)
  - 의미: 애플리케이션을 모듈 단위로 구성하고, import/provider/controller를 선언적으로 묶는 구조.
  - 구성요소(규범):
    - 선언 채널(데코레이터/계약)은 `@bunner/common`이 소유한다.
  - 모듈 그래프(ModuleGraph) 생성/해석(AOT)은 `@bunner/cli`가 소유한다(MUST).
  - 런타임 조립(assembly)은 `@bunner/core`가 소유한다(MUST).
  - CLI는 분석/산출물 생성 역할만 수행하며, 런타임을 대체하지 않는다.
  - CLI의 AOT/AST 계약(정적 수집/해석/결정성)은 [SPEC.md](SPEC.md)가 SSOT다.
  - CLI 설치/운영 정책 및 CLI 산출물(Registry/Plan)은 [TOOLING.md](TOOLING.md)가 SSOT다.

- DI(Dependency Injection)
  - 의미: 토큰 기반으로 의존성을 등록/해결하는 런타임 구성.
  - 구성요소(규범):
    - 계약(토큰/데코레이터 채널)은 `@bunner/common`이 소유한다.
    - 의존성 해석 및 실행 런타임은 `@bunner/core`가 소유한다.

- Application Lifecycle Hooks (애플리케이션 라이프사이클 훅)
  - 의미: 애플리케이션 라이프사이클(초기화/시작/종료 등) 특정 시점에 실행되는 계약.
  - 규범(순서/의미): 아래 훅 순서는 런타임이 권장하는 기준이며, 동일 훅을 구현한 구성요소는 선언 순서와 무관하게 동일 단계로 분류되어 호출된다.
    - `onInit`: 런타임 조립(컨테이너 구성) 이후, 서버/워커 시작 전 초기화 단계
    - `beforeStart`: 시작 직전 준비 단계(라우팅/파이프/미들웨어 등 실행 준비 포함)
    - `onStart`: 어댑터가 실제로 시작된 직후(요청 수신 가능 상태)
    - `onShutdown`: 종료 신호/요청 수신 후 graceful shutdown 진입 단계
    - `onDestroy`: 최종 정리 단계(항상 마지막)
  - 패키지 매핑:
    - 계약: `@bunner/common`의 lifecycle interface들
    - 런타임 호출: `@bunner/core`

- Context
  - 의미: 런타임/어댑터가 요청 단위 또는 실행 단위의 컨텍스트를 전달하는 계약.
  - 패키지 매핑:
    - 계약: `@bunner/common`의 `Context`
  - HTTP 구현: `@bunner/http-adapter`의 `BunnerHttpContext`

- Adapter(Runtime Adapter)
  - 의미: 코어 런타임에 종속되어 특정 전송 계층/환경(예: HTTP)을 연결하는 런타임 구성요소.
  - 계약/구현:
    - 계약: `@bunner/common`의 `BunnerAdapter`
    - 구현: `@bunner/http-adapter`의 `BunnerHttpAdapter`, `BunnerHttpServer`, `BunnerHttpWorker`
  - 의존 판정(규범):
    - 어댑터는 코어 런타임을 “제공/소유”해서는 안 된다(MUST NOT).
    - 어댑터는 코어를 `peerDependencies`로 선언해야 한다(MUST).

- Middleware
  - 의미: 런타임 파이프라인 중간에 삽입되는 훅(전/후 처리) 구성요소.
  - 계약/데코레이터 채널:
    - 계약: `@bunner/common`의 `BunnerMiddleware`, `MiddlewareToken`, `MiddlewareRegistration`
    - 데코레이터: `@bunner/common`의 `Middleware`, `UseMiddlewares`
  - 의존 판정:
    - 미들웨어 “계약(Contract)”은 `@bunner/common`에 둔다.
    - 미들웨어 “실행 시점/순서/스코프(라이프사이클)”는 어댑터 단위로 정의/관리한다.

- Error Filter
  - 의미: 에러를 “잡고(catch)” 처리하거나 다음 에러로 변환하는 구성요소.
  - 계약/데코레이터 채널:
    - 계약: `@bunner/common`의 `BunnerErrorFilter`, `ErrorFilterToken`
    - 데코레이터: `@bunner/common`의 `Catch`, `UseErrorFilters`
  - 에러 타입(대표):
    - 프레임워크 공통: `@bunner/common`의 `BunnerError`
    - HTTP: `@bunner/http-adapter`의 `HttpError` 및 상태 코드 기반 에러들

- Pipe (입력 변환/검증 파이프)
  - 의미: handler 호출 전에 입력을 변환/검증하는 “프레임워크 레벨” 처리 단계.
  - 목적(상시 제공): NestJS의 `class-transformer`/`class-validator`처럼, 프로젝트가 별도 조립을 하지 않아도 프레임워크가 기본 제공하는 변환/검증 역량으로 취급한다.
  - 배치/소유권(패키지 판정):
    - 계약(Contract): `@bunner/common`
    - 런타임 실행/기본 제공 구현(Runtime): `@bunner/core`
    - 어댑터(예: HTTP): 입력 바인딩/컨텍스트 제공 및 파이프 실행 결과를 핸들러 호출로 연결하는 책임만 가진다. (파이프 계약/핵심 구현을 소유하지 않는다)
  - 설계 원칙:
    - Pipe는 HTTP에 종속되지 않으며, 어떤 어댑터에서도 동일한 개념으로 재사용 가능해야 한다.
    - 어댑터는 “입력 바인딩/컨텍스트 제공”을 담당하고, Pipe 자체의 개념/계약은 프레임워크 레벨로 유지한다.
  - validator/transformer 연동:
    - `@bunner/core`의 `ValidatorCompiler`, `TransformerCompiler` 및 데코레이터(`IsString/IsNumber/...`, `Transform`, `Hidden`) 기반으로 변환/검증을 수행한다.
    - class-transformer 류의 변환 기능도 동일하게 프레임워크 레벨 기능으로 취급한다.

어댑터 단위 개념 (Framework Core MUST NOT 소유):

- Routing (HTTP 라우팅)
  - 의미: HTTP 전용 데코레이터를 기반으로 라우트를 등록하고 요청을 핸들러로 연결하는 HTTP 런타임 계층.
  - 패키지 매핑: `@bunner/http-adapter`
  - 구성요소(대표):
    - 데코레이터: `RestController`, HTTP method decorators(`Get/Post/...`), param decorators(`Body/Param/Query/...`)
    - 등록/매칭: `RouteHandler`, `Router`, `HandlerRegistry`, router builder/matcher/cache 및 processor pipeline
    - 실행: `RequestHandler`(middleware → routing → handler → error filter 흐름)

- Middleware Lifecycle (어댑터별 미들웨어 라이프사이클)
  - 의미: 미들웨어가 “언제/어떤 순서로/어떤 스코프에서” 실행되는지에 대한 어댑터 단위의 실행 모델.
  - 원칙:
    - 라이프사이클은 어댑터마다 다를 수 있으며, 어댑터 단위로 독립적으로 정의/관리한다.
    - 공용(`@bunner/common`)은 계약을 제공하되, 어댑터별 라이프사이클을 강제/중앙화하지 않는다.
  - 예(HTTP): `@bunner/http-adapter`의 `HttpLifecycle`

- System Error Handler
  - 의미: 에러 필터 처리 이후에도 상태/응답이 정리되지 않는 경우를 위한 “최후의 시스템 레벨 처리” 계약.
  - 패키지 매핑(규범):
    - 계약(Contract): `@bunner/common`
    - HTTP 구현(Runtime): `@bunner/http-adapter`

- Worker / Cluster
  - 의미: 멀티 워커 프로세스(클러스터) 기반 실행을 위한 런타임 구성.
  - 패키지 매핑:
    - 코어: `@bunner/core`의 `ClusterManager`, `ClusterBaseWorker`, `expose`, cluster types
    - HTTP: `@bunner/http-adapter`의 `BunnerHttpWorker`

- Plugin(Third-party Integration)
  - 의미: 선택적으로 프레임워크에 추가 기능(문서화, 스펙 생성 등)을 제공하는 런타임 연동.
  - 패키지 매핑: `@bunner/scalar`
  - 구성요소(대표):
    - OpenAPI/문서화 데코레이터: `ApiOperation`, `ApiProperty*`, `ApiResponse*`, `ApiTags` 등
    - 스펙 생성/호스팅: `Scalar`, spec factory, openapi document/schema 처리
  - 의존 판정(규범):
    - 플러그인은 호스트가 제공하는 기반 계약(최소 `@bunner/common`)을 `peerDependencies`로 선언해야 한다(MUST).
    - 플러그인이 코어 런타임과 결합되는 계약이 확정되기 전에는 `@bunner/core`를 `peerDependencies`로 강제해서는 안 된다(MUST NOT).

### 패키지별 상세 책임(근거 기반)

아래 설명은 각 패키지의 엔트리포인트(`index.ts`)와 패키지 메타데이터(`package.json`), 그리고 존재하는 README에 근거해 정리한다.

- `@bunner/common`
  - 책임: 프레임워크 전반에서 공유되는 타입/인터페이스/에러/데코레이터/상수/유틸리티를 제공한다.
  - 제공: `decorators`, `errors`, `types`, `interfaces`, `constants`, `utils`
  - 금지: 상위 런타임(`core`, `http-adapter` 등) 또는 툴링(`cli`)에 대한 의존/참조를 추가해서는 안 된다(MUST NOT).

- `@bunner/logger`
  - 책임: 로깅 인터페이스/구현 및 로깅 관련 런타임 유틸(예: async storage)을 제공한다.
  - 제공: `Logger` 및 transport(예: console), 로깅 관련 인터페이스
  - 금지: 프레임워크 코어/어댑터/툴링에 대한 의존을 추가해서는 안 된다(MUST NOT).

- `@bunner/core`
  - 책임: 프레임워크 코어 런타임을 제공한다.
  - 제공(대표): `Bunner`(애플리케이션 생성/종료), `BunnerApplication`, DI `Container`, cluster 관련 구성요소, validator/transformer compiler 및 validator decorators
  - 금지: 특정 전송 계층(예: HTTP 서버 구현)에 대한 직접 의존을 추가해서는 안 된다(MUST NOT). 전송 계층은 어댑터 패키지가 소유한다.

- `@bunner/http-adapter`
  - 책임: HTTP 런타임 어댑터를 제공한다.
  - 제공(대표): HTTP 서버/컨텍스트, request/response 래퍼, 라우팅/핸들러 계층, HTTP 전용 decorators(Controller/Route/Param 등), HTTP 전용 middleware
  - 금지: 애플리케이션/툴링 전용 기능(AOT 분석기, 코드 생성기 등)을 포함해서는 안 된다(MUST NOT).

- `@bunner/scalar`
  - 책임: Bunner용 Scalar API 문서화 연동을 제공한다.
  - 제공(대표): `Scalar` 및 OpenAPI/문서화 관련 decorators(README에 정의된 Public API를 contract로 간주)
  - 금지: 코어 런타임의 DI/클러스터/서버 구현을 재정의하거나 대체하려는 코드를 포함해서는 안 된다(MUST NOT).

- `@bunner/cli`
  - 책임: 개발/빌드 작업을 위한 CLI 도구를 제공한다.
  - 제공(대표): `bunner` 실행 파일 엔트리 및 CLI 커맨드(`dev`, `build`), 소스 분석기(analyzer) 및 관련 타입, CLI 전용 에러
  - 금지: 런타임 패키지들의 구현 세부를 내부 경로로 import 해서는 안 되며(MUST NOT), 런타임 패키지가 CLI에 의존하도록 만드는 결합을 만들어서는 안 된다(MUST NOT).

- `examples/*`
  - 책임: 프레임워크 사용 예시를 제공한다.
  - 강제: `@bunner/*` 전 패키지 및 각 패키지의 주요 기능을 포괄하는 예제를 제공해야 한다(MUST).
  - 강제: 엔터프라이즈급 레퍼런스 예제를 제공해야 한다(MUST).
  - 금지: `packages/*` 런타임/툴링 코드가 `examples/*`를 참조해서는 안 된다(MUST NOT).
  - 금지: 예제 코드가 프레임워크 규칙(패키지 경계/Facade)을 우회하도록 만드는 구조를 추가해서는 안 된다(MUST NOT).

### 단방향 의존 규칙(패키지 레벨)

아래 규칙은 “원칙”이 아니라 “판정 기준”이다.

- `@bunner/common`은 다른 `@bunner/*` 런타임 패키지에 의존하지 않는다.
- `@bunner/logger`는 다른 `@bunner/*` 런타임 패키지에 의존하지 않는다.
- `@bunner/core`는 `@bunner/common`, `@bunner/logger`에만 의존할 수 있다.
- `@bunner/http-adapter`는 `@bunner/core`, `@bunner/common`, `@bunner/logger`에만 의존할 수 있다.
- `@bunner/scalar`는 `@bunner/common`, `@bunner/logger`에만 의존할 수 있다.
- `@bunner/cli`는 프레임워크 런타임 구현 패키지(`@bunner/core|http-adapter|scalar|logger`)에 의존해서는 안 된다(MUST NOT).
- `@bunner/cli`가 프레임워크 계약(Contract)을 공유해야 한다면, `@bunner/common`에만 의존할 수 있다(MAY).
- `examples/*`는 `packages/*`에 의존할 수 있으나, 어떤 `packages/*`도 `examples/*`에 의존해서는 안 된다.

위 규칙은 다음 의미를 가진다.

- “의존하지 않는다” = MUST NOT
- “의존할 수 있다” = MAY

위 규칙에 위배되는 의존이 필요해진다면, 변경을 진행하기 전에 아키텍처 변경으로 취급하고 승인/합의가 선행되어야 한다.

### 패키지 의존 가능 여부 매트릭스 (Quick Reference)

| 소비자 ↓ / 제공자 → | common | logger | core  | http-adapter | scalar | cli |
| ------------------- | ------ | ------ | ----- | ------------ | ------ | --- |
| **common**          | -      | ❌     | ❌    | ❌           | ❌     | ❌  |
| **logger**          | ❌     | -      | ❌    | ❌           | ❌     | ❌  |
| **core**            | ✅     | ✅     | -     | ❌           | ❌     | ❌  |
| **http-adapter**    | ✅(P)  | ✅(P)  | ✅(P) | -            | ❌     | ❌  |
| **scalar**          | ✅(P)  | ✅(P)  | ❌    | ❌           | -      | ❌  |
| **cli**             | ✅     | ❌     | ❌    | ❌           | ❌     | -   |
| **examples**        | ✅     | ✅     | ✅    | ✅           | ✅     | ✅  |

- ✅ = dependencies로 의존 가능
- ✅(P) = peerDependencies로 의존
- ❌ = 의존 금지

### Import 안티패턴 예시 (Anti-patterns)

| 상황                    | ❌ 잘못된 import                                 | ✅ 올바른 import                       |
| ----------------------- | ------------------------------------------------ | -------------------------------------- |
| 다른 패키지 내부 접근   | `import { X } from '@bunner/core/src/container'` | `import { X } from '@bunner/core'`     |
| CLI에서 런타임 의존     | `import { Container } from '@bunner/core'`       | CLI는 `@bunner/common`만               |
| 상대 경로로 패키지 탈출 | `import { X } from '../../another-pkg/src/...'`  | Facade 통한 import                     |
| feature 경계 직접 침범  | `import { X } from '../other-feature/internal'`  | `import { X } from '../other-feature'` |

### CLI ↔ Core 관계 (역할/설치/의존)

이 섹션의 SSOT는 [TOOLING.md](TOOLING.md)다.

### package.json 의존성 선언 규칙 (dependencies / peerDependencies / devDependencies)

이 섹션의 SSOT는 [DEPENDENCIES.md](DEPENDENCIES.md)다.

### 패키지별 의존성 타입 매트릭스 (정확/명시)

이 섹션의 SSOT는 [DEPENDENCIES.md](DEPENDENCIES.md)다.

### 문서 배치 (ARCHITECTURE vs 패키지 문서)

- 이 문서(ARCHITECTURE.md)는 패키지 간 경계/의존 방향/Facade/의존성 타입 판정처럼 “레포 전체에 영향”이 있는 규칙만 둔다.
- 구조/파일 배치 규칙은 [STRUCTURE.md](STRUCTURE.md)가 SSOT다.
- `package.json` 의존성 판정은 [DEPENDENCIES.md](DEPENDENCIES.md)가 SSOT다.
- CLI 운영 정책은 [TOOLING.md](TOOLING.md)가 SSOT다.
- `@bunner/cli`의 커맨드 옵션/UX/사용 예시 같은 상세 스펙은, 해당 패키지의 README(예: `packages/cli/README.md`)에 두어야 한다(SHOULD).
- 에이전트 실행/검증 규칙은 [AGENTS.md](AGENTS.md)가 SSOT다.
- 만약 “에이전트가 패키지 역할/금지사항을 빠르게 조회”해야 한다면, 별도의 패키지 설명 문서를 추가할 수 있으나(예: `PACKAGES.md`),
  이는 문서 구조 변경이므로 생성/도입은 별도 승인 후 진행한다.

### 4.1 아키텍처 세부 원칙 (Architectural Rules)

1. **단방향 의존성 (Dependency Direction)**
   - 상위 계층(예: `http-server`)은 하위 계층(예: `core`)을 의존할 수 있다.
   - 반대 방향의 의존은 **절대 불가**다. (하위 계층은 상위 계층을 알면 안 된다)
   - 순환 참조(Circular Dependency)는 “허용 가능한 트릭”이 아니라 **설계 결함**이다. 발견 즉시 수정이 원칙이다.

2. **Public API 캡슐화 (Encapsulation via Exports)**
   - 물리적인 `internal` 디렉토리를 사용하지 않고, Barrel 파일(`index.ts`)을 통한 논리적 캡슐화를 수행한다.
   - `index.ts`는 "무엇을 노출할 것인가"를 결정하는 **유일한 관문**이다.
   - 외부에 필요한 API만 **명시적 이름**으로 export 해야 하며(MUST), 내부 구현이 우연히 노출되는 구조(`export *` 남발)는 금지된다(MUST NOT).

3. **Public API / Contract 보호 (Public API Protection)**
   - public API, export된 계약(Contract), 문서화된 인터페이스는 외부 소비자에게 제공되는 안정 계약으로 간주한다.
   - public API/Contract 변경은 의도치 않은 Breaking Change를 만들 수 있으므로, 명시적 요구 없이 변경해서는 안 된다(MUST NOT).
   - public 여부가 불명확한 경우, 기본값은 public으로 취급한다.

   public의 판단 기준은 아래와 같다.
   - 패키지의 public API는 “패키지 엔트리포인트”를 통해 노출되는 심볼이다.
   - 엔트리포인트는 해당 패키지의 `package.json`의 `main`/`module`/`types`가 가리키는 파일(들)을 기준으로 한다.
   - 엔트리포인트가 `index.ts`가 아니라 다른 경로를 가리키더라도, 그 파일은 **public facade**로 취급하며 동일한 규칙이 적용된다.

4. **변경 영향 범위(Blast Radius) 인식**
   - 변경은 항상 영향을 받는 패키지/모듈/Facade/외부 소비자 범위를 동반한다.
   - 구조적 변경 또는 public API/Contract 변경은 영향 범위가 크므로, 변경 전에 영향 범위를 식별하고 승인/검증을 우선한다.

5. **에러 핸들링 표준 (Error Handling)**
   - 프레임워크/인프라 계층에서 던지는 에러는 반드시 프레임워크 표준 에러(`BunnerError`)를 상속해야 한다.
   - “제어 흐름”을 만들기 위해 `throw`를 남용하지 마라. 가능하면 명시적 결과/에러 반환 패턴을 우선 고려하되, API 일관성을 깨지 않는 방식으로만 사용한다.

### 4.2 패키지 내부 아키텍처 패턴 (MANDATORY)

이 프로젝트의 `packages/*` 내부 코드는 반드시 다음 패턴을 따른다.

**Package-by-Feature(Vertical Slice) + Facade(공개 API 관문)**

이 규칙은 강제된다(MUST).

1. **패키지 = 배포/의존의 단위**
   - 다른 패키지는 오직 대상 패키지의 public facade(패키지 엔트리포인트)에만 의존한다.
   - 다른 패키지의 `src/**` 내부 파일로 직접 import 해서는 안 된다(MUST NOT).

   이 규칙의 판정 기준은 아래와 같다.
   - 허용: 다른 패키지의 “패키지 이름”으로 import (`@bunner/<pkg>`)
   - 금지: 다른 패키지의 내부 경로로 import (`@bunner/<pkg>/...`, `packages/<pkg>/src/...` 등)

2. **기능 디렉토리 = 개발/테스트/리팩토링의 단위(Vertical Slice)**
   - `src/<feature>/`는 하나의 기능 모듈이다.
   - 폴더 이름이 기능을 “소리치듯” 드러내야 한다(Screaming Architecture).
   - 기능 모듈은 스스로 완결적이어야 하며, 외부(다른 기능)에서 구현 상세를 알 필요가 없어야 한다.

3. **Facade(관문) 규칙**
   - 패키지 루트 `index.ts`: 외부에 필요한 API만 **명시적으로** export 해야 한다(MUST). `export *`로 외부 노출은 금지된다(MUST NOT).
     - 단, 레거시 패키지에 `export *`가 이미 존재할 수 있다. 이 경우 “현상 유지”를 이유로 신규 `export *`를 추가하지 마라.
     - 해당 패키지의 공개 API(루트 `index.ts`)를 수정하는 작업을 수행한다면, 그 작업 범위 내에서 `export *`를 **명시 export**로 전환하여 규칙을 이행한다.
   - 기능 폴더 `src/<feature>/index.ts`: 기능 내부 결합을 위해 `export *` 허용(단, 순환 참조 발생 시 즉시 명시 export로 전환).
   - `src/index.ts`: 내부 기능 모듈들을 묶는 Internal Facade로 사용한다.

4. **Feature 경계 import 규칙 (Barrel via Feature Index)**
   - 같은 feature 내부의 상대 경로 import는 허용된다(MAY).
   - 다른 feature로 넘어가는 import는 반드시 해당 feature의 barrel(`src/<feature>/index.ts`) 또는 `src/index.ts`를 통해서만 가능하다(MUST).
   - 다른 feature의 구현 파일을 직접 import 하는 행위는 금지된다(MUST NOT).

## 모듈 경계 판정 규칙 (Deep Import)

패키지 경계 침범은 “의도”가 아니라 “경로”로 판정한다.

- 금지: 다른 패키지의 구현 상세로 직접 접근하는 import
  - 예: `@bunner/core/src/...`, `@bunner/common/src/...`, `packages/core/src/...` 등
- 허용: 다른 패키지의 public facade를 통한 import
  - 예: `@bunner/core`, `@bunner/common` 등

위 규칙은 다음 의미를 가진다.

- 금지 = MUST NOT
- 허용 = MUST (허용된 방식만 사용해야 한다)

이 규칙은 테스트/예제 코드에서도 동일하게 적용된다. 예외가 필요하다면, 아키텍처 변경으로 취급한다.

## Architecture Violation Levels (규범)

이 섹션은 변경의 자동 판정(리뷰/에이전트/CI)을 위한 “위반 등급” 정의다.

- Level 1 (Fatal): 위반 시 변경은 즉시 거부되어야 한다(MUST).
  - CI/에이전트에서 자동 차단이 가능해야 한다(SHOULD).
  - 자동 차단 규칙(= CI에서 실행되는 체크 스텝)이 존재하지 않는 경우, 해당 변경은 병합 대상이 될 수 없다(MUST NOT).
  - 순환 의존 도입
  - 단방향 의존 규칙 위반
  - cross-package deep import
- Level 2 (Breaking Risk): 변경은 승인/영향 분석이 필요하다(SHOULD).
  - public API/Contract 무단 변경
  - 패키지 책임 침범(역할/소유권 변경)
- Level 3 (Design Debt): 즉시 거부 대상은 아니나, 추적이 필요하다(SHOULD).
  - SHOULD 규칙 위반
  - 결정성(Determinism) 리스크 증가

## What Constitutes an Architecture Change (규범)

다음 중 하나라도 해당하면 “아키텍처 변경”으로 취급해야 한다(MUST).

- 패키지 분류(Framework Runtime/Tooling/Examples) 변경
- 핵심 개념(예: Module System, DI, Adapter, Plugin)의 소유 패키지 변경
- 단방향 의존 규칙 수정
- public facade 경계 변경(패키지 엔트리포인트로 노출되는 심볼/계약 변경 포함)
- AOT 결정성에 영향을 주는 구조 변경(분석 입력/해석/순서/정규화 규칙 포함)

아키텍처 변경의 승인/절차는 [GOVERNANCE.md](GOVERNANCE.md)가 SSOT다.

## AOT Determinism – Concrete Rules (규범)

동일 입력(코드/락파일/설정)에서 동일 결과(그래프/산출물)가 나와야 한다(MUST).

AOT 결정성 위반 여부를 검증하는 책임은 CLI/CI에 있으며, 수동 검증을 전제로 한 규칙은 인정되지 않는다(MUST).

금지(MUST NOT):

- Object/Map/Set 순회 순서에 의존하는 분석/산출
- `fs.readdir`/glob 결과를 정렬 없이 사용하는 분석/산출
- 실행 환경에 따라 결과가 달라지는 입력(환경변수/로케일/타임존/현재시간/랜덤)에 의존하는 분석/산출

권장(SHOULD):

- 파일 목록/키 목록은 정렬 후 처리한다.
- 경로는 정규화(절대 경로/확장자 규칙/구분자) 후 키로 사용한다.

## 5. 디렉토리 구조 (Directory Structure)

이 섹션의 SSOT는 [STRUCTURE.md](STRUCTURE.md)다.

이 문서(ARCHITECTURE.md)는 패키지 경계/의존 방향/Facade 규칙을 중심으로 유지한다.

## 13. Exports (Barrel 패턴) 및 패키지 캡슐화 가이드

Exports 규칙의 SSOT는 4.2의 **Facade(관문) 규칙**이다. 이 섹션은 예시만 제공한다.

예시:

```ts
// src/application/index.ts (내부 모듈용) - 간결함 허용
export * from './application';
export * from './interfaces';

// packages/core/index.ts (Public API 진입점) - 엄격한 제어
export { BunnerApplication } from './src/application';
export type { AppOptions } from './src/application';
```

## 18. Architecture Gardening (Mandatory)

아키텍처 가드닝은 “보기 좋게 정리”가 아니라, 경계/결정성/단방향 의존을 **지속적으로 강제**하는 활동이다.

1. 모든 변경은 아키텍처 불변식을 유지/개선해야 한다: 단방향 의존, 패키지 경계, AOT 결정성.
2. 트리거 없는 정리는 금지된다(MUST NOT). 가드닝은 반드시 구체 결함(순환, 경계 침범, 비결정성, 빌드/테스트 붕괴)과 연결되어야 한다(MUST).
3. 경계 침식(Boundary Erosion)을 허용하지 않는다.
   - cross-package deep import(다른 패키지의 `src/**` 직접 import)는 즉시 거부한다.
   - 공유가 필요하면 `src/index.ts`(internal facade) 또는 진짜 cross-domain만 `src/common`으로 올린다.
4. 순환 의존은 “나중에” 고칠 수 있는 항목이 아니라 즉시 수정 대상이다.
5. AOT/CLI 산출물은 입력이 같으면 결과가 같아야 한다.
   - 파일 시스템 순회 순서, 비결정적 Map/Set 순서 등에 의존해서는 안 된다(MUST NOT).

순환 의존은 “임시 허용”되지 않는다.

- 순환이 발견되면 변경은 실패로 취급한다.
- 순환이 도입될 가능성이 있는 구조 변경은, 변경 전에 탐지/검증 경로를 포함해 제시되어야 한다.

## 19. Monorepo Integrity (Mandatory)

1. 배포/의존의 단위는 오직 `packages/*`의 패키지다.
2. 외부 소비자는 패키지 루트 `index.ts`만을 통해 접근해야 한다.
   - 다른 패키지의 `packages/<name>/src/**`를 직접 import 해서는 안 된다(MUST NOT).
3. 숨은 결합은 금지된다(MUST NOT).
   - 워크스페이스 루트에 “우연히 호이스팅된 의존성”에 기대지 말고, 각 패키지의 `package.json`에 실제 의존성을 선언한다.
4. 워크스페이스 경로 규율은 강제된다(MUST).
   - 패키지 루트 밖으로 탈출하는 상대경로 import는 금지된다(MUST NOT).
   - 패키지 간 참조는 반드시 패키지 이름 import + 대상 패키지의 public facade export로 해결한다.
5. 생성물(Generated output)은 격리한다.
   - `.bunner/**`, `dist/**` 같은 산출물이 린트/타입체크/스캔에 섞이지 않도록 설정한다.
   - 명시적 요구 없이는 생성물을 커밋하지 않는다.

생성물 격리는 “의도”가 아니라 “도구 설정”으로 보장되어야 한다.

- 타입체크/린트/스캔 대상에서 산출물 디렉토리를 제외한다.
- 산출물이 리포지토리에 섞여 들어가는 변경은 기본적으로 거부한다.

## Implementation Notes (Non-normative)

이 섹션은 이해를 돕기 위한 참고이며, 아키텍처 불변식이 아니다.

- Metadata Registry 구현(현재): `globalThis.__BUNNER_METADATA_REGISTRY__` 기반
- 레지스트리 소비자(현재): `MetadataConsumer`, `BunnerScanner`

## 아키텍처 검증 체크리스트

- [ ] 패키지 경계를 넘는 import가 Public Facade를 통하는가?
- [ ] cross-package deep import가 없는가?
- [ ] 의존 방향이 매트릭스를 준수하는가?
- [ ] 순환 의존성이 없는가?
- [ ] Public API 변경 시 승인을 받았는가?
- [ ] 산출물(`.bunner/**`, `dist/**`)이 저장소에 포함되지 않았는가?
- [ ] `bun run architecture:check`가 통과하는가?
