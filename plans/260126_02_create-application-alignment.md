---
status: draft
allowed_paths:
  - packages/core/**
  - plans/**
---

# Run Plan

## 0) Metadata (필수)

- Plan ID: `260126_02_create-application-alignment`
- Created at (UTC): `2026-01-26`
- Owner: `user`
- Related:
  - Source: `plans/260121_02_define-adapter_http-adapter_dx-plan.md` (Step 2.5 only)
- Target branch: `main`

### Persona / Handshake

- Persona:
  - `@Architect`

- Handshake (AGENTS.md 형식 그대로):
  - "페르소나 **@Architect**로서 작업을 시작합니다. **AGENTS.md (E0)**에 명시된 행동 제한 규약을 숙지하였으며, 작업 도중 불확실성 발생 시 즉시 중단(STOP IF UNCERTAIN)할 것을 서약합니다."

---

## 1) 원문(사용자 입력) (필수)

- 원문:
  - "createApplication 에 관한 내용만 새 계획문서로 작성"
  - "attachAdapter -> attach 로 수정"
  - "이번 계획은 createApplication get, start, stop, attach 함수만 구현한다"
  - "그리고 app lifecycle 까지 흐르도록 구성해야한다"
  - "기존 코드베이스의 내용은 현재 작업에 병합하지 않는다. 이번 작업을 독립적으로 진행한다"
  - "DI, Adapter 구현이 불안정한 상태라 get, attach 는 비어있는 함수만 작성한다"
  - "Q1. spec 을 확인하고 이 프레임워크의 구조상 core common 어디둘지 판단해라"
  - "Q2. b다"
  - "entry 는 defineModule 의 리턴값이어야한다 즉 defineModule 까지 구현해야하며 defineModule 은 symbol 이어야한다"
  - "entry 이름은 자유이며 export default defineModule(...) 형태도 허용한다"
  - "DefineModuleOptions는 {} 이지만 린트 회피를 위해 임시 프로퍼티 1개를 추가해 둔다"
  - "모듈 파일에 defineModule 호출은 1회만 허용한다"
  - "물론 이번 스코프에서는 아무기능도없이 빈깡통이어야한다"
  - "그리고 CLI 에서 defineModule 을 수집하는 것은 이번에 구현하지 않는다"

- 사용자 입력을 구조화(해석 금지):
  - Change target:
    - `createApplication(entry, options?)` + `app.get` + `app.start` + `app.stop` + `app.attach` 최소 구현
    - `entry`는 `defineModule(...)`의 리턴값이어야 함(= defineModule까지 구현)
    - app lifecycle(state machine)가 실제로 흘러가도록 구성
    - `attachAdapter` 명칭은 `attach`로 정리
  - Success condition:
    - `createApplication → app.start → app.stop` 흐름이 관측 가능하게 동작한다.
    - `app.get`/`app.attach`는 스텁(비어있는 함수)으로 제공된다.
    - 검증(`bun run verify`)이 통과한다.

- 결정(Decision): createApplication의 배치(core/common)
  - 결론: `packages/core` (core)
  - 근거:
    - L2 아키텍처 원칙: "Protocol-Agnostic Core"는 프로토콜을 인지하지 않는 런타임 코어이며, App bootstrap/lifecycle은 코어 책임으로 배치되는 것이 자연스럽다.
    - L3 app.spec.md는 App이 common의 선언(Token/FactoryRef)에 의존할 수 있음을 명시하지만(App depends-on common declarations), App 자체를 common으로 배치하라는 규칙은 없다.
    - 현 패키지 의존성 방향(정적 사실): `@bunner/core`는 `@bunner/common`에 의존하며, `@bunner/common`은 `@bunner/core`에 의존하지 않는다.
      - 따라서 “common이 core를 호출”하는 배치는 dependency 방향을 역전시키거나 순환을 유발할 수 있어 비권장이다.

- 결정(Decision): createApplication signature (entry/options)
  - 결론: `createApplication(entry, options?)` (entry는 별도 인자)
  - 근거:
    - app.spec.md는 "createApplication takes exactly one entry module"(APP-R-002)을 명시한다. entry를 별도 인자로 두면 이 계약이 API 표면에서 가장 명확해진다.
    - options에 entry를 포함시키면, 실질적으로 "options 객체 내 entry" 형태가 되어 정적 판정/진단(OUT-002)의 구현 복잡도가 올라간다.

- SSOT 충돌 여부: `none`

---

## 2) Spec Binding (필수)

- Primary SPEC:
  - `docs/30_SPEC/app/app.spec.md`

- Secondary SPEC (참조):
  - `docs/30_SPEC/SPEC.md#SPEC-(Index)`

- 이 Plan에서의 SPEC 변경:
  - [x] 없음(게이트)

- Section Gate: `pass`

---

## 3) Open Questions (STOP 후보)

- none

---

## 4) SPEC MUST SNAPSHOT (필수, 원문 기반)

- MUST-1:
  - `createApplication`은 async이며, preload 완료 이후에만 resolve 되어야 한다(APP-R-001).

- MUST-2:
  - `createApplication`은 정확히 1개의 entry module을 받으며, 빌드 타임에 정적으로 해결 가능해야 한다(APP-R-002).

- MUST-2.1 (요구사항 반영):
  - 이번 Plan에서 `entry`는 `defineModule(...)`의 리턴값이어야 한다.

- MUST-3:
  - `app.start`/`app.stop`은 Result를 반환하지 않는다(APP-R-013).

- MUST-4:
  - `app.stop`은 best-effort로 종료 처리를 수행하고, 종료 중 throw가 1개라도 관측되면 정리 완료 후 AggregateError를 throw 해야 한다(APP-R-012/014/015/016).

- MUST-5 (요구사항 반영):
  - 이번 Plan의 App 표면은 `app.attach`로 제공한다.
  - `attachAdapter`는 영구적으로 삭제한다(별칭/호환 제공하지 않음).
  - Note: app.spec.md는 `attach`를 기준으로 정렬되어야 한다.

---

## 5) 범위(Scope) / 비범위(Non-Goals) (필수)

- Scope:
  - `packages/core`에서 `createApplication` 및 App 표면(`get/start/stop/attach`)의 최소 구현
  - lifecycle 흐름(state) + `app.stop`의 best-effort 종료/에러 집계(관측 가능)
  - `createApplication(options)`의 입력 형상(최소) 명시 및 적용
  - `defineModule` (빈 깡통) 구현 및 `entry` 경로를 `defineModule`로 고정

- Non-Goals:
  - SSOT(SPEC) 문서 내용 변경(`docs/30_SPEC/**` 본문 수정)
  - `bootstrapApplication` 제거 및 문서/예시 정합(별도 Plan로 분리)
  - DI 구현 완성, Adapter attach 동작 완성(이번 Plan에서는 `get/attach` 스텁)
  - CLI(AOT)에서 `defineModule`을 수집/분석하는 기능 구현
  - 신규 패키지 도입 또는 아키텍처 변경

---

## 5.1) API Surface Lock (이번 Plan의 구현 계약)

- defineModule
  - Objective (이번 Plan): `createApplication`의 `entry`를 생성하는 유일한 경로를 제공
  - Shape (이번 Plan에서는 “빈 깡통”):
    - 런타임 의미(스캔/DI/메타데이터/등록)는 없음
    - 반환값은 오직 `createApplication(entry, ...)`의 입력으로만 사용
    - 반환 타입: `symbol`
    - `DefineModuleOptions`:
      - 목표: `{}` (빈 깡통)
      - 임시: 린트 회피를 위해 프로퍼티 1개를 추가한 형태로 유지
        - 예: `interface DefineModuleOptions { __temp?: true }`
    - Constraint:
      - 한 모듈 파일에서 `defineModule(...)` 호출은 최대 1회만 허용
  - Notes:
    - DX 잠금(이 Plan의 표면): entry export는 이름이 자유이며, 다음 형태들을 허용한다.
      - `export const <AnyName> = defineModule(...)`
      - `export default defineModule(...)`
    - CLI 수집이 이번 스코프 밖이므로, entry의 정적 수집/검증은 이번 Plan에서 다루지 않는다.

- createApplication
  - Signature: `createApplication(entry: EntryModule, options?: CreateApplicationOptions): Promise<BunnerApplication>`
  - 선택지 비교:
    - 채택: `entry, options?`
    - 비채택: `options: { entry: EntryModule, ... }` (entry 포함 options)
  - `CreateApplicationOptions` (본 Plan에서만 잠금):
    - 빈 깡통(`interface CreateApplicationOptions {}`)
    - Note: app.spec.md의 AppConfigInput(`env`, `loader`) 표면 정합은 이번 Plan 범위 밖으로 둔다.

- Singleton constraint (요구사항 잠금):
  - `BunnerApplication`은 한 프로젝트(프로세스/워커)에서 단 하나만 존재할 수 있다.
  - 관측(최소): 동일 프로세스에서 `createApplication(...)`이 2회 이상 호출되면 실패가 관측되어야 한다(throw).

- BunnerApplication (최소 표면)
  - `app.get(token)`:
    - 스텁(빈 함수). DI 안정화 전까지 런타임 의미를 제공하지 않는다.
  - `app.attach(adapterId, options?)`:
    - 스텁(빈 함수). Adapter 안정화 전까지 런타임 의미를 제공하지 않는다.
  - `app.start()`:
    - lifecycle을 started로 전이하고, 재호출/순서 위반이 관측 가능하게 처리한다.
  - `app.stop()`:
    - best-effort 종료 + 에러 누적 + 정리 완료 후 AggregateError throw.

---

## 6) Change set (예상)

- Files:
  - `packages/core/src/application/create-application.ts`: 수정(옵션 처리 + preload + 최소 lifecycle 구성)
  - `packages/core/src/application/interfaces.ts`: 수정(필요 시: CreateApplicationOptions 최소 정합)
  - (선택) `packages/core/src/application/bunner-application.ts`: 수정(표면에 `attach`/lifecycle 반영이 필요할 때)
  - (선택) `packages/core/src/application/bootstrap-application.spec.ts`: 수정/삭제(기존 테스트가 새 표면/스코프와 충돌할 때 최소 조정)

---

## 7) Implementation notes (원문 보존, 후속 Implementer)

- 작업 내용(후속 Implementer):
  - (Q2=b) 기존 구현을 “참조/병합”하지 않고, 동일 위치의 코드를 교체(replace-in-place) 방식으로 최소 구현을 만든다.
    - 단, SSOT(스펙) 문서 변경은 이 Plan 범위 밖이다.
  - `createApplication(entry, options)`에서 preload가 완료되기 전에는 resolve 되지 않도록 구성한다(APP-R-001).
  - `createApplication`은 정확히 1개의 entry module을 받도록 유지한다(APP-R-002).
  - `createApplication | app.start | app.stop | app.get | app.attach`는 Result를 반환하지 않도록 보장한다(APP-R-013).
  - `app.get`/`app.attach`는 스텁(빈 함수)으로 작성한다(요구사항). DI/Adapter 안정화 전까지 런타임 의미를 제공하지 않는다.
  - `app.start`/`app.stop`로 lifecycle 상태 전이가 관측 가능해야 한다.
  - `app.stop`은 best-effort로 종료 처리를 수행해야 한다(중간에 실패해도 가능한 한 계속 진행).
  - 종료 처리 중 Error가 발생해도 종료 처리를 즉시 중단해서는 안 된다(에러는 누적 기록).
  - 종료 처리 시도를 완료한 뒤, Error가 1개라도 누적되었다면 `app.stop`에서 AggregateError throw가 관측되어야 한다(APP-R-014/015/016).
  - attach 명칭 정리:
    - 기본 표면은 `app.attach`.
    - `attachAdapter`는 영구적으로 삭제한다(별칭/호환 제공하지 않음).

---

## 8) Verification (Gate)

- Command(s): `bun run verify`

- Expected result:
  - `bun run verify`가 통과한다.
  - (가능한 범위에서) app lifecycle 관측(`createApplication` preload, `app.stop` AggregateError) 관련 위반 조건이 테스트/검증으로 커버된다.

---

## 9) Stop conditions / Rollback

- Stop conditions:
  - 신규 패키지 도입이 필요해지면(예: 에러 집계/리소스 추적 유틸을 외부 deps로 해결해야 하는 경우) STOP.
  - core/common 경계 또는 Public Facade 변경이 예상보다 커져 L2 수준의 아키텍처 판단이 추가로 필요해지면 STOP.

- Rollback:
  - `<not specified in original plan>`
