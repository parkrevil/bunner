---
status: implemented
allowed_paths:
  - docs/**
  - packages/**
  - tooling/**
---

# Run Plan

## 0) Metadata (필수)

- Plan ID: `260121_01_adapter-contract-dx`
- Created at (UTC): unknown
- Owner: unknown
- Target branch: `main`

### Persona / Handshake

- Persona:
  - `@Architect`

- Handshake (AGENTS.md 형식 그대로):
  - "페르소나 **@Architect**로서 작업을 시작합니다. **AGENTS.md (E0)**에 명시된 행동 제한 규약을 숙지하였으며, 작업 도중 불확실성 발생 시 즉시 중단(STOP IF UNCERTAIN)할 것을 서약합니다."

## 1) 원문(사용자 입력) (필수)

- 원문:
  - "어댑터 제작자를 위한 수단…defineAdapter…최소 사양"
  - "DX가 매우중요하다 모든 방법을 말해봐라"
  - "어댑터는 CLI 에서 분석한 컨트롤러와 핸들러의 정보를 가져와서 핸들러마다의 파이프라인을 구성해야한다"
  - "ClassDecorator, MethodDecorator 타입 그대로 받게 해라"
  - "미들웨어 라이프사이클 대신 미들웨어 페이즈로 전면 교체해라"
  - "어댑터 계획파일 생성하고 작성"

- 에이전트 해석(검증 가능하게):
  - 무엇을 변경하는가:
    - L3 스펙에 어댑터 등록 입력(defineAdapter)과 어댑터 정적 명세(adapterSpec) 수집 규칙을 고정한다.
    - 미들웨어 관련 용어를 "Middleware Phase"로 SSOT 전역에서 단일화한다.
    - Controller/Handler 엔트리 판정 입력을 DX 친화적으로 고정한다(Controller는 단일, Handler는 리스트).
    - 미들웨어 배치(phase 기반) 규칙을 빌드 타임 판정 입력으로 고정해, 프레임워크/CLI가 결정적으로 조립할 수 있게 한다.
    - 이후 구현 작업(별도 승인/별도 실행)에서 CLI가 adapterSpec을 수집해 Manifest의 adapterStaticSpecs 및 handlerIndex를 채울 수 있는 기반을 만든다.
  - 성공 조건은 무엇인가:
    - SSOT(L1/L3)에서 어댑터 등록 입력이 기계적 판정 가능하도록 고정된다.
    - "Middleware Lifecycle" 용어가 SSOT 전역에서 제거되고 "Middleware Phase"로 일관된다.
    - (구현 포함 시) CLI가 adapterSpec/handlerIndex를 생성하고 `bun run verify`를 통과한다.
  - 명시적 제약:
    - 문서 규율(DOCS_WRITING.md)의 decidable 규칙만 사용한다.
    - 새 용어는 GLOSSARY 또는 문서 Definitions에 정합되게 반영되어야 한다.

- SSOT 충돌 여부: none

---

## 2) Spec Binding (필수)

- Primary specs/refs (planned):
  - docs/30_SPEC/adapter.spec.md
  - docs/30_SPEC/manifest.spec.md
  - docs/30_SPEC/module-system.spec.md
  - docs/30_SPEC/common.spec.md
  - docs/10_FOUNDATION/GLOSSARY.md

## 3) Open Questions (STOP 후보)

- none

## 4) SPEC MUST SNAPSHOT (필수, 원문 복사)

- none

---

## 1) 기대효과

- 어댑터 제작자가 “정해진 심플한 틀” 내에서 defineAdapter로 가장 짧은 경로로 등록 가능
- CLI/분석기/생성기가 어댑터 정적 명세를 결정적으로 수집 가능
- 미들웨어 용어/필드명이 SSOT 전역에서 단일화되어 혼란 감소

---

## 6) 범위(Scope) / 비범위(Non-Goals) (필수)

### Scope

- SSOT 문서 정합:
  - docs/10_FOUNDATION/GLOSSARY.md: Middleware Phase 단일화 및 관련 용어 보강
  - docs/30_SPEC/module-system.spec.md: MiddlewarePhaseId 및 미들웨어 등록 키 규칙 정합
  - docs/30_SPEC/common.spec.md: @Middlewares 선언 입력 필드/시그니처 정합(phaseId)
  - docs/30_SPEC/adapter.spec.md: adapterSpec/defineAdapter 입력 및 entryDecorators 타입 규칙 정합
  - docs/30_SPEC/manifest.spec.md: AdapterStaticSpec 직렬화 스키마 정합

- 계획 문서:
  - 새 어댑터 작업 계획 문서 생성(본 파일)

- (후속 구현 계획 포함):
  - CLI가 `adapterSpec`을 수집하여 Manifest의 `adapterStaticSpecs` 및 `handlerIndex`를 채우는 구현 단계 정의

### Non-Goals

- 어댑터 런타임(프로토콜 구현) 상세 설계
- 런타임에서의 동적 추론/재구성(Execution 모델 위반)
- 새로운 SSOT 산출물(예: HandlerPlan) 도입
- (범위 제한) 본 Plan에서 “새 어댑터 패키지/예제 어댑터”를 추가로 제작하지 않는다

---

## 3) SSOT 확인 기록

- FOUNDATION:
  - docs/10_FOUNDATION/SSOT_HIERARCHY.md
  - docs/10_FOUNDATION/GLOSSARY.md
- SPEC:
  - docs/30_SPEC/SPEC.md
  - docs/30_SPEC/adapter.spec.md
  - docs/30_SPEC/manifest.spec.md
  - docs/30_SPEC/module-system.spec.md
  - docs/30_SPEC/common.spec.md
- GOVERNANCE:
  - docs/50_GOVERNANCE/DOCS_WRITING.md
  - docs/50_GOVERNANCE/OVERVIEW.md

---

## 4) 작업 설계(선택지/결정)

- 결정 1) 미들웨어 용어 단일화
  - 선택: Middleware Phase
  - 범위: 용어, 타입명, 필드명, 규칙 문구

- 결정 2) entryDecorators 입력
  - controller: 단일
  - handler: 리스트
  - 타입 표현: ClassDecorator / MethodDecorator
  - 정규화 결과: common.spec.md의 DecoratorRef로 표현

- 결정 3) adapterSpec 수집 경로
  - adapterSpec은 defineAdapter 호출 표현으로 빌드 타임 결정적으로 수집 가능해야 함

- 결정 4) 미들웨어 배치 규칙의 판정 입력
  - 선택: `middlewarePhaseOrder`를 Adapter Static Spec에 추가
  - 의미: phase id 기반 실행 순서를 정적으로 고정
  - 효과: CLI/생성기가 module-system 및 데코레이터 입력을 phase 단위로 합성한 뒤, phase order에 따라 결정적으로 wiring 가능

---

## 9) 실행 계획 (Step Gates, 필수)

### Step 1) SSOT 용어/형상 정렬

- 작업 내용:
  - Middleware Lifecycle 관련 용어를 전부 제거하고 Middleware Phase로 통일
  - common/module-system/adapter/manifest 간 참조명 및 스키마 정합
  - Adapter Static Spec에 `middlewarePhaseOrder`를 추가하고, middleware phase 기반 배치 규칙을 결정적으로 고정
  - 문서 규율 위반(DW-TERM-001 등) 발생 여부 점검

- 중간 검증:
  - docs/\*\* 전체에서 금지 용어("MiddlewareLifecycleId", "supportedMiddlewareLifecycles", "lifecycleId" 등) 잔존 0건
  - docs/30_SPEC/adapter.spec.md 및 docs/30_SPEC/manifest.spec.md에서 `middlewarePhaseOrder` 스키마 정합 확인
  - docs/30_SPEC/adapter.spec.md 및 docs/30_SPEC/manifest.spec.md에서 `supportedMiddlewarePhases`의 key가 MiddlewarePhaseId로 정의되어 있음 확인
  - `pipeline.middlewares.length`와 `middlewarePhaseOrder.length` 불일치가 위반 조건으로 존재함 확인

- 진행 체크리스트:
  - [x] 금지 용어 잔존 0건 확인
  - [x] `middlewarePhaseOrder` 스키마 정합 확인
  - [x] `supportedMiddlewarePhases` key가 MiddlewarePhaseId로 정의됨 확인
  - [x] `pipeline.middlewares.length` 제약 조건 명시 확인

### Step 2) (후속) 구현 착수 준비

---

## 10) 검증 매트릭스 (MUST → Evidence, 필수)

- none

- 작업 내용:
  - Step 2는 문서/체크리스트 정리 단계로서 코드 변경을 수행하지 않는다.
  - 대신 “구현자가 착수할 때 막히는 지점”이 없도록, 구현 체크리스트 및 구현 단계(파일/산출물/검증)를 문서화한다.

- 구현 체크리스트(향후 CLI/생성기 작업자가 충족해야 하는 항목):
  - Adapter 수집:
    - 어댑터 패키지 루트 entry file에서 named export `adapterSpec`을 수집한다.
    - `adapterSpec`은 `defineAdapter(<AdapterClassRef>)` 호출 표현이어야 한다.
    - `<AdapterClassRef>`는 클래스 선언을 참조하는 Identifier reference여야 한다.

  - AdapterClass 정적 필드 판정:
    - `adapterId`: string literal로 직접 판정 가능
    - `pipeline`: object literal 또는 “단일 return object literal”인 static method
    - `entryDecorators`: object literal로 직접 판정 가능
    - `supportedMiddlewarePhases`: SupportedMiddlewarePhaseSet 형상(object literal)으로 직접 판정 가능
    - `middlewarePhaseOrder`: string literal array로 직접 판정 가능 + 중복 금지

  - middleware 합성/배치(빌드 타임):
    - 입력 합성 순서: module-system → controller decorator → handler decorator
    - 중복 제거 금지, 입력 소스 내부 순서 보존
    - phase 순서는 `middlewarePhaseOrder`를 따른다.
    - `pipeline.middlewares`는 phase dispatcher 리스트이며, 길이는 `middlewarePhaseOrder`와 동일해야 한다.

  - 빌드 실패(위반) 판정:
    - 등록/데코레이터에 등장한 phase id가 `supportedMiddlewarePhases`에 없으면 실패
    - `middlewarePhaseOrder` 누락 또는 중복 존재 시 실패
    - `pipeline.middlewares.length !== middlewarePhaseOrder.length` 인데도 성공하면 위반

- 구현 착수 시 추가 확인(SSOT 정합성):
  - module-system.spec.md 및 adapter.spec.md의 문구에 "lifecycle" 잔여가 없는지 재확인(Phase 단일화 후속 정리 필요 시 별도 승인 후 처리)

- 진행 체크리스트:
  - [x] 구현 체크리스트 및 구현 단계 문서화 완료
  - [x] 구현 착수 시 추가 확인 항목 정리 완료

### Step 3) (구현) CLI가 adapterSpec/handlerIndex를 생성

> Step 3는 packages/\*\* 코드 변경을 포함한다.
> 실제 구현 착수는 사용자 승인 아티팩트(토큰) 후에만 수행한다.

- 목표(검증 가능):
  - CLI가 빌드 타임에 `adapterSpec`을 수집/판정하여 Manifest의 `adapterStaticSpecs`를 채운다.
  - CLI가 빌드 타임에 Handler(Controller class method) 후보를 판정하여 Manifest의 `handlerIndex`를 채운다.
  - 위 산출물은 결정적이며(동일 입력 → 동일 출력), 런타임에서 수정/접근 경로가 없다.

#### Step 3 - CLI 입력/게이트(추측 금지)

- 입력 집합(결정적 추적):
  - “어댑터 패키지 루트 entry file 집합”은 컴파일러/CLI가 TS 파싱으로 만든 import graph를 따라 결정적으로 구성한다.
  - 시작점은 CLI가 이미 스캔/분석하는 프로젝트 파일 집합(예: config의 scanPaths 및 module root file 등)으로 고정한다.
  - import graph에서 발견되는 non-relative import specifier(패키지 import)들을 대상으로, 각 패키지의 루트 entry file을 resolve한다.
  - resolve된 패키지 루트 entry file에서 named export `adapterSpec`을(직접 export 또는 re-export 체인 포함) 수집한다.
  - 위 수집 결과가 Step 3의 “어댑터 패키지 루트 entry file 집합”이다.

- CLI-only 범위 선언:
  - Step 3는 CLI가 읽는 입력/산출물(Manifest JSON)만 구현한다.
  - 어댑터 패키지(예: http-adapter)에 `adapterSpec` export가 아직 없다면, CLI는 이를 추론/대체해서는 안 된다.

#### Step 3 - 결정성(정렬/정규화) 세부

- adapterStaticSpecs 정렬/결정성:
  - adapterId 기준(코드포인트 정렬)으로 key 순서를 결정한다.
  - 동일 adapterId가 2개 이상에서 발견되면 빌드 실패가 관측되어야 한다(충돌은 비결정성 원인).

- handlerIndex 정규화:
  - `HandlerId`는 diagnostics.spec.md 형식 `"<adapterId>:<file>#<controllerClassName>.<handlerMethodName>"`를 사용한다.
  - `<file>`는 프로젝트 루트 기준 정규화된 상대 경로로 생성한다.
  - handlerIndex는 (1) adapterId, (2) file, (3) symbol 순서로 결정적으로 정렬한다.

#### Step 3 - 진단(실패 조건) 최소 규칙

- adapterSpec을 발견했지만 판정 규칙을 만족하지 않으면 빌드 실패가 관측되어야 한다.
  - 예: `defineAdapter` 호출이 아님, `<AdapterClassRef>`가 Identifier가 아님, 필수 static field를 판정할 수 없음
- 수집 결과가 0개(발견된 adapterSpec이 없음)인 경우:
  - 빌드 실패가 관측되어야 한다(진단 출력은 diagnostics.spec.md를 따른다).

- 변경 대상(예상):
  - packages/cli/src/analyzer/\*\*
    - `adapterSpec`(defineAdapter 호출) 수집을 위한 분석 루틴 추가
  - packages/cli/src/generator/manifest.ts
    - `adapterStaticSpecs`, `handlerIndex`를 비어있지 않게 생성하도록 구현
  - packages/cli/src/generator/interfaces.ts
    - `ManifestJsonParams`에 analyzer 결과(예: adapterStaticSpecs/handlerIndex)를 전달하거나,
      generator가 analyzer를 호출할 수 있는 입력을 추가

- 구현 작업 내용(기계적 단계):
  1. AdapterSpec discovery
     - 입력: 빌드 타임에 분석 가능한 “어댑터 패키지 루트 entry file” 집합
     - 처리:
       - entry file에서 named export `adapterSpec`을 찾는다.
       - `adapterSpec`의 initializer가 `defineAdapter(<AdapterClassRef>)` 호출인지 확인한다.
       - `<AdapterClassRef>`가 클래스 선언을 참조하는 Identifier인지 확인한다.

  2. AdapterClass static field extraction
     - 대상 클래스에서 아래 정적 필드를 AST-level로 판정해 Adapter Static Spec을 구성한다.
       - `adapterId`
       - `pipeline`
       - `entryDecorators`
       - `supportedMiddlewarePhases`
       - `middlewarePhaseOrder`
     - 위 필드 중 하나라도 “스펙이 요구하는 방식으로 판정 불가”면 빌드 실패로 관측되어야 한다.

  3. Handler 판정 및 `handlerIndex` 생성
     - `entryDecorators.controller`(DecoratorRef)로 Controller class 후보를 결정한다.
     - `entryDecorators.handler`(DecoratorRef[])로 Handler method 후보를 결정한다.
     - `handlerIndex`는 diagnostics.spec.md의 `HandlerId` 규칙으로 정규화된 id 리스트로 생성한다.
       - 정렬 규칙은 manifest.spec.md 정렬/결정성 규칙을 따른다.

  4. Middleware phase 기반 합성(빌드 타임) 및 `pipeline` wiring 입력 생성
     - module-system 입력 + controller decorator 입력 + handler decorator 입력을 합성한다.
     - phase 순서는 `middlewarePhaseOrder`를 따른다.
     - `pipeline.middlewares`는 phase dispatcher 리스트로써 `middlewarePhaseOrder` 길이와 1:1 대응해야 한다.
     - 위 조건이 만족되지 않으면 빌드 실패/위반 조건이 관측되어야 한다.

- 테스트/검증(구현 단계에서 추가):
  - packages/cli/src/generator/manifest.spec.ts
    - `adapterStaticSpecs`와 `handlerIndex`가 빈 값이 아니며, 결정적 정렬이 유지되는지 테스트
  - adapterSpec 수집/파싱 유닛 테스트(새 파일 가능)
    - `defineAdapter(Identifier)`만 허용, string literal/static field 판정 실패 케이스 검증

- 진행 체크리스트:
  - [x] 사용자 승인 아티팩트(토큰) 확보
  - [x] CLI 분석/생성 로직 구현
  - [x] 테스트 추가 및 `bun run verify` 통과

---

## 6) 검증 / 완료 조건

- (문서)
  - [x] SSOT 전역 용어 단일화(금지 용어 0건)
  - [x] L3 문서 간 참조 일관성 유지
  - [x] DOCS_WRITING 규율 위반 없음

- (구현, Step 3 수행 시)
  - [x] `bun run verify` 통과
  - [x] CLI 산출물(Manifest)의 `adapterStaticSpecs` / `handlerIndex`가 spec 형상과 정렬 규칙을 만족
  - [x] 동일 입력에서 결과가 결정적(순서/내용 변동 없음)

---

## 7) 리스크 / 롤백

- 리스크:
  - 용어/필드명 변경으로 인해 후속 구현(코드)에서 대량 치환이 필요할 수 있음
  - adapterSpec/handlerIndex의 소스(분석 대상 entry file 집합)가 좁게/넓게 잡히면 DX가 흔들릴 수 있음

- 롤백:
  - SSOT 문서 변경 단위로 되돌림
  - 구현 변경은 CLI 패키지 단위로 되돌림
