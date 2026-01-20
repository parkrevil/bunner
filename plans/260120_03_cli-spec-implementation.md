---
status: implemented
---

# Run Plan

## 0) Persona / Handshake (필수)

- Persona:
  - `@Implementer`

- Handshake (AGENTS.md 형식 그대로):
  - "페르소나 **@Implementer**로서 작업을 시작합니다. **AGENTS.md (E0)**에 명시된 행동 제한 규약을 숙지하였으며, 작업 도중 불확실성 발생 시 즉시 중단(STOP IF UNCERTAIN)할 것을 서약합니다."

## 0) 원문(사용자 입력)

- 원문:
  - "README 는 배제"
  - "나머지 항목들은 모두 구현하기로 한다. 계획을 시작하고 논의를 시작하도록한다"

- 에이전트 해석(검증 가능하게):
  - 무엇을 변경하는가:
    - `packages/cli/**`의 CLI 동작/산출물/결정성/진단/모듈 판정/manifest 내용을 L1/L2/L3 SSOT(특히 `docs/10_FOUNDATION/INVARIANTS.md`, `docs/20_ARCHITECTURE/ARCHITECTURE.md`, `docs/30_SPEC/{aot-ast,manifest,module-system,diagnostics,devtools,docs}.spec.md`)와 정합되게 만든다.
    - 문서 정합 검토에서 README(루트 README 및 90_REFERENCE README 포함)는 이번 범위에서 제외한다.
  - 성공 조건은 무엇인가(요약):
    - CLI가 L3 스펙에서 MUST로 요구하는 산출물/형상/결정성/실패-진단을 만족한다.
    - L1 불변식(특히 Metadata Volatility / Static DI Wiring / Fail-fast / Explicitness)을 위반하는 런타임 경로를 제거하거나 구조적으로 불가능하게 만든다.
    - (중요) README를 바꾸지 않고도, 스펙과 코드의 정합이 성립한다.
  - 명시적 제약:
    - 본 Plan 단계에서는 코드/SSOT 문서를 변경하지 않는다. (Workflow)

- SSOT 충돌 여부:
  - [ ] 없음
  - [ ] 있음 → 충돌 지점 식별 후 즉시 중단

---

## 0) Preflight (필수 식별)

- 변경 대상(후보):
  - `packages/cli/src/bin/bunner.ts`
  - `packages/cli/src/commands/{dev.command.ts,build.command.ts}`
  - `packages/cli/src/generator/{manifest.ts,entry.ts,injector.ts,metadata.ts}`
  - `packages/cli/src/analyzer/{module-discovery.ts,graph/module-graph.ts,...}`
  - `packages/cli/src/diagnostics/*`

- Public API 변경 여부:
  - CLI 사용자 표면(출력/exit code/산출물 집합/파일 내용)은 변경된다 → **있음**
  - 패키지 export surface(`packages/cli/index.ts`)는 변경 가능성 있음(단, 필요 최소)

- 아키텍처 영향 여부:
  - L1/L2 수준 제약(특히 런타임에 metadata/container 접근 경로 금지)과 직접 충돌하는 구현을 바꿔야 하므로 **영향 있음**

---

## 1) 기대효과

- CLI가 스펙 기반으로 기계적 검증 가능한 산출물/진단을 생성한다.
- 런타임이 구조 재판정/메타데이터 접근/IoC 컨테이너 해석에 의존하지 않도록(또는 그 경로가 존재하지 않도록) 만든다.

---

## 2) 범위(Scope) / 비범위(Non-Goals)

### Scope (README 제외)

1. AOT / AST (aot-ast.spec.md) 정합

- Build profile 규칙 준수
  - minimal: Manifest만
  - standard: Manifest + Interface Catalog
  - full: Manifest + Interface Catalog + Runtime Observation Artifact
- Build profile 입력(추가): CLI argument로 설정 가능
  - 지원 형태:
    - `--profile xxx`
    - `--profile=xxx`
  - 우선순위:
    - CLI argument `--profile`가 있으면 resolved config(`config.compiler.profile`)보다 우선
    - 없으면 config 값을 사용
    - 둘 다 없으면 `full`
  - 허용값은 BuildProfile(`minimal|standard|full`)로 제한하며, 그 외는 진단으로 실패
- 산출물 루트: `<PROJECT_ROOT>/.bunner` 고정
- 실패/위반은 diagnostics.spec.md 형식으로 관측

2. Manifest (manifest.spec.md) 정합

- Manifest JSON(UTF-8) 생성
- BunnerManifest 형상 정확 일치
- 정렬 규칙 준수 (`modules`, `diGraph.nodes`, `handlerIndex`)
- adapterStaticSpecs/handlerIndex/diGraph 누락 금지
  - (결정) adapterStaticSpecs/handlerIndex의 “실제 채움(정적 판정 기반 생성)”은 이번 작업에서 **미구현으로 남긴다**.
    - 단, Manifest 필드 자체는 유지(누락 금지)하고, 값은 현재 수준(빈 객체/빈 배열)에서 고정될 수 있다.

3. Module System (module-system.spec.md) 정합

- module name 규칙:
  - 모듈 루트 파일에서 모듈 이름이 string literal로 선언되어 있고 빌드 타임에 정적으로 판정 가능한 경우, 모듈 이름은 해당 값
  - 그 외의 경우, 모듈 이름은 basename(rootDir)
- 모듈 귀속 규칙 만족 (프레임워크-인식 대상 파일은 정확히 1개의 모듈)
- orphan 처리(귀속 불가)는 빌드 실패로 관측

4. Diagnostics (diagnostics.spec.md) 정합

- 실패 시 최소 1개 Diagnostic
- DiagnosticMessageText, 보존 규칙(부분문자열 포함) 충족
- 출력 결정성(정렬) 보장
- raw error 출력 등 비결정 요인 제거

5. DevTools Runtime Report (devtools.spec.md) 정합

- runtime-report.json의 파일 경로는 고정(`.bunner/runtime-report.json`).
- (결정) runtime-report의 내용은 이번 작업에서 **placeholder(최소 스키마)만 유지**하며, adapters 항목 실제 채움은 미구현으로 남긴다.

6. Docs Interface Catalog (docs.spec.md) 정합

- interface-catalog.json의 파일 경로는 고정(`.bunner/interface-catalog.json`).
- (결정) Interface Catalog의 entries 실제 생성은 이번 작업에서 **미구현으로 남긴다**.

7. L1/L2 불변식 정합

- Metadata Volatility: 부트스트랩 이후 metadata 접근 경로 제거
- Static DI Wiring / No IoC container: 런타임에 탐색/해결 컨테이너 경로 제거
- Fail-fast / Explicitness Over Guesses: 모호함/오류 삼킴 금지

### Non-Goals

- README류 문서 변경(루트 README 및 docs/90_REFERENCE README) 전부 제외
- 어댑터 기반 정적 판정/산출(예: adapterStaticSpecs 실제 생성, handlerIndex 실제 생성, Interface Catalog entries 실제 생성, runtime-report adapters 실제 생성)
- 신규 기능(새 command 추가 등) 도입은 정합에 필요한 최소만
- 패키지 분리/대규모 재구성(별도 승인 필요)

---

## 3) SSOT 확인 기록

- L1: `docs/10_FOUNDATION/INVARIANTS.md` (Metadata Volatility, Static DI Wiring, Fail-fast)
- L2: `docs/20_ARCHITECTURE/ARCHITECTURE.md` (Build-time authority / Runtime determinism)
- L3: `docs/30_SPEC/aot-ast.spec.md`, `manifest.spec.md`, `module-system.spec.md`, `diagnostics.spec.md`, `devtools.spec.md`, `docs.spec.md`
- L4: `docs/40_ENGINEERING/STYLEGUIDE.md`, `TESTING.md`, `VERIFY.md` (구현 단계에서 재확인)

---

## 4) 작업 설계(선택지/결정)

## Decisions (논의 결과 반영)

- Build profile 산출물 정책: **A (엄격 적용)**
  - `.bunner`에는 profile별로 L3가 요구하는 산출물만 생성한다.
  - 따라서 현재 코드가 생성하는 `.bunner/entry.*`, `.bunner/runtime.*`는 profile 산출물 집합에서 제거(미생성)된다.

- ModuleName 규칙: **module-system.spec.md를 그대로 따른다**
  - 모듈 루트 파일에 빌드 타임에 정적으로 판정 가능한 string literal 모듈 이름 선언이 있으면 해당 값을 사용한다.
  - 그 외에는 모듈 루트 디렉토리 basename을 사용한다.

- (추가 결정) O1-b 진행 방향
  - "스펙 공백/충돌은 스펙을 채워서 해결" 원칙을 따른다.
  - 단, SSOT 문서(`docs/**`) 변경은 **승인 토큰 없이는 불가**이므로, 토큰이 제공되기 전까지는 O1-b(스펙 변경)를 **blocked** 상태로 둔다.

- (추가 결정) Build profile은 CLI argument로도 설정 가능
  - `bunner dev --profile ...`
  - `bunner build --profile ...`
  - `--profile`는 AOT 결정성 입력에 포함되는 것으로 취급한다(동일 입력 정의).

## Open Issues (SSOT로부터 판정 불가/충돌 가능)

### O1) `moduleDefinition.name` 우선 규칙

- (업데이트) module-system.spec.md가 모듈 루트 파일의 모듈 이름 선언을 허용하는 형태로 정렬되었다.
  - 따라서 본 Plan은 최신 SPEC을 그대로 따른다.
  - 단, 모듈 이름은 **빌드 타임에 정적으로 판정 가능한 string literal**이어야 하며, 그렇지 않으면 빌드 실패로 관측되어야 한다.

### O2) `adapterStaticSpecs` / `handlerIndex` / Interface Catalog 입력의 “소스”

- adapter.spec.md 및 manifest.spec.md는 `adapterStaticSpecs`와 `handlerIndex`를 Manifest에 포함하라고 요구한다.
- 그러나 "CLI가 어댑터별 Controller/Handler 데코레이터 이름(`entryDecorators`)과 지원 lifecycle 집합(`supportedMiddlewareLifecycles`), pipeline(특히 dispatcher)"을 **어디서 어떻게 취득하는지**에 대한 계약(파일 위치/표준 export 이름/로드 방식)이 현행 L3 문서들에서 명시적으로 고정되어 있지 않다.

→ (결정) 어댑터 관련 질문은 패스하며, 본 작업에서는 **미구현으로 남긴다**.

### O3) Runtime Observation Artifact(`runtime-report.json`) 생성 시점

- devtools.spec.md의 runtime-report는 런타임 상태 필드를 포함한다.
- aot-ast.spec.md는 build profile full에서 Runtime Observation Artifact 생성을 요구한다.

→ (결정) 어댑터 관련 질문은 패스하며, 본 작업에서는 **placeholder(최소 스키마)만 유지**한다.

### (기록) 기존 질문의 정리

- build profile 규칙은 SPEC에 명시되어 있으며, 본 Plan에서는 “코드가 이를 위반하고 있어 정렬이 필요”한 이유로만 언급한다.
- 본 Plan의 기준은 **기존 코드가 아니라 SSOT(L1/L2/L3)**이며, 기존 코드는 변경 대상(현상)일 뿐 판단 기준이 아니다.

---

## 5) 실행 계획

### Step 0) CLI argument 파싱 추가(`--profile`)

- 목표:
  - `bunner dev/build`에서 `--profile xxx` / `--profile=xxx` 파싱
  - `--profile` 값이 있으면 config보다 우선 적용
  - 허용값 외 입력은 diagnostics로 실패
- 변경 후보:
  - `packages/cli/src/bin/bunner.ts`
  - `packages/cli/src/commands/{dev.command.ts,build.command.ts}`

### Step 1) 실패/진단 경로 정합화

- 목표:
  - CLI 실패는 항상 diagnostics.spec.md 형식(JSON)만 출력
  - raw error/stack 출력 제거
  - 결정적 정렬/보존 규칙 충족
- 변경 후보:
  - `packages/cli/src/bin/bunner.ts`
  - `packages/cli/src/diagnostics/*`

### Step 2) Build profile 산출물 집합 정합

- 목표:
  - minimal/standard/full에 따라 생성 파일 집합을 정확히 제한
  - 산출물 루트 `.bunner` 고정
- 변경 후보:
  - `packages/cli/src/commands/dev.command.ts`
  - `packages/cli/src/commands/build.command.ts`

### Step 3) Manifest 형상 완성

- 목표:
  - BunnerManifest에 대해 필수 필드 누락/더미 고정 제거
  - 정렬 규칙 만족
- 변경 후보:
  - `packages/cli/src/generator/manifest.ts`

### Step 4) Module System 규칙 정합

- 목표:
  - module name은 module-system.spec.md 규칙을 따른다.
    - 모듈 루트 파일에 빌드 타임에 정적으로 판정 가능한 string literal 모듈 이름 선언이 있으면 해당 값을 사용한다.
    - 그 외에는 basename(rootDir)을 사용한다.
  - orphan(귀속 실패) 발생 시 빌드 실패(진단)
- 변경 후보:
  - `packages/cli/src/analyzer/graph/module-graph.ts`
  - `packages/cli/src/analyzer/module-discovery.ts`

### Step 5) DevTools Runtime Report / Interface Catalog 실제 생성

- 목표:
  - runtime-report.json / interface-catalog.json을 **고정 경로로 생성**하되, 내용은 placeholder(최소 스키마)만 유지
- 변경 후보:
  - `packages/cli/src/commands/*` 및 필요 시 새 generator

### Step 6) L1/L2 위반 경로 제거(특히 runtime metadata/container)

- 목표:
  - 부트스트랩 이후 metadata 접근 경로가 존재하지 않도록 구조 변경
  - 런타임 IoC 컨테이너 경로 제거
- 변경 후보:
  - `packages/cli/src/generator/entry.ts`
  - `packages/cli/src/generator/manifest.ts` (runtime 코드 생성 부분)

---

## 6) 검증 / 완료 조건

- [ ] `bun run verify` 통과
- [ ] README 변경 없음
- [ ] 스펙 MUST 항목(각 spec의 Violation Conditions 기준) 미충족 없음

---

## 7) 리스크 / 롤백

- 리스크:
  - 산출물 집합 축소/변경으로 인해 기존 개발 플로우가 깨질 수 있음(단, README는 이번 범위 밖)
  - adapterStaticSpecs/handlerIndex 구현 난이도: 필요한 정적 판정 입력이 현재 analyzer에 충분치 않을 수 있음

- 롤백:
  - 단계별 PR 또는 단계별 커밋(구현 단계에서)

---

## 논의 질문 (승인 전 확정 필요)

1. Build profile 규칙을 엄격 적용할 때, `.bunner/entry.*` 및 `.bunner/runtime.*`는 어떤 프로파일에서도 생성하면 안 되는가?
   - 현재 스펙 문구는 “minimal은 Manifest만 생성”으로 읽히므로, 다른 산출물 생성은 위반 가능성이 큼.

2. `adapterStaticSpecs`와 `handlerIndex`의 “최소 유효 구현” 범위를 어디까지로 할까?
   - 예: 현재는 `{}`/`[]` 고정인데, 이는 ‘누락은 아님’이지만 ‘정적 결과 포함’ 요구를 만족한다고 볼 수 없음.

3. Interface Catalog 생성에 필요한 입력을 무엇으로 제한할까?
   - 현재 analyzer는 Decorator/Method 정보가 있으나, adapter.spec.md의 Handler 판정 규칙과 정확 매핑이 필요.

4. DevTools runtime-report는 런타임 산출물인데, CLI가 “빌드 타임에 생성”하는 full profile 산출물로서 어떤 값들을 채울 수 있는가?
   - isAttached/isRunning/boundHandlers/options는 런타임 이벤트 기반으로 보이므로, 빌드 타임 생성이 가능한지 재검토 필요.
