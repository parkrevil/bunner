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
  - "SPEC 내용대로 CLI 를 개선할 방법을 계획해야한다. 논의를 진행한다"
  - "나와 논의 후 계획 파일을 생성한다"
  - "build 는 프로젝트를 빌드 하는 커맨드" / "dist 는 프로젝트 빌드 결과물"
  - " .bunner 는 컴파일러 산출물"
  - "js 사용하지마라"
  - "globalThis.**BUNNER\_\*** 삭제해라"
  - "진행해라"

- 에이전트 해석(검증 가능하게):
  - 무엇을 변경하는가:
    - `packages/cli/**`의 `build`/`dev`/config loader/산출물 생성 로직을 L3 SPEC(`aot-ast.spec.md`, `manifest.spec.md`, `diagnostics.spec.md`, `devtools.spec.md`, `docs.spec.md` 등)과 정합되게 재설계한다.
  - 성공 조건은 무엇인가:
    - CLI가 `.bunner`에 “컴파일러 산출물”을 생성하고, `dist`는 “프로젝트 빌드 결과물”로 유지한다.
    - bunner config 로딩이 `aot-ast.spec.md` 계약을 만족한다(필수 파일/필수 필드/기본값 금지/실패는 diagnostics로 관측).
    - Manifest 산출물이 `manifest.spec.md`의 `BunnerManifest` JSON(UTF-8) 표현으로 관측 가능하다.
    - `globalThis.__BUNNER_*__` 기반 주입이 제거된다.
    - `.js` 사용 금지 요구를 해석 가능한 형태로 구현 계획에 반영한다.
  - 명시적 제약:
    - SPEC/SSOT 변경은 승인 토큰 없이는 하지 않는다.
    - 설계 문서로서 "계획 파일"을 먼저 만든다.

- SSOT 충돌 여부:
  - [x] 없음
  - 해석 확정: "js 사용하지마라"는 config/컴파일러 산출물(`.bunner`)에만 적용된다. `dist`는 프로젝트 빌드 결과물로서 JS 산출이 정상이다.

---

## 1) 기대효과

- CLI 산출물(`.bunner`)과 앱 산출물(`dist`)의 역할 경계가 SPEC과 일치한다.
- Manifest/Interface Catalog/Runtime Observation Artifact가 SPEC 형태로 관측 가능해져, DevTools/MCP/Docs 파이프라인이 기계적으로 정합된다.
- 런타임 부트스트랩에서 `globalThis` 기반 숨은 경로를 제거해, Metadata Volatility 및 "부트스트랩 이후 접근 경로 금지" 방향과 정합된다.

---

## 2) 범위(Scope) / 비범위(Non-Goals)

### Scope

- 변경 대상과 이유:
  - `packages/cli/src/common/config-loader.ts`: `aot-ast.spec.md`의 config 강제 로딩 규칙( `bunner.config.ts` 또는 `bunner.config.json` ) 및 `module.fileName` 필수/기본값 금지/실패 처리 정합.
  - `packages/cli/src/commands/build.command.ts`: `.bunner`를 컴파일러 산출물 루트로 사용(Manifest 등) + `dist`를 앱 빌드 결과물로 유지.
  - `packages/cli/src/commands/dev.command.ts`: dev AOT 산출물(`.bunner`) 생성 정합 + 불필요한 전역 주입 제거.
  - `packages/cli/src/generator/manifest.ts`, `packages/cli/src/generator/entry.ts` 및 관련 생성기: Manifest를 JSON 산출물로 분리, 부트스트랩에서 `globalThis.__BUNNER_*__` 제거.
  - (필요 시) `packages/cli/src/**` diagnostics 출력: `diagnostics.spec.md`의 `Diagnostic` shape 및 결정적 정렬 규칙에 정합.

- 변경 유형:
  - [x] 생성
  - [x] 수정
  - [x] 삭제
  - [ ] 이동/병합

- 영향 범위 선언(사실 기술):
  - 영향 가능 패키지/모듈: `packages/cli`, (연동 시) `packages/core`
  - Public Facade 변경: 가능(CLI 출력/파일 산출물 형태 변화)
  - 패키지 의존 변경: 미정

### Non-Goals

- `docs/**` (SSOT) 문서 변경은 본 계획에 포함하지 않는다(별도 승인 필요).
- `dist` 번들 포맷/런타임 배포 전략을 새로 정의하지 않는다.

---

## 3) SSOT 확인 기록

- SPEC: `docs/30_SPEC/aot-ast.spec.md`(config/`.bunner`/determinism), `docs/30_SPEC/manifest.spec.md`(BunnerManifest JSON), `docs/30_SPEC/diagnostics.spec.md`(Diagnostic shape), `docs/30_SPEC/devtools.spec.md`(Runtime Observation Artifact), `docs/30_SPEC/docs.spec.md`(Interface Catalog)
- ARCHITECTURE: `docs/20_ARCHITECTURE/ARCHITECTURE.md`(Static Context Binding 등)
- STRUCTURE: `docs/20_ARCHITECTURE/STRUCTURE.md`
- STYLEGUIDE: `docs/40_ENGINEERING/STYLEGUIDE.md`

---

## 4) 작업 설계(선택지/결정)

- 선택지 A: "Manifest = JSON 산출물" + "실행 코드 산출물 = 별도 TS 산출물"로 분리
  - 요약: `.bunner/manifest.json`을 정본 산출물로 생성하고, 기존 `manifest.ts/js` 역할은 `.bunner/injector.ts` 같은 이름으로 격리한다.
  - 리스크: 기존 엔트리 부트스트랩이 import 기반으로 기대하던 API(예: `createContainer`)가 분리되며, core 부트스트랩 경로 수정이 필요할 수 있다.

- 선택지 B: "Manifest = JS 모듈"을 유지하고 JSON은 부가 산출물로만 생성
  - 요약: 현재 구조를 유지하되 JSON은 참고용으로만 만든다.
  - 리스크: `manifest.spec.md`의 "Manifest 산출물은 BunnerManifest JSON" 요구에 정면으로 어긋날 가능성이 크다.

- 최종 결정:
  - draft: 선택지 A
  - 근거(참조 문서): `manifest.spec.md` 3.1 MUST("BunnerManifest 데이터의 JSON(UTF-8) 표현"), `aot-ast.spec.md` 산출물 루트 `.bunner` 고정

---

## 5) 실행 계획

### Step 1) Config Loader를 SPEC 정합으로 전환

- 작업 내용:
  - `bunner.config.ts` 또는 `bunner.config.json`만 허용( `.js` config 제거).
  - config 미존재/형상 위반/`module.fileName` 누락은 Build 실패로 관측.
  - `module.fileName` 기본값 설정 금지.

- 중간 검증:
  - 샘플 프로젝트에서 config 누락 시 실패하는지 확인.

- 변경 파일:
  - `packages/cli/src/common/config-loader.ts`

### Step 2) 산출물 경계 정합

- 작업 내용:
  - `.bunner`는 컴파일러 산출물(Manifest/Interface Catalog/Runtime Observation Artifact 등)만 생성.
  - `dist`는 프로젝트 빌드 결과물로 유지.

  - `.bunner` 내부 산출물 경로(구현 선택, SPEC 아님)는 “상단 3개 파일 경로”를 고정한다.
    - 고정 경로:
      - `.bunner/manifest.json`
      - `.bunner/interface-catalog.json`
      - `.bunner/runtime-report.json`
    - 추가 실행 산출물(런타임 진입점/레지스트리 등)은 `.bunner/**` 하위에만 생성하되, 상단 3개 고정 경로는 변경하지 않는다.

- 중간 검증:
  - build 실행 후 `.bunner/**`와 `dist/**`에 각각 기대 산출물이 있는지 확인.

- 변경 파일:
  - `packages/cli/src/commands/build.command.ts`
  - `packages/cli/src/commands/dev.command.ts`

### Step 3) Manifest를 JSON 산출물로 분리

- 작업 내용:
  - `.bunner/manifest.json` 생성(UTF-8), 내용은 `BunnerManifest`에 정확히 일치.
  - 결정적 정렬(`modules`, `diGraph.nodes`, `handlerIndex`) 보장.

- 중간 검증:
  - 동일 입력에서 manifest.json 바이트 단위 동일성(결정성) 확인.

- 변경 파일:
  - `packages/cli/src/generator/manifest.ts` (또는 새 생성기 추가)

### Step 4) `globalThis.__BUNNER_*__` 제거

- 작업 내용:
  - 부트스트랩/런타임 실행 경로에서 `globalThis` 주입 경로를 제거.
  - 필요 정보는 명시적 인자 전달 또는 모듈 스코프 내부로 제한.
  - 부트스트랩 이후 런타임에서 `manifest.json`에 접근하기 위한 “접근 경로(전역 키/환경변수/파일 경로 노출/헬퍼 API)”를 제공하지 않는다.

- 중간 검증:
  - entry 실행 경로에서 전역 키가 생성되지 않는지 확인.

- 변경 파일:
  - `packages/cli/src/generator/entry.ts`
  - `packages/cli/src/generator/manifest.ts` (현재 metadata registry 주입 포함)

### Step 5) BuildProfile 구현

- 작업 내용:
  - `minimal|standard|full`에 따라 생성 산출물(Manifest / Interface Catalog / Runtime Observation Artifact)을 분기.
  - profile별로 `.bunner` 산출물 집합을 고정한다.

- 중간 검증:
  - profile별 산출물 집합이 SPEC과 일치하는지 확인.

### Step 6) 성능/DX 강화

- 작업 내용:
  - 쓰기 최소화: `.bunner/**` 산출물은 내용 해시가 동일하면 파일을 쓰지 않는다(dev/watch 체감 성능).
  - 분석/산출 분리: analyze(Manifest 등 모델 생성)와 emit(파일 생성)을 분리하고, emit은 입력 모델만으로 결정적으로 동작하도록 만든다.
  - 단일 진입점: 런타임이 소비하는 진입점 파일을 1개로 고정해 디버깅/사용 경험을 단순화한다(파일명은 구현 선택).

- 중간 검증:
  - 동일 입력에서 불필요한 파일 변경이 발생하지 않는지 확인.
  - watch에서 변경 범위가 최소로 유지되는지 확인.

### Step 7) (비-SPEC) CLI 최적화/기능 후보

- 작업 내용:
  - 원칙: SPEC이 요구하는 계약(산출물/결정성/진단 shape)을 우선 만족하고, 아래 항목은 “추가 최적화/개선 후보”로만 취급한다(명령/옵션 표면은 여기서 고정하지 않는다).
  - 관측성/디버깅:
    - 빌드 단계별 시간/카운터 요약(성능 회귀 탐지용).
    - 재생성/포함/제외 근거를 사람이 읽을 수 있게 설명(“왜 다시 빌드됐는가”).
    - 머신 리더블 출력(예: JSON) 지원은 “후보”로만 유지(진단 shape는 `diagnostics.spec.md` 준수).
  - 안전장치:
    - 산출물 동치성 가드: 동일 입력에서 생성된 `manifest.json`과 실행 산출물이 서로 불일치하면 실패로 판정.
    - `clean`/`verify` 같은 보조 커맨드 도입은 “후보”(필요성/사용자 승인 후 결정).
  - 증분/캐시:
    - 그래프 기반 invalidation(변경 영향 범위 최소화).
    - 디스크 캐시(프로젝트+옵션+파일해시 키), 캐시 스키마/버전으로 자동 무효화.
  - watch 안정성(dev 루프 품질):
    - 이벤트 폭주/중복 coalesce, 실패 후 자동 복구, 변경 영향 범위 요약 출력.

---

## 6) 검증 / 완료 조건

- [x] `.bunner` 루트에 컴파일러 산출물이 생성된다.
- [x] `dist`는 프로젝트 빌드 결과물로 유지된다.
- [x] `manifest.json`이 `BunnerManifest` JSON(UTF-8)으로 관측 가능하다.
- [x] 동일 입력에서 `manifest.json`이 바이트 단위로 결정적이다.
- [x] config 로딩이 `aot-ast.spec.md`의 필수 규칙을 만족한다.
- [x] `globalThis.__BUNNER_*__` 키가 생성되지 않는다.
- [x] 부트스트랩 이후 런타임에서 `manifest.json` 접근 경로가 제공되지 않는다.
- [x] `bun run verify`를 통과한다.

---

## 7) 리스크 / 롤백

- 리스크:
  - 기존 사용자 프로젝트/예제(`examples/`)가 현재 CLI 동작에 의존하고 있을 수 있다.

- 롤백:
  - 변경 전 CLI 경로를 feature flag로 유지하거나, 단일 PR에서 단계별로 되돌릴 수 있도록 커밋을 분리한다.

---

## Decisions

- "js 사용하지마라"의 범위:
  - config/컴파일러 산출물(`.bunner`)에서 `.js`를 쓰지 않는다.
  - `dist`는 프로젝트 빌드 결과물로서 JS 산출이 정상이다.

- `manifest.json`과 런타임 실행 산출물의 관계:
  - 런타임은 `manifest.json`을 직접 소비하지 않는다.
  - CLI가 `manifest.json`으로부터 파생된 실행 산출물을 생성한다(부트스트랩 이후 접근 경로 금지와 정합).
  - CLI는 build-time에 `manifest.json`과 실행 산출물이 동일 입력에서 생성됐음을 검증하고, 불일치가 관측되면 빌드 실패로 판정한다.
