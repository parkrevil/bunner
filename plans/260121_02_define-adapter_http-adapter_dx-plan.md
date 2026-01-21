---
status: draft
---

# Run Plan

## 0) Persona / Handshake (필수)

- Persona:
  - `@Implementer`

- Handshake (AGENTS.md 형식 그대로):
  - "페르소나 **@Implementer**로서 작업을 시작합니다. **AGENTS.md (E0)**에 명시된 행동 제한 규약을 숙지하였으며, 작업 도중 불확실성 발생 시 즉시 중단(STOP IF UNCERTAIN)할 것을 서약합니다."

## 0) 원문(사용자 입력)

- 원문:
  - "아니 defineAdapter 와 Adapter 구현 인터페이스, HTTP Adapter 에 적용까지 계획을 시작한다. 논의해야하며 DX를 최우선으로 한다. 어댑터 제작자에게 명확하고 직관적인 틀을 제공해야한다"

- 에이전트 해석(검증 가능하게):
  - 무엇을 변경하는가:
    - (계약) `defineAdapter` / `adapterSpec` / Adapter 정적 스펙 및 런타임(start/stop) 인터페이스를 DX 우선으로 확정한다.
    - (적용) `@bunner/http-adapter`가 위 계약을 충족하는 `adapterSpec`을 패키지 루트 엔트리에서 제공하도록 한다.
  - 성공 조건은 무엇인가:
    - 어댑터 제작자 관점에서 “최소한의 보일러플레이트 + 기계적 판정 가능”한 등록 틀이 확정된다.
    - CLI가 `@bunner/http-adapter` 패키지 루트 entry file의 `adapterSpec = defineAdapter(<object literal>)` 호출 표현을 빌드 타임에 결정적으로 수집 가능하다.
    - HTTP Adapter의 미들웨어 단계 용어가 SSOT(L3/L1 Glossary)의 `Middleware Phase`와 정합된다.
  - 명시적 제약:
    - L1/L2: 빌드 타임 판정(추측 금지), 결정성, 경계/Facade 원칙 준수.
    - L3: `adapter.spec.md`, `manifest.spec.md`, `common.spec.md`, `module-system.spec.md`, `app.spec.md` 계약과 정합.

- SSOT 충돌 여부:
  - [ ] 없음
  - [ ] 있음 → 충돌 지점 식별 후 즉시 중단

---

## 1) 기대효과

- 어댑터 제작자가 “정해진 한 가지 방법”으로 빠르게 등록 가능 (`adapterSpec` + `defineAdapter`).
- HTTP Adapter가 SSOT 기반 정적 스펙을 제공하여 CLI/DevTools 파이프라인에 편입된다.
- (후속) 다른 프로토콜 어댑터도 동일한 DX 템플릿으로 제작 가능.

---

## 2) 범위(Scope) / 비범위(Non-Goals)

### Scope

- 계약/문서 정렬(필요 시):
  - `docs/30_SPEC/adapter.spec.md`: `defineAdapter`/`adapterSpec`/`AdapterRuntimeSpec`의 “시그니처(인자/반환)” 범위를 명시적으로 확정하거나, 의도적으로 미고정임을 명시.
  - `docs/30_SPEC/app.spec.md`: `attachAdapter` 및 `app.start/stop`과 어댑터 runtime 호출 관측 규칙의 정합 확인.
  - `docs/30_SPEC/manifest.spec.md`: `adapterStaticSpecs`의 구성 규칙(AdapterConfig 기반 key 집합 및 adapterName 매핑)과 어댑터 등록 입력(`AdapterRegistrationInput.name`)의 정합 확인.
  - `docs/10_FOUNDATION/GLOSSARY.md`: “Middleware Phase” 용어가 구현/스펙/패키지 API와 일치하도록 정합.

- 구현 적용(후속 Implementer 단계로 명시):
  - `packages/http-adapter/index.ts`: `adapterSpec` named export 제공.
  - `packages/http-adapter/**`: `HttpMiddlewareLifecycle` → `Middleware Phase` 개념으로의 표면/내부 정렬(필요 시 점진적 마이그레이션 포함).
  - `packages/common` 또는 `packages/core`: 어댑터 제작자가 import 할 `defineAdapter` 공개 Facade 제공(정확한 위치는 설계에서 결정).

### Non-Goals

- 전 어댑터 패키지 일괄 마이그레이션.
- 런타임 실행 엔진 전체 교체.
- 기존 예제 앱 전체 업데이트(필요 시 최소 스모크 업데이트만).

---

## 3) SSOT 확인 기록

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

## 4) 작업 설계(선택지/결정)

### 4.1 DX 최우선 결론(초안) — 논의 시작점

본 Plan은 아래 한 가지 틀을 “기본 DX”로 고정하고, 예외를 금지한다.

- **어댑터 제작자가 구현하는 것(2-레이어 분리)**
- **어댑터 제작자가 제공하는 것(등록 입력 + 실행체)**
  - (AOT) 패키지 루트 entry file에서 `adapterSpec` named export 1개
    - 역할: `adapterSpec = defineAdapter(<AdapterRegistrationInput object literal>)` 형태로, 어댑터 정적 명세를 빌드 타임 판정 입력으로 제공.
  - (Runtime) `BunnerAdapter` 구현 클래스(실행체) 1개(선택)
    - 역할: 실제 프로토콜 서버/리스너를 소유하고 `start/stop`을 구현.
    - note: `AdapterRegistrationInput.classRef`는 런타임 실행체 class reference(선택)로 입력될 수 있다.

- **`defineAdapter`는 “빌드 타임 수집 마커”이며 런타임 로직이 아니다**
  - `defineAdapter`는 런타임에서 실행 경로를 변경하는 지능/부작용을 포함해서는 안 된다.
  - 목적은 오직 `adapterSpec = defineAdapter(<object literal>)`을 TS에서 타입 안전하게 작성하도록 돕는 것이다.
  - CLI는 런타임 실행으로 `defineAdapter`를 인지하는 것이 아니라, **AST에서 호출 표현을 수집**한다.

### 4.2 질문별 정리(규범적 답변)

- Q1) “BunnerAdapter 인터페이스 만들고 start/stop 강제”
  - `packages/common/src/interfaces.ts`에 `BunnerAdapter`가 존재한다.
  - L3(`adapter.spec.md`)에서 `AdapterRegistrationInput.runtime.start/stop`은 `FactoryRef(common.spec.md)`로 고정되어 있으므로,
    - `runtime.start/stop`은 **BunnerAdapter 실행체를 부팅/정지시키는 함수 참조(FactoryRef)** 로 제공되어야 한다.
    - `AdapterRegistrationInput.classRef`는 adapter.spec.md에서 required field가 아니므로 **optional 입력**이다.
      - 즉, 실행체 class를 제공하든/제공하지 않든, `runtime.start/stop` FactoryRef는 반드시 제공되어야 한다.
      - `classRef`를 제공하는 경우, `runtime.start/stop`이 해당 실행체 인스턴스를 생성/관리하는 방식으로 구현할 수 있다.

- Q2) “프레임워크가 파이프라인/핸들러 조립한다는데 컨텍스트는 어디서 조립?”
  - L1/L2 전제: 런타임 리플렉션/추측 금지 → 컨텍스트 조립은 빌드 타임 산출물 + 런타임 입력(요청)만으로 결정적이어야 한다.
  - 구조:
    - 빌드 타임: CLI가 `handlerIndex`(HandlerId 목록)와 데코레이터 기반 입력(guards/pipes/middlewares/exceptionFilters)을 수집해 “정적 wiring 입력”을 만든다.
    - 런타임: 어댑터 실행체가 프로토콜 입력(예: HTTP request/response)을 받아, **어댑터 소유의 Protocol Context**(예: `BunnerHttpContext`)를 구성한다.
    - 엔진/프레임워크는 최소 컨텍스트(예: `contextId`, `adapterId`, DI 접근) 제공만 담당하고, 프로토콜 필드는 어댑터가 소유한다.

- Q3) “filter/controller/handler/param 데코레이터 정보는 어떻게 전달?”
  - 전달은 런타임 메타데이터가 아니라 **Manifest(또는 생성된 wiring 코드)** 로 한다.
  - CLI가 AST로 다음을 수집/정규화한다:
    - Controller/Handler 판정: `entryDecorators.controller`(DecoratorRef) + `entryDecorators.handler`(DecoratorRef[])
    - Pipeline 구성 입력: module-system의 등록 + `@Guards/@Pipes/@Middlewares/@ExceptionFilters` 선언
    - (필요 시) 파라미터 데코레이터는 HTTP Adapter가 자체 규칙으로 “라우팅/바인딩 계획”을 생성하는 입력으로만 사용(리플렉션 금지)
  - 런타임에는 “정적 결정 결과(핸들러 id/파이프라인 스텝 참조)”만 남고, 설계 메타데이터는 L1의 Metadata Volatility 전제에 따라 장기 노출되면 안 된다.

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
- `defineAdapter`의 인자는 `adapter.spec.md`가 정의하는 `AdapterRegistrationInput` object literal로 고정한다.
- HTTP Adapter는 “정의 클래스 추가 + 기존 런타임 클래스 재사용(Shim)”로 최소 변경 적용을 목표로 한다.

### 4.6 남은 합의(최소)

- `BunnerAdapter.start(context)`의 context 최소 형상(어댑터 제작자 DX 관점에서 “뭘 받는지”)을 어디에서 고정할지:
  - (옵션) L3 `common.spec.md`의 Context와 런타임 `packages/common`의 Context 인터페이스 정합 방향.
- HTTP Adapter의 lifecycle → phase 마이그레이션을 브레이킹으로 할지(shim으로 갈지) 범위.

---

## 5) 실행 계획

### Step 1) 계약 확정(DX 우선) — 논의/합의

- 작업 내용:
  - `defineAdapter` 사용 경험을 “어댑터 제작자 관점”에서 1개 템플릿으로 고정한다.
  - `AdapterRuntimeSpec.start/stop` 시그니처를 고정할지 여부를 결정한다.
  - HTTP Adapter의 middleware 단계 명칭을 `Middleware Phase`로 정렬하는 마이그레이션 전략(Breaking 여부 포함)을 결정한다.

- 산출물:
  - (필요 시) ADR 초안 1개: runtime 상태 전달/stop 연계 방식.
  - (필요 시) L3 spec 수정안 초안(문장 단위로 decidable하게).

- 중간 검증:
  - 계약이 “AST-level 판정 가능”하고, 추측/리플렉션을 요구하지 않음.

- 변경 파일(예상):
  - `docs/30_SPEC/adapter.spec.md` (필요 시)
  - `docs/30_SPEC/app.spec.md` (필요 시)
  - `docs/10_FOUNDATION/GLOSSARY.md` (필요 시)

### Step 2) defineAdapter 공개 Facade 설계

- 작업 내용:
  - `defineAdapter`를 어느 패키지의 Public Facade로 제공할지 결정한다.
  - 반환값(런타임 의미 없음 vs 개발자 편의용 반환)을 결정한다.

- 중간 검증:
  - L2 의존성 방향 위반 없음.
  - `defineAdapter`는 빌드 타임 수집 입력이며 런타임 지능을 요구하지 않음.

### Step 3) HTTP Adapter 적용(최소 DX/최소 변경)

- 작업 내용(후속 Implementer):
  - `packages/http-adapter/index.ts`에 `export const adapterSpec = defineAdapter({ ... });`를 제공한다.
    - object literal은 adapter.spec.md의 `AdapterRegistrationInput` 형상을 만족해야 한다.
    - `name`은 module-system.spec.md의 AdapterInstanceConfig.adapterName과 동일해야 한다(manifest.spec.md의 adapterStaticSpecs 구성 규칙).
    - `pipeline.handler`는 dispatcher(FactoryRef)여야 한다(adapter.spec.md).
    - `pipeline`이 array literal인 경우, `PipelineDeclarationEntry` 규칙(phaseId/handler 1개/middlewarePhaseOrder 정합)을 만족해야 한다(adapter.spec.md).
    - `supportedMiddlewarePhases`와 `middlewarePhaseOrder`는 동일한 phase id 집합을 표현해야 한다(adapter.spec.md).
    - `decorators`는 `entryDecorators`로 정규화되어야 한다(adapter.spec.md).
    - `runtime.start/stop`은 FactoryRef여야 한다(adapter.spec.md, common.spec.md).
  - HTTP Adapter 내부의 middleware 단계 용어를 `Middleware Phase`로 정렬한다(표면 API/내부 구현/테스트).

- 중간 검증:
  - CLI가 http-adapter의 `adapterSpec`을 수집 가능.
  - `bun run verify` 통과.

---

## 6) 검증 / 완료 조건

- [ ] (계약) 합의된 DX 템플릿 1개가 존재한다.
- [ ] (적용) `@bunner/http-adapter`가 `adapterSpec`을 제공한다.
- [ ] (정합) middleware 단계 용어가 SSOT의 `Middleware Phase`와 일치한다.
- [ ] `bun run verify` 통과.

---

## 7) 리스크 / 롤백

- 리스크:
  - 기존 `packages/http-adapter`는 현재 `HttpMiddlewareLifecycle` 기반으로 동작하므로, 외부 사용자 코드/설정과의 Breaking 가능성이 있다.
  - `AdapterRuntimeSpec.start/stop`의 상태 전달 방식이 확정되지 않으면 구현이 흔들린다.

- 롤백:
  - HTTP Adapter 표면 API를 유지하면서 내부적으로만 phase로 매핑하는 shim 전략을 우선 적용할 수 있다.

---

## Plan Changes (append-only)

- (비어있음)
