# TOOLING

## 목적

- CLI 설치/운영 정책과 런타임(Core/Adapter)과의 관계를 고정한다.

## 적용 범위

- `@bunner/cli` 및 개발/빌드 자동화 흐름

## 정본/우선순위

- 최상위 정본은 [SPEC.md](SPEC.md)다.
- 패키지 경계/단방향 의존은 [ARCHITECTURE.md](ARCHITECTURE.md)가 우선한다.

## CLI ↔ Runtime 관계

- `@bunner/core`: 런타임 프레임워크
- `@bunner/cli`: 툴체인(AOT/분석/빌드/개발 커맨드)

## 설치 기본값

- 프로젝트는 `@bunner/cli`를 `devDependencies`로 설치하는 것을 기본값으로 한다.
- CLI 커맨드는 가능한 한 “프로젝트에 설치된 런타임 패키지”를 기준으로 동작해야 한다.

## 글로벌 설치 정책

- 글로벌 설치는 편의용 런처로만 취급한다.
- 글로벌 CLI가 프로젝트 런타임(`@bunner/core`)을 자체적으로 포함/소유하려는 구조는 지양한다.

## 설계 경계

- CLI는 런타임 구현(Core/Adapter)을 대체하지 않는다.
- CLI는 프레임워크 런타임 구현 패키지(`@bunner/core`, `@bunner/http-adapter`, `@bunner/scalar`, `@bunner/logger`)에 의존해서는 안 된다.
- CLI가 프레임워크의 계약(Contract)을 공유해야 한다면, `@bunner/common`에만 의존할 수 있다.
- 운영 환경의 상주 프로세스 관리(daemonize/restart/logrotate 등)는 CLI가 직접 구현하기보다 외부 운영 도구 설정 생성/런처 역할로 제한하는 것을 기본값으로 한다.

## 패키지 스크립트 표준 (Scripts)

이 레포의 검증 스크립트는 **루트 `package.json`만** 소유한다(MUST).

강제 정책(Enforced):

- 루트 `package.json`에는 반드시 `verify` 스크립트가 존재해야 한다(MUST).
- 검증은 반드시 루트의 `verify`로만 수행한다(MUST).
  - 허용: `bun run verify`
  - 금지: `packages/*`의 `package.json`에 `test`/`lint`/`tsc`/`typecheck` 같은 검증 스크립트를 두는 행위(MUST NOT)
  - 금지: 에이전트/CI/개발자가 패키지 단위 검증 스크립트를 직접 실행하도록 문서화/유도하는 행위(MUST NOT)

`verify`는 최소한 아래 3가지를 한 번에 실행해야 한다(MUST).

- lint
- typecheck(tsc)
- test

## CLI AOT 산출물 (Registry / Plan)

이 섹션은 “CLI가 빌드타임에 최대한 수행하여 런타임을 가볍게” 만들기 위한 산출물 기준을 정의한다.
정적 수집/해석/결정성 같은 AOT/AST 계약 자체는 [SPEC.md](SPEC.md)가 SSOT다.

### Metadata Registry

- CLI는 런타임이 소스를 스캔하지 않아도 되도록, 메타데이터 레지스트리(예: `__BUNNER_METADATA_REGISTRY__`)를 생성해야 한다.
- 레지스트리는 동일 입력(코드/락파일/설정)에서 동일 결과가 나오도록 결정적이어야 한다.
- 레지스트리는 런타임이 “소비(consumption)”만으로 조립(assembly)할 수 있는 수준의 정적 정보를 포함해야 한다.

### Execution Plan

- CLI는 런타임이 탐색/추론/스캔을 수행하지 않도록, 런타임이 소비 가능한 실행 계획(plan)을 최대한 생성해야 한다.
- plan은 “가능하면 빌드타임에 계산하고, 런타임에는 적용만” 하는 것을 목표로 한다.
- plan의 예시는 아래와 같다.
  - 라우팅 매칭 테이블
  - 미들웨어/필터/파이프 적용 순서 계획
  - DI 와이어링(토큰 그래프) 계획

### 금지

- CLI는 애플리케이션을 실행해서 부팅/조립하는 흐름을 도입해서는 안 된다.
- CLI는 네트워크 바인딩, 워커/클러스터 스폰, 시그널 핸들링 같은 운영 환경 종속 동작을 수행해서는 안 된다.

## CLI 분석 계약 (AST / ModuleGraph)

이 섹션은 CLI가 수행하는 정적 분석의 “구현 세부 SSOT”다.
최상위 불변조건(결정성/런타임 비스캔/레지스트리 소비 계약 등)은 [SPEC.md](SPEC.md)가 SSOT다.

### 추적 범위

- CLI는 로컬 소스(`src/**`)만 보지 않고, 프로젝트가 임포트한 전체 의존 폐쇄(워크스페이스 `packages/*` 및 외부 패키지)를 포함해 분석 입력을 구성해야 한다.
- `*.d.ts` 및 `node_modules/@types/**`는 타입 정의로 간주하고, 소스 파싱 대신 “존재 기록” 수준으로 취급할 수 있다.

### 해석(Resolution)

- 해석은 Bun 기준이며, 항상 importer 기준으로 결정적이어야 한다.
- 상대 경로(`./`, `../`)는 `dirname(importer)` 기준으로 절대 경로로 정규화한다.
- 패키지 경로는 `Bun.resolveSync(specifier, dirname(importer))`로 해석한다.
- 빌트인/런타임 외부 모듈(예: `node:*`, `bun:*`)은 “외부 의존성”으로만 기록하고 소스 파싱을 시도하지 않는다.

### 수집(Import/Re-export)

- `import` / `export * from` / `export { X } from`를 손실 없이 수집해야 한다.
- `import type` 및 `import { type X }`는 런타임 의존성이 아니므로 기본적으로 제외한다.
- 타입 전용처럼 보여도 런타임 코드 생성에 필요하다면, 그 근거와 처리 방식을 코드/테스트로 증명해야 한다.

### ModuleGraph 승격

- 파일 목록 수준의 트리를 “모듈 그래프(ModuleGraph)”로 승격해야 한다.
- `@Module`/`@RootModule`의 `imports/providers/controllers/exports`는 분석 결과에 반영되어야 한다.
- `export` 및 `re-export`는 import 연결 해석의 필수 입력이며, `export *`와 alias re-export까지 추적해야 한다.

### 금지 및 실패 처리

- 정적 분석이 불가능한 동적 의존성(임의 `require`, 계산된 specifier 등)은 허용하지 않는다.
- 순환 의존성은 ‘경고’가 아니라 실패로 취급한다.
- 해석 불가/파싱 실패는 조용히 삼키지 않으며, 어떤 specifier를 어디서 해석하다 실패했는지 추적 가능한 형태로 남겨야 한다.

### 결정성(재현성)

- 동일 입력(코드/락파일/설정)에서 동일 그래프/동일 산출물이 생성되어야 한다.
- 파일 목록/키 목록/순회 입력은 정렬 후 처리하는 것을 기본값으로 둔다.
