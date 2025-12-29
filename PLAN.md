# PLAN (CLI 패키지 리팩토링 — 규칙 엄격 준수)

## 0. 목적/범위

- 목적: `@bunner/cli` 패키지를 SSOT/정책에 100% 정합시키는 리팩토링을 수행한다.
- 범위: `packages/cli/**` 전 영역(코드, 디렉토리, 파일, 테스트, package.json, README)만 포함한다.
- 범위 밖: 다른 패키지(`packages/*`), 루트 설정, examples, SSOT 문서 변경은 금지다. 필요 시 사전 승인 요청이 선행되어야 한다.

## 1. 적용 규칙(SSOT 확인)

- 최상위: `SPEC.md`
- 경계/Facade: `ARCHITECTURE.md`
- 파일 배치/구조: `STRUCTURE.md`
- 네이밍/코드 스타일: `STYLEGUIDE.md`
- 의존성 선언: `DEPENDENCIES.md`
- CLI 정책: `TOOLING.md`
- 테스트: `TESTING.md`
- 즉시 중단: `POLICY.md`

## 2. 변경 영향 범위(Blast Radius)

- 영향 패키지: `@bunner/cli` 단일 패키지
- Public API/Contract
  - `packages/cli/index.ts`에서 노출되는 심볼(현행 스냅샷)
    - 현재(실측): `BunnerCliError`, `TypeMetadata`
  - `packages/cli/package.json`의 `bin`(CLI 실행 계약): `bunner`
- 행동/출력에 영향 가능 영역
  - `dev`/`build` CLI 명령 동작
  - AOT 산출물(.bunner/manifest.ts, injector.ts, entry.ts 등) 생성 순서/결정성

## 3. 현 상태 진단(규칙 위반/리스크)

- 구조/Facade
  - `packages/cli/src/index.ts`가 없음: 표준 레이아웃 위반 (`STRUCTURE.md`)
  - `packages/cli/README.md` 부재: 표준 레이아웃 위반 (`STRUCTURE.md`)
  - `packages/cli/index.ts`에서 `export *` 사용: Public Facade 규칙 위반 (`ARCHITECTURE.md`)

- 의존성/경계
  - `@bunner/cli`가 `@bunner/logger`에 의존: Tooling ↔ Runtime 경계 위반 (`ARCHITECTURE.md`, `TOOLING.md`, `DEPENDENCIES.md`)

- 스크립트/표준 커맨드
  - `packages/cli/package.json`에 `tsc` 스크립트가 없고 `typecheck`만 존재: 표준 스크립트 명칭 드리프트 (`TOOLING.md`)

- import 경계
  - `packages/cli/src/commands/dev.command.ts`가 `../generator/import-registry`로 deep import: feature 경계 규칙 위반 (`STRUCTURE.md`)

- 주석/코드 스타일
  - 다수 파일에 비‑TSDoc 주석 존재: 금지 규칙 위반 (`STYLEGUIDE.md`)

- 생성 코드(산출물) 품질
  - `InjectorGenerator`가 생성하는 코드에 `@bunner/logger` import가 포함됨: 불필요한 런타임 결합/설치 요구를 유발할 수 있음
  - `ImportRegistry.getImportStatements()`가 Map 삽입 순서에 의존: 산출물 순서 흔들림(결정성 리스크)

- 타입 안정성
  - 다수 파일의 `any` 사용: 금지 수준(근거 없음) (`STYLEGUIDE.md`)

- 결정성/검증
  - `Glob.scan` 결과와 Map/Set 순회가 정렬되지 않음: AOT 결정성 위반 리스크 (`SPEC.md`, `TOOLING.md`)
  - `ModuleGraph.detectCycles()` 미구현: 순환 의존 실패 처리 미보장 (`SPEC.md`, `ARCHITECTURE.md`)

- 결정성/휴대성(추가 리스크)
  - `ImportRegistry`가 `Bun.resolveSync(..., process.cwd())`로 specifier를 절대 경로로 바꾼 뒤 상대 경로로 변환: 산출물 경로가 실행 위치/설치 레이아웃에 흔들릴 수 있음
  - `ImportRegistry`의 alias 충돌 해결이 “호출 순서”에 의존: 동일 입력이어도 분석/수집 순서가 달라지면 alias가 달라질 수 있음

- Sealed Registry/Graph(인지 사항)
  - CLI 산출물(예: `manifest.ts`)은 외부(런타임/다른 패키지)가 조회하는 메타데이터/그래프 관련 구조를 불변으로 봉인한다.
  - 이는 런타임이 `__BUNNER_METADATA_REGISTRY__`를 수정/패치/주입해서는 안 된다는 SSOT 불변조건과 정합해야 한다.

- CLI 정책
  - `dev` 명령이 애플리케이션 실행/감시를 직접 수행: CLI 역할 경계 위반 가능성 (`TOOLING.md`)

- 실행/에러 처리
  - `ConfigLoader.load()`가 내부에서 `process.exit()`를 호출: 라이브러리 레이어에서 종료 제어(테스트/재사용성 저하)
  - `build` 명령이 `console.log`를 사용: 로깅 정책/출력 통일 필요

## 3.1 logger 의존성 정책(명확화)

- 전제
  - “모든 패키지에서 logger가 필요하다”는 전제는 사실이 아니다.
  - 현재 코드 기준으로 `@bunner/logger` 런타임 import는 `@bunner/core`, `@bunner/http-adapter`에서 확인되며, `@bunner/scalar`/`@bunner/common`은 필수가 아니다.
  - `@bunner/cli`는 SSOT 상 런타임 패키지(= `@bunner/logger` 포함)에 의존하면 안 된다.

- 판정 규칙
  - 어떤 패키지가 런타임에서 `@bunner/logger`를 import 한다면, 그 패키지는 반드시 `dependencies` 또는 `peerDependencies`로 선언해야 한다.
  - 어댑터/플러그인에서 `peerDependencies`로 둘 경우, 소비자 앱(또는 workspace 루트)이 logger를 직접 설치해야 한다.

- 본 PLAN에서의 결론(작업 범위: `packages/cli/**`)
  - CLI에서는 `@bunner/logger`를 제거하고, Bun 내장 `console`을 직접 사용한다.
  - CLI 산출물 코드에서의 `@bunner/logger` import는 “필수 근거가 있을 때만” 허용하며, 불필요한 import는 제거/정리한다.

## 4. 리팩토링 목표

1. `packages/cli`가 표준 레이아웃을 완전히 충족한다.
2. Public Facade는 **명시 export**만 사용하고, Public API에 TSDoc을 제공한다.
3. CLI는 런타임 패키지(`@bunner/*` 런타임) 의존을 제거한다.
4. feature 경계 import를 barrel(`src/<feature>/index.ts` 또는 `src/index.ts`)로 통일한다.
5. 비‑TSDoc 주석을 전부 제거한다.
6. `any`를 제거하고 `unknown` + 타입가드 또는 명확한 타입으로 대체한다.
7. AOT 산출물/분석 로직이 **결정적(Deterministic)** 으로 동작한다.
8. CLI가 생성하는 레지스트리/그래프 관련 데이터는 조회 전용으로 유지되며(Sealed/Immutable), 이 불변조건을 약화시키지 않는다.
9. 순환 의존을 빌드 실패로 처리한다.
10. 테스트로 결정성/순환 검증을 보장한다.

## 5. 실행 계획 (상세)

### 5.1 단계 0 — 범위/승인 확인 (작업 전 1회)

- [ ] 변경 대상이 `packages/cli/**`만인지 재확인한다.
- [ ] 다른 패키지 또는 SSOT 문서 수정이 필요해지는 경우 즉시 중단하고 사용자 승인 요청한다.
- [ ] Public Facade 스냅샷을 고정한다.
  - 현행 `packages/cli/index.ts`의 export 목록을 기준으로 “변경 전 계약”을 명시하고, 이후 변경은 Breaking 여부를 먼저 판정한다.

### 5.2 단계 1 — 구조/Facade 정합성

- [ ] `packages/cli/src/index.ts` 생성
  - 내부 feature barrel들을 명시적으로 export한다.
  - 목적: 내부 import의 단일 진입점 제공 및 구조 규칙 충족.
- [ ] `packages/cli/src/bin/index.ts` 생성
  - `bunner.ts`를 export하여 feature barrel 규칙 충족.
- [ ] `packages/cli/README.md` 생성
  - CLI 패키지의 역할, 설치/실행, 공개 API(`BunnerCliError`, `TypeMetadata`)를 명시.
  - 문서 위치는 패키지 루트로 고정.
- [ ] `packages/cli/index.ts` 수정
  - `export *` 제거.
  - 명시 export로 전환.
  - Public API에 TSDoc 추가.

### 5.3 단계 2 — 의존성 정리 (Tooling ↔ Runtime 분리)

- [ ] `packages/cli/package.json`에서 `@bunner/logger` 제거
  - CLI는 런타임 패키지에 의존하지 않아야 한다.
- [ ] 기존 `Logger` 사용처를 `console` 기반으로 교체
  - 대상: `packages/cli/src/commands/dev.command.ts`, `packages/cli/src/commands/build.command.ts`, `packages/cli/src/common/config-loader.ts`, `packages/cli/src/watcher/project-watcher.ts`
  - feature 경계 규칙에 맞게 `../common` barrel 경유.

- [ ] CLI 산출물 코드에서 불필요한 런타임 결합 제거
  - 대상: `packages/cli/src/generator/injector.ts`의 생성 코드 템플릿 내 `@bunner/logger` import
  - 목표: CLI가 logger를 제거해도 AOT 산출물 때문에 앱 설치가 강제되지 않도록 한다.

### 5.4 단계 3 — Feature 경계 import 정리

- [ ] `packages/cli/src/generator/index.ts`에 `ImportRegistry`를 명시 export 추가
- [ ] `packages/cli/src/commands/dev.command.ts`에서 `ImportRegistry`를 `../generator` 경유로 변경
- [ ] 모든 cross‑feature import가 `src/<feature>/index.ts` 또는 `src/index.ts` 경유인지 전수 점검

### 5.5 단계 4 — 주석 제거 및 Public API TSDoc

- [ ] `packages/cli/src/**`의 비‑TSDoc 주석 전부 제거
  - 대상 예: `module-graph.ts`, `metadata.ts`, `manifest.ts`, `module-discovery.ts` 등
- [ ] Public API TSDoc 추가
  - `packages/cli/src/errors/bunner-cli.error.ts`
  - `packages/cli/src/analyzer/interfaces.ts`의 `TypeMetadata`
  - Public API로 노출되는 항목에만 제한

### 5.6 단계 5 — 타입 안정성 (any 제거)

- [ ] AST 관련 `any` → 최소 타입 모델 또는 `unknown`+타입가드로 대체
  - 대상: `ast-parser.ts`, `ast-type-resolver.ts`, `parser-models.ts`, `interfaces.ts`
  - 방법: `oxc-parser`의 타입 정의 확인 후 필요한 타입만 좁혀서 사용
- [ ] `Map<string, any>` → 명확한 타입 사용
  - `FileAnalysis`, `ClassMetadata`, `ModuleDefinition` 등을 기반으로 타입 명시
- [ ] `GenerateConfig`의 인덱스 시그니처를 `Record<string, unknown>`로 교체
- [ ] `ProviderRef`, `ModuleDefinition.providers`, `DecoratorMetadata.arguments` 등 `any` 제거
  - 불가피한 경우 `unknown`으로 최소화하고 타입가드 함수로 격리

### 5.7 단계 6 — 결정성 보장 (Determinism)

- [ ] 모든 파일/키/모듈 순회를 정렬된 리스트로 처리
  - 정렬은 로케일에 의존하지 않는 비교(코드포인트 기반)를 사용해 환경 차이로 인한 흔들림을 제거한다.
  - `Glob.scan` 결과는 배열화 후 결정적 비교로 정렬
  - `Map/Set` 순회는 키/엔트리를 배열화 후 결정적 비교로 정렬한 뒤 순회
- [ ] `ModuleGraph.build()` 내부의 입력 순서를 고정
  - `moduleMap`의 키(모듈 파일 경로) 정렬
  - 모듈 내 `providers`/`controllers`/`dynamicProviderBundles` 처리 순서 고정
- [ ] `ManifestGenerator`의 `createScopedKeysMap()` 엔트리 순서 고정
  - 모듈 순서, provider/controller 토큰 순서를 정렬 기반으로 고정
- [ ] `ImportRegistry.getImportStatements()` 결과 정렬
  - alias 또는 path 기준으로 정렬하여 출력 고정

- [ ] `ImportRegistry` 경로 정책을 결정하고 고정한다
  - 패키지 specifier(예: `react`, `@bunner/common`)는 불필요하게 절대 경로로 해석하지 않고 specifier를 유지한다.
  - 파일 경로(상대/절대)는 “프로젝트 루트 기준 정규화” 규칙을 정의하고, outputDir 기준 상대 import로 변환한다.
  - alias 충돌 해결이 입력 순서에 의존하지 않도록, ImportRegistry에 들어가는 (filePath, className) 입력을 정렬된 순서로 공급한다.

- [ ] Sealed Registry/Graph 계약을 명시적으로 유지한다
  - `__BUNNER_METADATA_REGISTRY__`는 런타임에서 재정의/재할당이 불가해야 한다(예: `defineProperty`로 `writable: false`, `configurable: false`).
  - 메타데이터 오브젝트는 깊은 불변화(예: deep freeze)로 외부 변경이 불가능해야 한다.
  - 그래프/키 테이블(Map 등)은 변이 API를 차단해 외부 변경 시도를 즉시 실패 처리해야 한다.

- [ ] Sealed 계약 파손 방지 체크리스트(구체)
  - `globalThis.__BUNNER_METADATA_REGISTRY__` 설정은 반드시 `Object.defineProperty`로 고정하고, `writable/configurable` 값을 약화시키지 않는다.
  - 봉인 대상은 “외부에서 접근 가능한 모든 그래프/키/메타데이터 구조”여야 하며, 일부 객체/맵만 봉인되는 누락을 허용하지 않는다.
  - deep freeze는 순환 참조(WeakSet 등) 안전성을 유지하고, 누락된 하위 필드가 생기지 않도록 테스트로 고정한다.
  - Map 봉인은 `Object.freeze(map)`만으로 끝내지 않고, `set/delete/clear` 등 변이 API 차단이 유지되어야 한다.
  - 봉인 로직이 import/초기화 순서에 의존하지 않도록, 생성 코드의 실행 순서(레지스트리 생성 → defineProperty)를 유지한다.
  - 런타임/테스트에서 “레지스트리 재정의/변이 시도 시 실패(throw)”가 보장되는 케이스를 추가한다.
- [ ] `ManifestGenerator`, `InjectorGenerator`, `MetadataGenerator`의 출력 순서 고정
  - 클래스/모듈/프로바이더/컨트롤러 순서를 정렬

### 5.8 단계 7 — 순환 의존 검증

- [ ] `ModuleGraph.detectCycles()` 구현
  - cycle의 정의를 먼저 확정해야 한다(무엇이 무엇을 “의존”하는지)
  - 그래프 기반 DFS로 cycle path 도출
  - 발견 시 빌드 실패(Error throw) 처리
- [ ] `ModuleGraph.build()`에서 cycle 검증 호출
- [ ] 테스트 추가 (정상/순환 케이스)

### 5.9 단계 8 — CLI 정책 준수 (dev/build 동작 재정의)

- [ ] `dev` 명령에서 **애플리케이션 실행/스폰 제거**
  - 역할을 AOT 산출물 생성 + 파일 감시에 한정
  - 실행은 사용자에게 명시적 커맨드로 안내
  - 종료 코드 정책(성공: 0, 실패: 1)을 고정한다
- [ ] `build` 명령의 출력 정책을 고정하고, 불필요한 `console.log`를 제거한다

### 5.10 단계 9 — 테스트/검증 강화

- [ ] 결정성 테스트
  - 동일 입력에서 동일 출력이 나오는지 검사
  - `ImportRegistry`/`ManifestGenerator`/`ModuleGraph` 순서 고정 테스트
  - 입력 순서를 뒤섞어도 출력이 동일함을 검증한다(순서 독립성)
- [ ] Sealed Registry/Graph 테스트
  - `__BUNNER_METADATA_REGISTRY__` 재정의 시도(예: `defineProperty`, 재할당)가 실패하는지 확인한다
  - scoped keys map의 변이 시도(`set/delete/clear`)가 즉시 실패(throw)하는지 확인한다
  - 메타데이터 오브젝트 변이 시도(예: nested property write)가 실패하는지 확인한다
- [ ] 순환 의존 테스트
  - cycle 발견 시 오류 발생 확인
- [ ] 기존 테스트(`entry.spec.ts`) 유지 + 필요 시 수정
- [ ] 표준 검증 스크립트 실행
  - `bun run lint`
  - `bun run tsc` (또는 현재 `typecheck`가 등가인지 확인 후 `tsc` alias 추가)
  - `bun test`

## 6. 변경 파일 목록(예정)

- 수정
  - `packages/cli/index.ts`
  - `packages/cli/package.json`
  - `packages/cli/src/commands/dev.command.ts`
  - `packages/cli/src/commands/build.command.ts`
  - `packages/cli/src/common/config-loader.ts`
  - `packages/cli/src/watcher/project-watcher.ts`
  - `packages/cli/src/analyzer/**`
  - `packages/cli/src/generator/**`
  - `packages/cli/src/errors/bunner-cli.error.ts`
  - `packages/cli/src/analyzer/interfaces.ts`
- 추가
  - `packages/cli/src/index.ts`
  - `packages/cli/src/bin/index.ts`
  - `packages/cli/README.md`
- 삭제
  - 없음 (불가피한 삭제가 필요하면 사전 승인 후 진행)

## 7. 최적화 가능 범위(정량/정성)

- 결정성 안정화 (High)
  - 파일/키/그래프 순서를 정렬하여 출력이 항상 동일해짐
  - CI 재현성 향상, 캐시 불일치 감소

- 분석/생성 성능 (Medium)
  - 파일 파싱 결과 캐시 유지 + 변경 파일만 재분석
  - `dev`에서 전체 재스캔 제거(변경 파일 중심)

- 메모리 사용량 (Medium)
  - AST/메타데이터 구조를 최소 타입으로 축소
  - 불필요한 중복 컬렉션 제거

- 유지보수성 (High)
  - 타입 안전성 강화로 런타임 오류 감소
  - Public API 문서화(TSDoc)로 계약 명확화

## 8. 인수 기준(Acceptance Criteria)

- `packages/cli`가 `STRUCTURE.md` 표준 레이아웃을 충족한다.
- CLI가 런타임 패키지(`@bunner/logger` 포함)에 의존하지 않는다.
- Public Facade는 명시 export만 사용한다.
- 비‑TSDoc 주석이 전부 제거된다.
- `any` 사용이 사라지고 타입 안정성이 확보된다.
- `dev`/`build`가 `TOOLING.md` 경계를 위반하지 않는다.
- 순환 의존이 감지되면 빌드 실패가 발생한다.
- 동일 입력 → 동일 산출물(결정성)이 보장된다.
- CLI 산출물의 레지스트리/그래프 관련 데이터는 불변(Sealed)이며 런타임 변경 시도는 실패 처리된다.
- `bun run lint`, `bun run tsc`, `bun test`가 통과한다.
