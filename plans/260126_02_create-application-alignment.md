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
    - `createApplication(entry, options?)` + `app.get` + `app.start` + `app.stop` + `app.attach` 최소 구현(전부 스텁/no-op)
    - `entry`는 `defineModule(...)`의 리턴값이어야 함(= defineModule까지 구현)
    - `attachAdapter` 명칭은 `attach`로 정리
  - Success condition:
    - `createApplication(...)` 호출이 가능하며, 반환 객체(`BunnerApplication`)가 `get/start/stop/attach` 4개 함수를 제공한다.
    - `get/start/stop/attach`는 전부 스텁(no-op)이며, lifecycle/state/리소스/에러 집계 로직은 없다.
    - 검증(`bun run verify`)이 통과한다.

- 결정(Decision): createApplication의 배치(core/common)
  - 결론: `packages/core` (core)
  - 근거:
    - L2 아키텍처 원칙: "Protocol-Agnostic Core"는 프로토콜을 인지하지 않는 런타임 코어이며, App bootstrap은 코어 책임으로 배치되는 것이 자연스럽다.
    - L3 app.spec.md는 App이 common의 선언(Token/FactoryRef)에 의존할 수 있음을 명시하지만(App depends-on common declarations), App 자체를 common으로 배치하라는 규칙은 없다.
    - 현 패키지 의존성 방향(정적 사실): `@bunner/core`는 `@bunner/common`에 의존하며, `@bunner/common`은 `@bunner/core`에 의존하지 않는다.
      - 따라서 “common이 core를 호출”하는 배치는 dependency 방향을 역전시키거나 순환을 유발할 수 있어 비권장이다.

- 결정(Decision): createApplication signature (entry/options)
  - 결론: `createApplication(entry, options?)` (entry는 별도 인자)
  - 근거:
    - app.spec.md는 "createApplication takes exactly one entry module"(APP-R-002)을 명시한다. entry를 별도 인자로 두면 이 계약이 API 표면에서 가장 명확해진다.
    - options에 entry를 포함시키면, 실질적으로 "options 객체 내 entry" 형태가 되어 정적 판정/진단(OUT-002)의 구현 복잡도가 올라간다.

- SSOT 충돌 여부: `intentional`
  - Intentional conflicts (spec unchanged in this plan):
    - `docs/30_SPEC/app/app.spec.md`:
      - APP-R-001 (preload completion gate): this plan does not implement preload semantics.
      - APP-R-008 (attach validation / post-start rejection): this plan keeps `app.attach` as a stub.
      - APP-R-010 (app.get follows DI success conditions): this plan keeps `app.get` as a stub.
      - APP-R-011 (lifecycle hook ordering): this plan does not implement lifecycle hooks.
      - APP-R-012/014/015/016 (stop aggregation / AggregateError semantics): this plan keeps `app.stop` as a stub.
      - APP-R-018 (single app per process/worker): this plan does not implement CLI detection/enforcement.
    - `docs/30_SPEC/module-system/define-module.spec.md`:
      - DEFINE-MODULE-R-001~003 (AOT collection/enforcement): this plan does not implement the collector/enforcer.
    - `docs/30_SPEC/module-system/manifest.spec.md`:
      - MANIFEST-R-001 (deterministic generation): this plan does not generate a manifest.
      - MANIFEST-R-005 (required top-level fields): this plan does not generate a manifest.
    - `docs/30_SPEC/compiler/manifest.spec.md`:
      - COMPILER-MANIFEST-R-001 (compiler manifest is mechanically checkable): this plan does not declare or generate compiler manifest artifacts.
    - `docs/30_SPEC/compiler/aot-ast.spec.md`:
      - AOT-AST-R-004 (minimal profile includes manifest emission): this plan intentionally does not emit a manifest.

---

## 2) Spec Binding (필수)

- Primary SPEC:
  - `docs/30_SPEC/app/app.spec.md#3.3`

- Secondary SPEC (참조):
  - `docs/30_SPEC/module-system/define-module.spec.md#3.3`
  - `docs/30_SPEC/SPEC.md#SPEC-(Index)`

- 이 Plan에서의 SPEC 변경:
  - [x] 없음(게이트)

- Section Gate: `pass`

---

## 3) Open Questions (STOP 후보)

- none

---

## 4) SPEC MUST SNAPSHOT (필수, 원문 복사)

- MUST-1:
  - Source: `docs/30_SPEC/module-system/define-module.spec.md#3.3`
  - Quote:

    ```text
    defineModule call is mechanically checkable and returns a ModuleRef marker
    ```

- MUST-2:
  - Source: `docs/30_SPEC/app/app.spec.md#3.3`
  - Quote:

    ```text
    createApplication takes exactly one entry module and it is statically resolvable
    ```

- MUST-3:
  - Source: `docs/30_SPEC/app/app.spec.md#3.3`
  - Quote:

    ```text
    | APP-R-013 | active | MUST NOT | outcomes | Outcome:OUT-013 | createApplication/app.start/app.stop/app.get/app.attach returns Result | runtime |
    ```

---

## 6) 범위(Scope) / 비범위(Non-Goals) (필수)

- Scope:
  - `packages/core`에서 `createApplication` 및 App 표면(`get/start/stop/attach`)의 최소 구현(전부 스텁/no-op)
  - `createApplication(entry, options?)`의 입력 형상(최소) 명시 및 적용
  - `defineModule` (빈 깡통) 구현 및 `entry` 경로를 `defineModule`로 고정

- Non-Goals:
  - SSOT(SPEC) 문서 내용 변경(`docs/30_SPEC/**` 본문 수정)
  - `bootstrapApplication` 제거 및 문서/예시 정합(별도 Plan로 분리)
  - DI 구현 완성, Adapter attach 동작 완성(이번 Plan에서는 `get/attach` 스텁)
  - CLI(AOT)에서 `defineModule`을 수집/분석하는 기능 구현
  - manifest 생성/기록(예: `.bunner/manifest.json`) 및 manifest 기반 pipeline 구성
  - `BunnerApplication` 단일성(APP-R-018) 검증/에러(= CLI 감지/강제)
  - 신규 패키지 도입 또는 아키텍처 변경

---

## 6.1) API Surface Lock (이번 Plan의 구현 계약)

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
    - NOTE (intentional conflict): 이 Plan은 defineModule의 “수집/정적 제약(AOT)” 구현을 다루지 않는다(스펙은 변경하지 않는다).

- createApplication
  - Signature: `createApplication(entry: EntryModule, options?: CreateApplicationOptions): Promise<BunnerApplication>`
  - 선택지 비교:
    - 채택: `entry, options?`
    - 비채택: `options: { entry: EntryModule, ... }` (entry 포함 options)
  - `CreateApplicationOptions` (본 Plan에서만 잠금):
    - 빈 깡통(`interface CreateApplicationOptions {}`)
    - Note: app.spec.md의 AppConfigInput(`env`, `loader`) 표면 정합은 이번 Plan 범위 밖으로 둔다.

- App surface (이번 Plan에서는 “전부 스텁/no-op”)
  - `app.get(token)`: 스텁(빈 함수)
  - `app.attach(adapterId, options?)`: 스텁(빈 함수)
  - `app.start()`: 스텁(빈 함수)
  - `app.stop()`: 스텁(빈 함수)
  - Note: lifecycle/state/리소스/에러 집계 로직은 이번 Plan 범위 밖이다.

---

## 7) Change set (예상)

- Files:
  - `packages/core/src/application/application.ts`: 수정(createApplication + app 표면 스텁)
  - `packages/core/src/application/interfaces.ts`: 수정(필요 시: CreateApplicationOptions 최소 정합)
  - (예상) `packages/core/src/module/module.ts`: 추가/수정(defineModule stub)
  - (예상) `packages/core/src/module/index.ts`: 추가/수정(내부 배럴)

---

## 8) Implementation notes (원문 보존, 후속 Implementer)

- 작업 내용(후속 Implementer):
  - (Q2=b) 기존 구현을 “참조/병합”하지 않고, 동일 위치의 코드를 교체(replace-in-place) 방식으로 최소 구현을 만든다.
    - 단, SSOT(스펙) 문서 변경은 이 Plan 범위 밖이다.
  - `createApplication`은 정확히 1개의 entry module을 받도록 유지한다(APP-R-002).
  - `createApplication | app.start | app.stop | app.get | app.attach`는 Result를 반환하지 않도록 보장한다(APP-R-013).
  - `app.get`/`app.attach`/`app.start`/`app.stop`는 전부 스텁(no-op)으로 작성한다(요구사항).
  - attach 명칭 정리:
    - 기본 표면은 `app.attach`.
    - `attachAdapter`는 영구적으로 삭제한다(별칭/호환 제공하지 않음).

---

## 9) 실행 계획 (Step Gates, 필수)

<!-- markdownlint-disable MD033 -->

<a id="Step-1"></a>

### Step 1) defineModule stub 추가

- Objective:
  - `createApplication(entry, ...)` 입력으로 사용할 수 있는 `defineModule(...)` 스텁을 제공한다.
- Change set (예상):
  - Files:
    - `packages/core/src/module/module.ts`
    - `packages/core/src/module/index.ts`
- Spec Satisfaction:
  - Covered SPEC coordinates (좌표만):
    - `docs/30_SPEC/module-system/define-module.spec.md#3.3`
  - 충족되는 MUST IDs:
    - MUST-1
- File → MUST IDs 매핑:
  - packages/core/src/module/module.ts: MUST-1
  - packages/core/src/module/index.ts: MUST-1
- Tasks (필수):
  - `tasks/260126_02_create-application-alignment/260127_01_define-module-stub.md`
- Verification (Gate):
  - Command(s): `bun run verify`
  - Expected result: exit=0

<a id="Step-2"></a>

<!-- markdownlint-enable MD033 -->

### Step 2) createApplication + app surface stubs

- Objective:
  - `createApplication(...)`이 `get/start/stop/attach` 4개 함수를 제공한다.
  - `get/start/stop/attach`는 전부 스텁(no-op)이며 로직이 없다.
- Change set (예상):
  - Files:
    - `packages/core/src/application/application.ts`
    - `packages/core/src/application/interfaces.ts`
- Spec Satisfaction:
  - Covered SPEC coordinates (좌표만):
    - `docs/30_SPEC/app/app.spec.md#3.3`
  - 충족되는 MUST IDs:
    - MUST-2
    - MUST-3
- File → MUST IDs 매핑:
  - packages/core/src/application/application.ts: MUST-2, MUST-3
  - packages/core/src/application/interfaces.ts: MUST-2, MUST-3
- Tasks (필수):
  - `tasks/260126_02_create-application-alignment/260127_02_create-application-stubs.md`
- Verification (Gate):
  - Command(s): `bun run verify`
  - Expected result: exit=0

---

## 10) 검증 매트릭스 (MUST → Evidence, 필수)

| MUST ID | Evidence ID | Evidence (test/log/snapshot) | Step | Notes                                                  |
| ------- | ----------- | ---------------------------- | ---- | ------------------------------------------------------ |
| MUST-1  | MUST-EVID-1 | `bun run verify`             | 1    | defineModule marker is present                         |
| MUST-2  | MUST-EVID-2 | `bun run verify`             | 2    | entry is a single, statically resolvable module marker |
| MUST-3  | MUST-EVID-3 | `bun run verify`             | 2    | no Result return                                       |

---

## 11) Stop conditions / Rollback

- Stop conditions:
  - 신규 패키지 도입이 필요해지면(예: 에러 집계/리소스 추적 유틸을 외부 deps로 해결해야 하는 경우) STOP.
  - core/common 경계 또는 Public Facade 변경이 예상보다 커져 L2 수준의 아키텍처 판단이 추가로 필요해지면 STOP.

- Rollback:
  - `<not specified in original plan>`
