---
status: draft
allowed_paths:
  - docs/**
  - packages/**
  - examples/**
  - tooling/**
---

# Run Plan

## 0) Metadata (필수)

- Plan ID: `260121_02_define-adapter_http-adapter_dx-plan`
- Created at (UTC): `<not specified in original plan>`
- Owner: `<not specified in original plan>`
- Related: `<not specified in original plan>`
- Target branch: `main`
- Tooling constraints (선택): `<not specified in original plan>`

## 0) Persona / Handshake (필수)

- Persona:
  - `@Implementer`

- Handshake (AGENTS.md 형식 그대로):
  - "페르소나 **@Implementer**로서 작업을 시작합니다. **AGENTS.md (E0)**에 명시된 행동 제한 규약을 숙지하였으며, 작업 도중 불확실성 발생 시 즉시 중단(STOP IF UNCERTAIN)할 것을 서약합니다."

---

## 1) 원문(사용자 입력) (필수)

- 원문:
  - "아니 defineAdapter 와 Adapter 구현 인터페이스, HTTP Adapter 에 적용까지 계획을 시작한다. 논의해야하며 DX를 최우선으로 한다. 어댑터 제작자에게 명확하고 직관적인 틀을 제공해야한다"

- 에이전트 해석(검증 가능하게):
  - 무엇을 변경하는가:
    - (계약) `defineAdapter` / `adapterSpec` / 어댑터 등록 DX(파이프라인 skeleton, phase enum, decorators 확장, classRef 강제) 및 실행 모델(dispatch) 을 DX 우선으로 확정한다.
    - (적용) `@bunner/http-adapter`가 위 계약을 충족하는 `adapterSpec`을 패키지 루트 엔트리에서 제공하도록 한다.
  - 성공 조건은 무엇인가:
    - 어댑터 제작자 관점에서 “최소한의 보일러플레이트 + 기계적 판정 가능”한 등록 틀이 확정된다.
    - CLI가 `@bunner/http-adapter` 패키지 루트 entry file의 `adapterSpec`을 빌드 타임에 결정적으로 수집 가능하다.
    - 프레임워크(빌드 타임)가 Handler별 실행 파이프라인(HandlerExecutionPlan)을 결정적으로 조립하고, 런타임은 `dispatch(handlerId, ctx, input)` 경로로만 실행된다.
  - 명시적 제약:
    - L1/L2: 빌드 타임 판정(추측 금지), 결정성, 경계/Facade 원칙 준수.
    - L3: `adapter.spec.md`, `manifest.spec.md`, `common.spec.md`, `module-system.spec.md`, `app.spec.md` 계약과 정합.

- SSOT 충돌 여부:
  - [ ] 없음
  - [ ] 있음 → 충돌 지점 식별 후 즉시 중단

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

## 1) 목적 / 기대효과 (필수)

- One-liner goal:
  - `defineAdapter`/`adapterSpec` 기반 어댑터 등록 계약(DX 우선)을 확정하고, `@bunner/http-adapter`에 적용한다.

- Success definition(간단):
  - 어댑터 제작자 관점에서 “최소 보일러플레이트 + 기계적 판정 가능”한 등록 틀이 확정되고,
    CLI가 `@bunner/http-adapter`의 `adapterSpec`을 빌드 타임에 결정적으로 수집할 수 있어야 한다.

- 기대효과:

- 어댑터 제작자가 “정해진 한 가지 방법”으로 빠르게 등록 가능 (`adapterSpec` + `defineAdapter`).
- HTTP Adapter가 SSOT 기반 정적 스펙을 제공하여 CLI/DevTools 파이프라인에 편입된다.
- (후속) 다른 프로토콜 어댑터도 동일한 DX 템플릿으로 제작 가능.

---

## 6) 범위(Scope) / 비범위(Non-Goals) (필수)

### Scope

- 계약/문서 정렬(필요 시):
  - `docs/30_SPEC/adapter.spec.md`: 어댑터 등록 DX(phase enum, pipeline skeleton DSL, decorators 확장, classRef 강제) 및 실행 모델(dispatch/handlerId)로 재정의.
  - `docs/30_SPEC/app.spec.md`: `attachAdapter` 및 `app.start/stop`과 어댑터 runtime 호출 관측 규칙의 정합 확인.
  - `docs/30_SPEC/manifest.spec.md`: `adapterStaticSpecs`의 구성 규칙(AdapterConfig 기반 key 집합 및 adapterName 매핑)과 어댑터 등록 입력(`AdapterRegistrationInput.name`)의 정합 확인.
  - `docs/10_FOUNDATION/GLOSSARY.md`: “Middleware Phase” 용어가 구현/스펙/패키지 API와 일치하도록 정합.

- 구현 적용(후속 Implementer 단계로 명시):
  - `packages/http-adapter/index.ts`: `adapterSpec` named export 제공.
  - `packages/http-adapter/**`: phase enum 및 pipeline skeleton 기반으로 ingress/selector/egress 및 dispatch 호출 흐름을 정리.
  - `packages/common` 또는 `packages/core`: 어댑터 제작자가 import 할 `defineAdapter` 공개 Facade 제공(정확한 위치는 설계에서 결정).

- 영향 범위 선언(사실 기술):
  - 영향 가능 패키지/모듈: `packages/http-adapter`, `packages/common` 또는 `packages/core`, CLI(AOT analyzer)
  - Public Facade 변경: 있음(후보: `defineAdapter` 공개)
  - 패키지 의존 변경: `<not specified in original plan>`
  - 런타임 동작 변경(사용자 관점): 있음(HTTP Adapter 실행/파이프라인/dispatch 접합)
  - 설정/CLI 인터페이스 변경: 있음(빌드 타임 수집/해석)
  - 마이그레이션 필요: 있음(Breaking 가능성 언급)

### Non-Goals

- 전 어댑터 패키지 일괄 마이그레이션.
- 런타임 실행 엔진 전체 교체.

---

## 3) 불변조건 / 제약 (Gate, 필수)

### Hard Constraints (승인 없이는 절대 수행 금지)

- [ ] SSOT(docs/10..50/\*\*) 의미 변경 없음
  - 본 Plan은 필요 시 L3/L1 문서 수정 가능성을 포함하므로, 의미 변경이 필요해지면 승인 요청 후 STOP.
- [ ] Public Facade(packages/\*/index.ts export) 변경 없음
  - 본 Plan은 `defineAdapter` 공개 Facade 제공을 포함하므로, Public Facade 변경은 승인 필요.
- [ ] deps(package.json deps) 변경 없음
  - `<not specified in original plan>`

### Invariants (이번 작업 불변식)

- L1/L2: 빌드 타임 판정(추측 금지), 결정성, 경계/Facade 원칙 준수.
- L3: `adapter.spec.md`, `manifest.spec.md`, `common.spec.md`, `module-system.spec.md`, `app.spec.md` 계약과 정합.
- `defineAdapter`는 빌드 타임 수집 마커이며 런타임 로직이 아니다.
- 런타임 실행 진입점은 `dispatch(handlerId, ctx, input)`로 고정한다.

### Stop Conditions (불확실성/충돌)

- SSOT 충돌 지점이 식별되면 즉시 중단하고 논의한다.
- 신규 패키지 도입 등 L2 판단이 추가로 필요해지는 경우 즉시 중단하고 합의를 요청한다.

---

## 4) SSOT 확인 기록 (필수)

> 확인 기록만 남긴다(판정/해석 금지).

- FOUNDATION:
  - `docs/10_FOUNDATION/INVARIANTS.md`
  - `docs/10_FOUNDATION/GLOSSARY.md`
- ARCHITECTURE:
  - `docs/20_ARCHITECTURE/ARCHITECTURE.md`
  - `docs/20_ARCHITECTURE/STRUCTURE.md`
- SPEC:
  - `docs/30_SPEC/adapter.spec.md`
  - `docs/30_SPEC/manifest.spec.md`
  - `docs/30_SPEC/common.spec.md`
  - `docs/30_SPEC/module-system.spec.md`
  - `docs/30_SPEC/app.spec.md`

---

## 5) 요구사항 / 수용 기준 (Acceptance Criteria, 필수)

### Functional

- AC1: 어댑터 제작자 관점에서 “정해진 한 가지 방법”으로 등록 가능해야 한다. (`adapterSpec` + `defineAdapter`)
- AC2: CLI가 `@bunner/http-adapter` 패키지 루트 entry file의 `adapterSpec`을 빌드 타임에 결정적으로 수집 가능해야 한다.
- AC3: 빌드 타임(프레임워크)이 Handler별 실행 파이프라인(HandlerExecutionPlan)을 결정적으로 조립하고, 런타임은 `dispatch(handlerId, ctx, input)` 경로로만 실행되어야 한다.

### Error/Edge

- AC-E1: Controller 데코레이터의 `adapterIds`는 생략 가능하며, 생략 시 “all”로 정규화되어야 한다(빌드 실패가 아님).

### Compatibility

- AC-C1: `bunnerHttpAdapter(...)` 경로가 유지되는 경우, 새 모델과 접합되어야 한다.

### Observability (로그/진단/에러 메시지)

- AC-O1: app.spec.md의 Observable/V iolation 조건(특히 `createApplication`/`app.stop`)이 테스트 또는 검증 루틴으로 커버되어야 한다.

---

## 6) 작업 설계(선택지/결정) (필수)

### 4.0 Preflight: 현재 구현 관측(Plan 정합을 위한 기준점)

이 섹션은 “설계 결론”이 아니라, 현재 저장소의 실제 구현/테스트 기반의 관측 사실을 요약한다.

- CLI(AOT) `adapterSpec` 수집은 현재 `adapterSpec = defineAdapter(<AdapterClassRef Identifier>)` 형태를 전제로 한다.
- CLI(AOT) `pipeline` 입력은 현재 객체형(`PipelineSpec`)을 전제로 한다.
- HTTP Adapter 런타임은 현재 `method+path → handler 함수 직접 호출` 구조이며, `handlerId → dispatch(...)` 접합부가 존재하지 않는다.
- HTTP Adapter의 `Controller`/`RestController` 데코레이터는 현재 `adapterId` 옵션을 받지 않는다.
- HTTP Adapter의 `Controller`/`RestController` 데코레이터는 현재 `adapterIds` 옵션을 받지 않는다.

따라서 본 Plan이 주장하는 DX(defineAdapter object literal / pipeline skeleton DSL / controller adapterIds(없음=all, 있음=subset) / dispatch 기반 실행)로 이동하려면,
반드시 CLI·http-adapter에 대한 접합/이행 Step이 포함되어야 한다.

### 4.1 DX 최우선 결론(초안) — 논의 시작점

본 Plan은 아래 한 가지 틀을 “기본 DX”로 고정하고, 예외를 금지한다.

- **어댑터 제작자가 구현하는 것(단일 클래스)**
  - `classRef`는 필수이며, 어댑터는 `BunnerAdapter`를 상속하는 concrete class 1개로 구현한다.
  - 해당 클래스는 프로토콜 서버/리스너를 소유하고 `start/stop`을 직접 구현한다.
- **어댑터 제작자가 제공하는 것(등록 입력)**
  - (AOT) 패키지 루트 entry file에서 `adapterSpec` named export 1개
    - 역할: `adapterSpec = defineAdapter(...)` 형태로, 어댑터 정적 명세를 빌드 타임 판정 입력으로 제공.

- **`defineAdapter`는 “빌드 타임 수집 마커”이며 런타임 로직이 아니다**
  - `defineAdapter`는 런타임에서 실행 경로를 변경하는 지능/부작용을 포함해서는 안 된다.
  - 목적은 오직 `adapterSpec = defineAdapter(...)`를 TS에서 타입 안전하게 작성하도록 돕는 것이다.
  - CLI는 런타임 실행으로 `defineAdapter`를 인지하는 것이 아니라, **AST에서 호출 표현을 수집**한다.

- **Dispatcher는 어댑터가 제공하는 실행 유닛이 아니라, Core가 제공하는 공용 실행 경로로 고정한다**
  - 런타임 실행 진입점은 `dispatch(handlerId, ctx, input)`로 고정한다.
  - `protocolContext`는 별도 인자가 아니라 `ctx` 내부 필드로 포함된다.
  - 어댑터의 ingress 진입점은 항상 아래 흐름을 따른다.
    - BaseContext는 프레임워크(Core)가 생성한다.
    - 어댑터는 프로토콜 입력(req/res, socket 등)으로 BaseContext를 확장하여 `ctx`를 만든다.
    - 어댑터는 Selector로 `handlerId`를 결정하고 `dispatch(handlerId, ctx, input)`를 호출한다.

- **파이프라인은 “실행 step 목록”이 아니라 “합성/실행 순서 skeleton”이다**
  - DX는 아래 형태(순서 선언)로 고정한다.
    - `pipeline: [MiddlewarePhase.1, Guards, Pipes, Handler, MiddlewarePhase.2]`
  - Reserved token(`Guards | Pipes | Handler`)은 string literal이 아니라 **Identifier reference**로만 표현한다.
  - 어댑터는 pipeline에서 “순서”만 정한다.
  - 빌드 타임(프레임워크)이 module/controller/handler 등록 입력을 기반으로 Handler별 실행 파이프라인(HandlerExecutionPlan)을 결정적으로 조립한다.
  - 런타임은 `dispatch(handlerId, ctx, input)`만 호출한다.

### 4.2 질문별 정리(규범적 답변)

- Q1) “BunnerAdapter 구현은 강제인가?”
  - 강제한다.
  - 어댑터는 `BunnerAdapter`를 상속하는 concrete class를 제공해야 하며, `defineAdapter` 입력에서 `classRef`는 필수다.
  - `runtime.start/stop`과 같은 별도 실행 유닛 모델은 제거한다.

- Q2) “컨텍스트와 실행 흐름은?”
  - BaseContext는 프레임워크(Core)가 제공한다.
  - 어댑터는 ingress 진입점에서 프로토콜 입력을 BaseContext에 병합하여 `ctx`를 만든다.
  - `protocolContext`는 별도 인자가 아니라 `ctx` 내부에 포함된다.
  - 런타임 실행은 `dispatch(handlerId, ctx, input)`로만 수행된다.

- Q3) “데코레이터 기반 입력은 무엇을 위해 수집하나?”
  - 빌드 타임이 아래 2가지를 위해 수집한다.
    - (A) Controller/Handler 단위의 HandlerId 발급(결정적 식별자)
    - (B) 어댑터별 selector table 구성(= selectorKey → handlerId 매핑)
  - 어댑터는 `defineAdapter` 입력에서 수집 대상 데코레이터 목록을 선언한다.
    - controller/handler: 엔트리 판정(필수)
    - class/method/parameter: selectorKey 구성 입력 수집(선택)
  - 빌드 타임은 Handler별 실행 파이프라인을 조립한다(HandlerExecutionPlan 생성).

- Q4) “Controller 데코레이터에 adapterIds는?”
  - Controller 데코레이터는 어댑터가 제공한다.
  - Controller 데코레이터는 표준 옵션으로 `adapterIds?: AdapterId[]`를 지원해야 한다.
    - `adapterIds`가 생략된 경우: 해당 Controller는 해당 데코레이터(=해당 어댑터)의 모든 adapterId에 반영되어야 한다.
    - `adapterIds`가 존재하는 경우: 해당 Controller는 지정된 adapterId에만 반영되어야 한다.

### 4.3 `defineAdapter` 공개 위치: `@bunner/common`(초안)

- 이유(SSOT 정합): `defineAdapter`는 실행 엔진 기능이 아니라 **계약/선언(빌드 타임 입력)** 이다.
- `@bunner/common`에 둔다고 해서 “common이 CLI 기능을 구현”하는 것이 아니다.
  - common은 단지 TS가 컴파일 가능한 심볼(함수)을 제공한다.
  - CLI는 그 심볼의 런타임 구현을 호출하지 않고, AST에서 호출 표현을 수집한다.

대안(논의 가능): `@bunner/aot` 또는 `@bunner/contracts` 같은 순수 선언 패키지.
단, 신규 패키지는 L2 구조/의존성/배치 판단이 추가로 필요하므로, 초기 DX 슬라이스에서는 common 우선.

### 4.4 HTTP Adapter 현재 상태와 충돌(관측)

- `packages/http-adapter`는 현재 `HttpMiddlewareLifecycle` 기반이며, SSOT(L3/Glossary)는 `Middleware Phase`를 고정한다.
- App 표면은 `app.attachAdapter(AdapterId, options)`가 `app.start` 이전에 관측되어야 하며, 어댑터 실행 상태 전이는 `app.start/app.stop`에 의해 관측되어야 한다(app.spec.md).
  - 본 Plan의 목적은 “DX 최우선 등록 틀”을 만드는 것이며,
    - 단기: HTTP Adapter에 `adapterSpec`을 제공하여 CLI/Manifest 흐름에 편입
    - 중기: 런타임(core/app)와 L3의 모델 차이를 줄이는 방향으로 수렴

### 4.5 (임시) 결정

- `defineAdapter`는 `@bunner/common` Public Facade로 제공한다(마커 함수).
- `defineAdapter`의 인자는 `AdapterRegistrationInput` object literal로 고정한다.
- HTTP Adapter는 phase enum + pipeline skeleton + core dispatch 흐름을 기준으로 최소 변경 적용을 목표로 한다.

### 4.6 남은 합의(최소)

- (합의 완료) 런타임 실행 진입은 `dispatch(handlerId, ctx, input)`로 고정한다.
- (합의 완료) BaseContext는 프레임워크가 제공하고, 어댑터는 ingress에서 ctx를 확장한다(`makeContext` 훅 없음).
- (합의 완료) Controller 데코레이터의 `adapterIds`는 선택이며, 미정의는 “모든 adapterId에 반영”으로 정규화된다.
- (합의 완료) `runtime.start/stop` 모델은 제거하고, `classRef`(BunnerAdapter 구현)는 필수다.

### 4.7 Handler별 실행 파이프라인 조립(빌드 타임) — 최종 합의

- 빌드 타임은 어댑터별로 `HandlerId → HandlerExecutionPlan`(또는 동등한 generated wiring) 을 생성해야 한다.
- 조립 입력:
  - module 등록 입력(guards/pipes/middlewares/exceptionFilters)
  - controller/handler 데코레이터 입력
  - phase enum + pipeline skeleton(phase/스테이지 순서)
- 조립 산출물(개념적):
  - `middlewares`: phase별 리스트(phase 순서 고정, 동일 phase 내부는 선언 순서 보존)
  - `guards`: module → controller → handler 순서 합성
  - `pipes`: module → controller → handler 순서 합성
  - `exceptionFilters`: handler → controller → module 순서 합성
  - `handler`: 최종 실행 단위
- 런타임은 `dispatch(handlerId, ctx, input)`만 호출하며, 런타임 조립/추론은 금지한다.

### 4.8 결정 완료(Resolved) — 이 Plan의 구현 전제

아래 항목은 본 Plan의 구현 전제로 고정한다.

1. `defineAdapter` 입력 형상  
   고정: `defineAdapter(<object literal>)`

1. `pipeline` 입력 형상  
   고정: phase/order 배열(순서 선언)  
   예: `pipeline: [MiddlewarePhase.1, Guards, Pipes, Handler, MiddlewarePhase.2]`  
   고정: Reserved token(`Guards | Pipes | Handler`)은 Identifier reference로만 허용한다.

1. Controller 데코레이터의 adapterIds 의미  
   고정: Controller class에는 해당 어댑터용 Controller 데코레이터가 정확히 1개 존재해야 한다.  
   고정: `adapterIds` 생략 → “해당 데코레이터(=해당 어댑터)의 모든 adapterId에 반영”  
   고정: `adapterIds` 존재 → “지정된 adapterId에만 반영”

1. `bunnerHttpAdapter(...)` 유지/이행  
   고정: 유지(내부 구현만 새 모델로 접합)

1. `bootstrapApplication` 제거  
   고정: 제거. App-External Code는 `createApplication`을 직접 사용한다.

---

## 7) 승인 원장 (Approval Ledger, Gate)

- Need approval?: yes

### Approval Requests (작성 후 STOP)

- Request #1:
  - 유형: Public Facade 변경
  - 현재 상황(1~2줄): `defineAdapter`를 공개 Facade로 제공하는 변경이 계획에 포함됨.
  - 요청 범위(파일/패키지): `packages/common` 또는 `packages/core`의 public export (정확한 위치는 Step 2에서 결정)
  - 대안: `@bunner/aot` 또는 `@bunner/contracts` 같은 순수 선언 패키지(단, 신규 패키지는 L2 판단 필요)
  - 리스크(영향 범위): 외부 사용자 import 경로/계약 고정에 영향

- Request #2:
  - 유형: SSOT 변경
  - 현재 상황(1~2줄): 어댑터 등록 DX/실행 모델/용어 정합을 위해 L3/L1 문서 수정 가능성이 포함됨.
  - 요청 범위(파일/패키지): `docs/30_SPEC/*`, `docs/10_FOUNDATION/GLOSSARY.md`
  - 대안: none
  - 리스크(영향 범위): 계약 의미 변경으로 인한 구현/테스트/도구 체인 영향

### Approvals (승인 받은 뒤에만 채움)

- Approval #1:
  - 승인 증거: `<not specified in original plan>`
  - 승인 범위: <...>
  - 일시: <...>

---

## 9) 실행 계획 (Step Gates, 필수)

---

## 10) 검증 매트릭스 (MUST → Evidence, 필수)

- none

### Step 1) 계약 확정(DX 우선) — 논의/합의

- Objective:
  - DX 최우선 기준으로 어댑터 등록 계약(`defineAdapter`/`adapterSpec`/pipeline/dispatch/adapterIds/handlerId)을 확정한다.

- Inputs:
  - 섹션 4.0~4.8의 관측/합의/결정(특히 “AST-level 판정 가능”, “dispatch 고정”, “adapterIds 정규화”).

- Outputs:
  - DX 템플릿 1개(합의된 규범)
  - Plan Changes에 4.8 결정 완료(Resolved) 항목 append-only 기록
  - (필요 시) ADR 초안 1개: runtime 상태 전달/stop 연계 방식
  - (필요 시) L3 spec 수정안 초안(문장 단위로 decidable하게)

- Change set (예상):
  - Files:
    - `docs/30_SPEC/adapter.spec.md`: 수정(필요 시)
    - `docs/30_SPEC/app.spec.md`: 수정(필요 시)
    - `docs/10_FOUNDATION/GLOSSARY.md`: 수정(필요 시)

- Implementation notes (원문 보존):
  - 작업 내용:
    - `defineAdapter` 사용 경험을 “어댑터 제작자 관점”에서 1개 템플릿으로 고정한다.
    - pipeline(phase/order 배열) 문법과 정규화 규칙을 확정한다.
    - 실행 모델을 `dispatch(handlerId, ctx, input)`로 확정하고, ctx 확장 규칙(ingress에서 병합)을 확정한다.
    - Controller 데코레이터의 `adapterIds` 의미(없음=all, 있음=subset)를 확정한다.
    - HandlerId 발급 규칙과 selectorKey → handlerId 매핑 테이블 생성 규칙을 확정한다.
    - (필수) 4.8 결정 완료(Resolved) 항목을 Plan Changes에 append-only로 기록한다.
  - 산출물:
    - (필요 시) ADR 초안 1개: runtime 상태 전달/stop 연계 방식.
    - (필요 시) L3 spec 수정안 초안(문장 단위로 decidable하게).
    - Plan Changes에 4.8의 결론을 append-only로 기록한다.

- Verification (Gate):
  - Contract gate:
    - 계약이 “AST-level 판정 가능”하고, 추측/리플렉션을 요구하지 않음.

- Stop conditions:
  - SSOT 의미 변경이 필요하면 승인 요청 후 STOP.

- Rollback:
  - `<not specified in original plan>`

---

### Step 2) defineAdapter 공개 Facade 설계

- Objective:
  - `defineAdapter`의 공개 위치(패키지)와 반환값 정책을 결정한다.

- Inputs:
  - 섹션 4.3(초안: `@bunner/common`), 섹션 4.5(임시 결정), L2 의존성 방향.

- Outputs:
  - `defineAdapter` Public Facade 위치 결정
  - 반환값 정책 결정(런타임 의미 없음 vs 개발자 편의용 반환)

- Change set (예상):
  - Files:
    - `<not specified in original plan>`

- Implementation notes (원문 보존):
  - 작업 내용:
    - `defineAdapter`를 어느 패키지의 Public Facade로 제공할지 결정한다.
    - 반환값(런타임 의미 없음 vs 개발자 편의용 반환)을 결정한다.

- Verification (Gate):
  - L2 gate:
    - L2 의존성 방향 위반 없음.
  - Semantics gate:
    - `defineAdapter`는 빌드 타임 수집 입력이며 런타임 지능을 요구하지 않음.

- Stop conditions:
  - 신규 패키지 도입이 필요해지면 L2 판단이 추가로 필요하므로 STOP.

- Rollback:
  - `<not specified in original plan>`

### Step 2.5) createApplication 정합(필수) — app.spec.md 계약 구현/검증

- Objective:
  - app.spec.md 계약을 `createApplication`/`app.start`/`app.stop`에 정합시키고 관측 가능하게 만든다.

- Inputs:
  - `docs/30_SPEC/app.spec.md` 계약, 섹션 4.4~4.8의 전제(특히 `bootstrapApplication` 제거).

- Outputs:
  - `createApplication` 기반 부트스트랩 정합
  - (가능하면) app.spec.md의 Violation Conditions에 대응하는 테스트/검증 커버리지

- Change set (예상):
  - Files:
    - `packages/core/src/application/create-application.ts`: 수정(계약 정합 필요 시)
    - `packages/core/src/application/bootstrap-application.ts`: 삭제(bootstrapApplication 제거)
    - `packages/core/index.ts`: 수정(bootstrapApplication export 제거)
    - `packages/core/src/application/bootstrap-application.spec.ts`: 삭제 또는 수정(bootstrapApplication 제거에 맞춰 정리)
    - `README.md`: 수정(bootstrapApplication 사용 예시 제거 → createApplication로 정합)
    - `examples/src/main.ts`: 수정(bootstrapApplication 사용 예시 제거 → createApplication로 정합)
    - `docs/90_REFERENCE/README.ko.md`: 수정(bootstrapApplication 사용 예시 제거 → createApplication로 정합)
    - `packages/http-adapter/src/bunner-http-adapter-factory.ts`: 수정(bootstrapApplication 언급 에러 메시지 정리)

- Implementation notes (원문 보존, 후속 Implementer):
  - 작업 내용(후속 Implementer):
    - `bootstrapApplication`을 제거하고, App-External Code는 `createApplication`만으로 부트스트랩을 수행해야 한다.
    - `createApplication`이 app.spec.md의 MUST/MUST NOT/Observable/Violation을 만족하도록 구현/수정한다.
    - Env/Config preload가 `createApplication` 완료 이전에 관측되도록 하고, 실패 시 `createApplication`에서 throw가 관측되도록 한다.
    - `createApplication`이 빌드 타임 Manifest 산출물을 기반으로 부트스트랩하도록 한다.
    - `app.attachAdapter`가 `app.start` 이후에 관측되지 않도록 강제한다.
    - `createApplication | app.start | app.stop | app.get | app.attachAdapter`가 Result를 반환하지 않도록 보장한다.
    - `app.stop`은 best-effort로 종료 처리를 수행해야 한다(중간에 실패해도 가능한 한 계속 진행).
    - 종료 처리 중 Error가 발생해도 종료 처리를 즉시 중단해서는 안 된다(에러는 누적 기록).
    - 종료 처리(모든 stop 훅/단계) 시도를 완료한 뒤, Error가 1개라도 누적되었다면 `app.stop`에서 throw가 관측되어야 한다.
    - throw는 단일 Error로 집계되어야 하며, 원인 Error들을 보존해야 한다(예: AggregateError 또는 `errors: Error[]`를 포함하는 Error).

- Verification (Gate):
  - Command(s): `bun run verify`
  - Expected result:
    - `bun run verify`가 통과한다.
    - app.spec.md의 Violation Conditions가 테스트 또는 검증 루틴으로 커버된다.

- Stop conditions:
  - `<not specified in original plan>`

- Rollback:
  - `<not specified in original plan>`

### Step 3) CLI(AOT) 정합(필수) — defineAdapter/pipeline 입력을 결정에 맞게 수집

- Objective:
  - 4.8 결론에 맞게 CLI(AOT) analyzer가 `adapterSpec`과 정적 스펙을 결정적으로 수집하도록 만든다.

- Inputs:
  - 4.8 결정 완료(Resolved) 전제, Controller `adapterIds` 정규화 규칙, handlerId/selectorKey 합의.

- Outputs:
  - analyzer가 http-adapter 엔트리에서 `adapterSpec` 수집 가능
  - 관련 테스트 정합

- Change set (예상):
  - Files:
    - `packages/cli/src/analyzer/adapter-spec-resolver.ts`: 수정(defineAdapter 인자 형상/수집 규칙 정합)
    - `packages/cli/src/analyzer/adapter-spec-resolver.spec.ts`: 수정/추가(object literal 수집 규칙에 맞춰 테스트 정합)
    - `packages/cli/src/analyzer/interfaces.ts`: 수정(필요 시: AdapterRegistrationInput/AdapterStaticSpec/PipelineSpec 형상 정합)

- Implementation notes (원문 보존, 후속 Implementer):
  - 작업 내용(후속 Implementer):
    - 4.8의 결론에 따라, CLI analyzer가 `@bunner/http-adapter`의 `adapterSpec`과 정적 스펙을 **결정적으로** 수집하도록 수정한다.
    - `handlerIndex` 생성과 Controller 소유권 판정 규칙(특히 adapterIds 없음=all / 있음=subset)을 결정에 맞게 반영한다.
    - 관련 테스트를 결론에 맞게 수정/추가한다.

- Verification (Gate):
  - Expected result:
    - analyzer 단위 테스트가 통과한다.
    - http-adapter 패키지 엔트리에서 `adapterSpec` 수집이 가능하다.

- Stop conditions:
  - `<not specified in original plan>`

- Rollback:
  - `<not specified in original plan>`

### Step 4) HTTP Adapter 적용(최소 DX/최소 변경)

- Objective:
  - HTTP Adapter가 `adapterSpec`을 제공하고, ingress→selector→`dispatch(handlerId, ctx, input)` 실행 모델로 접합된다.

- Inputs:
  - 4.8 결정 완료(Resolved) 전제, CLI(AOT) 수집 규칙(= Step 3 결과), manifest/module-system 계약 정합.

- Outputs:
  - `@bunner/http-adapter` 패키지 루트 엔트리에서 `adapterSpec` 제공
  - `bunnerHttpAdapter(...)` 경로 유지 시 새 모델과 접합

- Change set (예상):
  - Files:
    - `packages/http-adapter/index.ts`: 수정
    - `packages/http-adapter/**`: 수정
    - `packages/common/src/index.ts`: 수정(defineAdapter 공개가 `@bunner/common`로 확정되는 경우)
    - `packages/common/src/interfaces.ts`: 수정(defineAdapter 입력 타입 / BunnerAdapter 모델 정합이 필요해지는 경우)

- Implementation notes (원문 보존, 후속 Implementer):
  - 작업 내용(후속 Implementer):
    - `packages/http-adapter/index.ts`에 `export const adapterSpec = defineAdapter({ ... });`를 제공한다.
      - object literal은 최종 합의된 `AdapterRegistrationInput` 형상을 만족해야 한다.
      - `name`은 module-system.spec.md의 AdapterInstanceConfig.adapterName과 동일해야 한다(manifest.spec.md의 adapterStaticSpecs 구성 규칙).
      - `classRef`는 필수이며, `BunnerAdapter` 구현 클래스여야 한다.
      - `decorators.controller`는 `adapterIds?: AdapterId[]` 옵션을 지원해야 한다.
        - `adapterIds` 미정의는 빌드 실패가 아니라 “all”로 정규화되어야 한다.
      - `pipeline`은 phase/order 배열(순서 선언) 형태를 사용한다.
      - `runtime.start/stop` 모델은 사용하지 않는다(제거).
    - HTTP Adapter는 ingress에서 ctx 확장 → selector로 handlerId 결정 → `dispatch(handlerId, ctx, input)` 호출 흐름을 따른다.
  - 추가 작업(필수):
    - 4.8의 결론에 따라, `bunnerHttpAdapter(...)`가 유지되는 경우 해당 경로로 생성된 `BunnerHttpAdapter`가 새 실행 모델과 접합되도록 한다.
    - Controller/RestController 데코레이터 시그니처 변경이 발생하는 경우, 패키지 테스트/유틸(예: scalar/openapi) 영향 범위를 선언한다.

- Verification (Gate):
  - Command(s): `bun run verify`
  - Expected result:
    - CLI가 http-adapter의 `adapterSpec`을 수집 가능.
    - `bun run verify` 통과.

- Stop conditions:
  - `<not specified in original plan>`

- Rollback:
  - `<not specified in original plan>`

---

## 9) 검증 매트릭스 (Requirement → Evidence)

| Acceptance Criteria | Evidence (test/log/snapshot)                       | Step     | Notes                    |
| ------------------- | -------------------------------------------------- | -------- | ------------------------ |
| AC1                 | 합의된 DX 템플릿 1개 존재                          | Step 1   | 문서/결정 고정(4.8 기반) |
| AC2                 | analyzer 테스트 + http-adapter entry에서 수집 가능 | Step 3   | 결정적 수집(추측 금지)   |
| AC3                 | `dispatch(handlerId, ctx, input)` 실행 경로 고정   | Step 4   | 런타임 조립/추론 금지    |
| AC-E1               | `adapterIds` 없음=all / 있음=subset 정규화         | Step 3/4 | 빌드 타임 결과에 반영    |
| AC-C1               | `bunnerHttpAdapter(...)` 접합                      | Step 4   | 유지/이행                |

---

## 10) 리스크 / 롤백 (필수)

- 리스크:
  - 기존 `packages/http-adapter`는 현재 `HttpMiddlewareLifecycle` 기반으로 동작하므로, 외부 사용자 코드/설정과의 Breaking 가능성이 있다.
  - pipeline skeleton DSL 및 `dispatch(handlerId, ctx, input)` 실행 경로로의 전환은 기존 런타임 코드와의 접합부에서 Breaking 가능성이 있다.
  - `adapterId` 강제 및 데코레이터 시그니처 변경은 통합 테스트에 즉시 영향을 준다.

- 롤백:
  - HTTP Adapter 표면 API를 유지하면서 내부적으로만 phase로 매핑하는 shim 전략을 우선 적용할 수 있다.

---

## 11) 검증 / 완료 조건 (필수)

- [ ] (계약) 합의된 DX 템플릿 1개가 존재한다.
- [ ] (적용) `@bunner/http-adapter`가 `adapterSpec`을 제공한다.
- [ ] (정합) pipeline skeleton, phase enum, decorators 확장, handlerId/dispatch 모델이 문서/구현에 일관되게 반영된다.
- [ ] (빌드) Controller 데코레이터의 `adapterIds` 의미(없음=all, 있음=subset)가 빌드 타임 결과에 반영된다.
- [ ] `bun run verify` 통과.

---

## 12) Open Questions (STOP 후보)

- Q1: `defineAdapter`의 공개 위치를 어디로 확정할 것인가? (`@bunner/common` vs 대안)
- Q2: `defineAdapter` 반환값은 “런타임 의미 없음”으로 고정할 것인가, 개발자 편의 반환을 허용할 것인가?
- Q3: (필요 시) runtime 상태 전달/stop 연계 방식은 ADR로 고정이 필요한가?

---

## Plan Changes (append-only)

- Change #1:
  - Date (UTC): 2026-01-21
  - Summary: DX 최종 합의 반영(파이프라인 skeleton DSL, core dispatch 모델, classRef 강제, runtime.start/stop 제거, controller adapterIds(없음=all, 있음=subset), HandlerExecutionPlan 빌드 타임 조립 명시)
  - Trigger: `<not specified in original plan>`
  - Approval evidence: `<not specified in original plan>`
  - Scope impact: `<not specified in original plan>`
  - Updated gates: `<not specified in original plan>`

- Change #2:
  - Date (UTC): 2026-01-22
  - Summary: Preflight(현 구현 관측) 추가, 결정 필요(Blocking) 섹션 추가, CLI 정합 Step 및 DoD 보강, 중복 라인 제거
  - Trigger: `<not specified in original plan>`
  - Approval evidence: `<not specified in original plan>`
  - Scope impact: `<not specified in original plan>`
  - Updated gates: `<not specified in original plan>`

- Change #3:
  - Date (UTC): 2026-01-22
  - Summary: pipeline token 명칭을 Guards/Pipes로 정합, createApplication 작업 Step 추가
  - Trigger: `<not specified in original plan>`
  - Approval evidence: `<not specified in original plan>`
  - Scope impact: `<not specified in original plan>`
  - Updated gates: `<not specified in original plan>`
