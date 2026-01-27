---
status: accepted
allowed_paths:
  - packages/firebat/**
  - tooling/**
  - plans/**
  - tasks/**
---

# Run Plan

## 0) Metadata (필수)

- Plan ID: `260126_01_firebat_pure-code-quality`
- Created at (UTC): `2026-01-26`
- Owner: `user`
- Related: `none`
- Target branch: `main`

### Persona / Handshake

- Persona:
  - `@Architect`

- Handshake (AGENTS.md 형식 그대로):
  - "페르소나 **@Architect**로서 작업을 시작합니다. **AGENTS.md (E0)**에 명시된 행동 제한 규약을 숙지하였으며, 작업 도중 불확실성 발생 시 즉시 중단(STOP IF UNCERTAIN)할 것을 서약합니다."

---

## 1) 원문(사용자 입력) (필수)

- 원문:
  - "이전에 말한 디렉토리 구조와 새로 만들어야할 기능들과 현재의 기능들을 모두 취합해서 계획문서를 만들어라"
  - "일단 파이어뱃에 집중한다. 파이어뱃의 기능은 일단 프레임워크와는 완전 별개로 순수 코드의 품질을 위해 기능을 구현"
  - "3) 구조적 중복(Structural Duplication) + 리팩터 후보군 같은 기능들을 선구현"
  - "(1, 5, 6, 7) + early return/복잡도/depth를 엮어서 기능도 구현"
  - "각 기능마다 모듈화를 하는것이 좋겠다"

- 사용자 입력을 구조화(해석 금지):
  - Change target:
    - Firebat(`packages/firebat`)에 순수 코드 품질 분석 기능을 단계적으로 확장
    - 분석 기능을 기능별 모듈로 분리(모듈화)
    - (가능하면) 디렉토리 구조를 분석기 확장에 유리하게 재정렬
  - Success condition:
    - 현재 기능(duplicates, waste)은 유지
    - 신규 기능(1,5,6,7 + nesting/earlyReturn/coupling) 추가를 위한 구조/계획/단계가 명확
    - CLI 출력이 사람/도구 친화적(텍스트 + JSON 중심)
  - Explicit constraints:
    - 프레임워크 의존 없이 “순수 코드 품질” 중심
    - oxlint/tsc/knip이 잘하는 영역(단순 unused/스타일)에 과도하게 겹치지 않기
    - 코드 변경이 자주 예상되므로, **유닛 테스트는 작성하지 않고** **Public API 기반 통합 테스트만 작성**한다.

- SSOT 충돌 여부: `none`

---

## 2) Spec Binding (필수)

> Firebat 전용 L3 spec 문서의 존재 여부는 확인이 필요하다.
> 본 Plan은 “도구 내부 구현 계획”이며, SSOT 변경을 포함하지 않는다.

- Primary SPEC:
  - `docs/30_SPEC/SPEC.md#SPEC-(Index)`

- Secondary SPEC (참조):
  - none

- 이 Plan에서의 SPEC 변경:
  - [x] 없음(게이트)

- Section Gate: `pass`

---

## 3) Open Questions (STOP 후보)

- none

### 3.1) Locked Decisions (구체화, Plan에서만 확정)

- D1: Firebat 전용 L3 spec 문서(`docs/30_SPEC/**`)는 본 Plan 범위에서 생성하지 않는다.
  - 이유: 본 Plan은 내부 구현/리포트 구조 확장에 집중하며, SSOT/SPEC 작업은 별도 Plan으로 분리한다.

- D2: Report 스키마 vNext는 “additive only”를 기본 원칙으로 한다.
  - 리포트는 `meta` + `analyses`의 2-파트 구조로 고정한다.
  - 모든 기능 결과(기존 + 신규)는 `analyses` 아래에서 같은 레벨로 제공한다(legacy top-level 분리/미러링 금지).
  - 별도의 `schemaVersion` 필드는 도입하지 않는다(현재 `meta.version`을 유지).

- D3: vNext에서 사용할 `analyses`의 canonical key는 아래로 고정한다.
  - `duplicates`
  - `waste`
  - `dependencies`
  - `coupling`
  - `duplication`
  - `nesting`
  - `earlyReturn`
  - `noop`
  - `apiDrift`

- D4: CLI detector id(옵션 입력 문자열) canonical set은 아래로 고정한다.
  - `duplicates`, `waste`, `dependencies`, `coupling`, `duplication`, `nesting`, `early-return`, `noop`, `api-drift`
  - Note: report에서는 `apiDrift`(camelCase), CLI에서는 `api-drift`(kebab-case)를 사용한다.
  - Note: “branching”은 detector key로 두지 않고, `decisionPoints`(결정 지점 수) 메트릭으로만 사용한다.

- D5: `roaring` 제거의 1순위 기준은 Bun 환경에서의 결정성/휴대성(네이티브 `.node` 직접 import 제거)이다.
  - 성능 동급 보장은 본 Plan 범위에서 요구하지 않는다.
  - Step-2의 기본 후보는 `fastbitset`으로 고정한다(교체/추가 후보 채택 시 Plan Step-2에서 근거 갱신).

---

## 4) SPEC MUST SNAPSHOT (필수, 원문 복사)

- MUST-1:
  - Report 스키마 vNext를 설계하고(`text/json` 호환 유지), 신규 분석 결과를 확장 가능한 형태로 수용한다.
- MUST-2:
  - `roaring` 제거를 위한 BitSet 대체 전략을 확정하고, `engine/dataflow.ts`의 네이티브 `.node` 직접 import 제거를 목표로 삼는다.
- MUST-3:
  - Dependency Graph Smells(사이클, fan-in/out)를 Public API 기반 결과로 리포트한다.
- MUST-4:
  - Structural Duplication(near-miss 포함) 분석을 clone class(클러스터) 단위로 리포트한다.
- MUST-5:
  - Nesting + Early Return 메트릭(및 decision points)을 결합해 “리팩터 우선순위” 신호로 제공한다.
- MUST-6:
  - Semantic No-op/Redundant Logic을 confidence/evidence와 함께 리포트한다.
- MUST-7:
  - API Shape Drift를 군집화하고 표준 후보/이탈 그룹을 함께 리포트한다.
- MUST-8:
  - CLI wiring/output 확장을 통해 신규 분석기를 선택 실행하고, `--format json`을 자동화 친화적으로 유지한다.

---

## 5) 목적 / 기대효과 (필수)

- One-liner goal:
  - Firebat을 “순수 코드 품질 분석기”로 확장하고, 사람이 고칠 우선순위를 결정 가능한 리포트로 제공한다.

- 기대효과:
  - 중복/복잡도/의존성 악취/의미 없는 로직/형상 드리프트를 “리팩터 후보군”으로 묶어 제시
  - lint/tsc 수준을 넘어 “프로젝트 레벨(다중 파일) 의미 분석”을 제공

- Success definition(간단):
  - Firebat이 duplicates/waste를 유지하면서, 신규 분석기(duplication 확장, dependencies/coupling, no-op, api drift, nesting/earlyReturn)를 모듈화된 구조로 추가할 수 있다.

---

## 6) 범위(Scope) / 비범위(Non-Goals) (필수)

- Scope:
  - Firebat(`packages/firebat`)의 “순수 코드 품질 분석” 기능 확장
  - 기존 기능(`duplicates`, `waste`) 유지 + 모듈화된 신규 분석기 추가
  - 출력은 `text/json` 중심으로 유지

- Non-Goals:
  - 프레임워크/런타임 종속 기능(Web/Devtools 전용 UX)
  - oxlint/tsc/knip 수준의 단일 파일 룰/스타일 강제(중복 영역)
  - 외부 네트워크/비결정적 환경 의존(E2E 인프라) 테스트

---

## 6.1) 현 상태(Existing) 인벤토리

### 6.1.1 현재 디렉토리(요약)

- [packages/firebat/src](packages/firebat/src)
  - `firebat.ts`: CLI 실행 엔트리(`runFirebat`), 옵션 파싱, report 생성/출력
  - `arg-parse.ts`: `--format`, `--min-tokens`, `--tsconfig`, `--only`, `--no-exit`
  - `report.ts`: text/json 출력
  - `duplicate-detector.ts` + `engine/duplicate-detector-oxc.ts`: 중복 탐지
  - `resource-waste-detector.ts` + `engine/resource-waste-detector-oxc.ts`: resource waste 탐지
  - `engine/*`: oxc wrapper, fingerprint/token count, variable collector, dataflow/cfg 관련 구성요소
  - `ts-program.ts`: 파일 집합/tsconfig 로딩(현재는 ParsedFile 생성 경로 포함)

### 6.1.2 현재 제공 기능

- Detector: `duplicates`
  - 최소 토큰 기준(`--min-tokens`) 기반 그룹핑

- Detector: `waste`
  - 리소스 낭비(현재는 `dead-store`, `dead-store-overwrite` 등)

- Output:
  - `text`(기본), `json`

### 6.1.3 현재 의존성/기술 부채(핵심)

- `roaring` 의존이 존재하며, 현재 구현은 `packages/firebat/src/engine/dataflow.ts`에서 `node_modules/roaring/native/.../*.node`를 직접 경로로 동적 import 한다.
  - 이 방식은 플랫폼/ABI/런타임 변화에 취약하며(특히 Bun 환경), 순수 코드 품질 분석기의 “결정성/휴대성” 목표와 충돌한다.

---

## 7) 목표 기능(New) 목록 (프레임워크 무관 / 순수 코드 품질)

### 7.1 (1) Structural Duplication 확장

- 목표:
  - 현재 duplication을 “near-miss/구조적 유사”까지 확장하고, clone class(클러스터)로 묶어 리팩터 후보군을 만든다.
- 핵심:
  - 단순 토큰 중복을 넘어 이름/리터럴 차이, 조건 순서 차이를 흡수하는 정규화(fingerprint)

### 7.2 (5) Dependency Graph Smells

- 목표:
  - import 그래프 기반 품질 악취 탐지
    - cycle(순환)
    - fan-in/fan-out 과다
    - unstable dependency(변동성/중심성 기반은 향후)
- 출력:
  - “문제 나열”이 아니라, cycle의 경로/끊기 후보 힌트(edge cut) 포함

### 7.2.1 (확장) Coupling / Hotspot (프로젝트 레벨 우선순위)

- 목표:
  - dependency graph를 근거로 “어디부터 고칠지”를 결정 가능한 coupling/hotspot 신호를 제공
- 예시 신호:
  - fan-in/out, cycle(SCC) 참여도, 중심성(허브)
  - (향후) 다른 분석 결과(duplicates/nesting/earlyReturn 등)와 합성한 우선순위 스코어

### 7.3 (6) Semantic No-op / Redundant Logic

- 목표:
  - 의미 없는 로직(항상 참/거짓, 항상 같은 반환, unreachable/irrelevant branch)을 “증거 + 확신도”로 보고
- 오탐 방지:
  - confidence score, evidence(근거 노드/경로) 중심

### 7.4 (7) API Shape Drift

- 목표:
  - 유사한 역할의 함수/메서드들이 시그니처/반환/에러 처리 형태가 제각각인 드리프트를 군집화
- 출력:
  - ‘표준 후보’와 ‘이탈 그룹’을 함께 제시

### 7.5 (신규) Nesting + Early Return (리팩터 제안형)

- 목표:
  - 단순 룰 강제가 아니라 “리팩터 우선순위”를 위한 신호로 결합
- 예시 제안 카드:
  - Guard clauses 도입 후보(early return 부족 + 깊은 중첩)
  - Extract function 후보(LOC/결정 지점 수/깊은 중첩)

- Note:
  - “branching”을 detector 명으로 쓰지 않는다.
  - 분기/결정 지점 수는 `decisionPoints` 메트릭으로만 제공한다.

### 7.6 (필수) `roaring` 제거 및 BitSet 대체

- 목표:
  - `packages/firebat/package.json`의 `roaring` 의존성을 제거하고, 순수 JS/TS 또는 WASM 기반의 이식 가능한 BitSet 구현으로 대체한다.
  - `engine/dataflow.ts`의 `node_modules/.../*.node` 직접 import를 제거한다.

- 웹 기반 후보(인터넷 확인):
  - `fastbitset` (Apache-2.0): 성능 최적화 BitSet, 단 TypeScript 타입은 `@types/fastbitset`로 분리되어 있음
  - `bitset` (MIT): TypeScript 선언 내장, and/or/andNot 등 bitwise set operations 제공
  - `roaring-wasm` (Apache-2.0): roaring 대체 WASM 포트(크로스플랫폼), 단 초기화/메모리/바이너리 크기 트레이드오프 존재

- 선택 가이드(결정 기준):
  - 1순위: Bun 환경에서의 결정성(설치/실행 안정성)
  - 2순위: 타입 지원(내장 d.ts 선호)
  - 3순위: 성능(분석 대상 규모 기준으로 수용 가능)

---

## 8) 목표 디렉토리 구조(합의 초안)

> 기존 구현을 한 번에 다 옮기지 않고, “새 기능부터 새 구조에 추가”하고 기존 기능을 단계적으로 이관한다.

```text
packages/firebat/
  src/
    firebat.ts                 # (현) CLI entry (추후 cli/로 이동 가능)
    arg-parse.ts               # (현)
    report.ts                  # (현)
    engine/                    # (현) oxc 기반 분석 파편들이 존재

    analyses/                  # (신규) 기능별 분석 모듈
      duplication/
      dependencies/
      no-op/
      api-drift/
      coupling/
      nesting/
      early-return/

    ir/                        # (신규) 공통 중간표현 (파일/함수/그래프/핑거프린트)
    report/                    # (신규) 공통 report schema + baseline/증분
    parse/                     # (선택) oxc-wrapper 등 파서 경계
```

> Note: 실제 리팩터 단계에서 `firebat.ts`/`arg-parse.ts`를 `cli/*`로 옮길지 여부는 Implementation 단계에서 결정한다.

---

## 8.5) 리팩터링 시 데드 코드/파일 처리 규칙(강제)

본 Plan에 포함된 리팩터링 작업에서 데드 코드/데드 파일이 확인되면, 결과물에 “잔존”시키지 않고 완전 삭제한다.

- 근거 정책: [docs/50_GOVERNANCE/DEAD_CODE_POLICY.md](docs/50_GOVERNANCE/DEAD_CODE_POLICY.md)
- 강제 규칙:
  - 삭제를 대신해 빈 파일, `{}`, `export {}`, no-op 함수, 주석 흔적(Tombstone)을 남기지 않는다.
  - 제거 전에 “왜 데드인지”를 증명하고(검색/참조 그래프/verify 등), 변경 로그 또는 PR 설명에 증거를 남긴다.
  - `Valueless` 분류 제거는 사용자(maintainer) 승인 없이 확정하지 않는다.

---

## 8.6) 테스트 전략(강제): Integration Only + Public API

코드 변경이 잦을 것으로 예상되므로, 본 Plan의 모든 구현 단계에서 테스트는 아래 원칙을 강제한다.

- **Unit Test는 작성하지 않는다.**
- **Integration Test만 작성한다.** (파일 패턴: `*.test.ts`, 위치: `packages/firebat/test/integration/**`)
- **Public API를 통해서만 테스트**한다.
  - 기본값: Firebat의 “Public API”는 `packages/firebat` 패키지 엔트리(또는 CLI 인터페이스)로 정의한다.
  - 금지: `src/**`로의 deep import, 내부 구현/파일 단위 함수 직접 호출
  - 주의: 향후 `packages/firebat/index.ts`에서 테스트에 필요한 export를 추가/변경하는 경우, 이는 Public Facade 변경이므로 Implementation 단계에서 승인 아티팩트가 필요하다.
  - 정리: 현 시점에 `test/integration/**`가 `src/**`를 직접 import하고 있다면, 본 정책을 만족하도록 Public API 기반으로 이관한다.
- 가능한 한 **Hermetic** 하게 구성한다. (테스트가 필요로 하는 입력은 in-memory로 주입 가능해야 한다)

---

## 9) 실행 계획 (Step Gates, 필수)

### 9.0) 권장 실행 순서 (즉시 작업 가능화를 위한 운영 가이드)

- Gate-0 (필수): Step 2(`roaring`)을 먼저 완료한다.
  - 목표: `engine/dataflow.ts`의 네이티브 `.node` 직접 import 제거 + BitSet 대체로 완전 교체
  - 주의: 실제 deps 변경(`packages/firebat/package.json`)이 발생하면 승인 아티팩트가 필요하므로, 교체 구현 착수 직전에 승인 게이트를 통과해야 한다.

- Gate-1 (권장): `bun run verify`의 현재 실패 원인을 triage하여 “baseline(현 브랜치 기준) 기록/안정화”를 끝낸다.
  - 이유: 각 Task의 Evidence/Verification Gate에 `bun run verify` 결과를 기록해야 하며, 실패 상태에서는 Step별 완료 증거를 채울 수 없다.

- 권장 순서(의존 관계 기준, Step-2 이후):
  1. Step 1: Report 스키마 vNext (모든 신규 분석 결과의 공통 착지점)
  2. Step 8: CLI wiring/output (선택 실행/JSON 출력 안정화로 이후 Step 검증을 쉽게)
  3. Step 3: Dependencies + Coupling (graph 기반 공통 증거/우선순위 신호)
  4. Step 5: Nesting + EarlyReturn (함수 단위 메트릭/제안 카드)
  5. Step 4: Structural Duplication (near-miss 확장)
  6. Step 6: Semantic No-op
  7. Step 7: API Drift

<!-- markdownlint-disable MD033 -->

<a id="Step-1"></a>

### Step 1) Report 스키마 vNext 설계(호환 유지)

- 목표:
  - 기존 `FirebatReport`에 신규 분석 결과를 추가할 수 있는 구조 확정
  - `text/json` 출력은 유지

- Contract (고정):
  - JSON 최상위 키는 `meta`, `analyses`를 가진다.
  - `analyses` 아래 canonical key는 §3.1(D3)을 따른다.

- Files to change (expected):
  - packages/firebat/src/types.ts
  - packages/firebat/src/report.ts

- File → MUST IDs 매핑 (MUST):
  - packages/firebat/src/types.ts: MUST-1
  - packages/firebat/src/report.ts: MUST-1

<a id="Step-2"></a>

### Step 2) `roaring` 제거 계획 확정(대체 패키지 선정)

- 목표:
  - `engine/dataflow.ts`의 BitSet 구현 요구사항(연산 종류/성능/최대 인덱스 범위)을 정리한다.
  - 위 7.6 후보 중 1개를 선택하고, 제거/교체 작업의 변경 범위를 고정한다.

- Contract (고정):
  - 네이티브 `.node` 직접 import는 제거한다.
  - 선택 기준/기본 후보는 §3.1(D5)을 따른다.

- 산출물:
  - 대체 패키지 결정 기록(왜 이 선택인지)
  - 변경 대상 파일 목록(예: `engine/dataflow.ts`, `engine/types.ts`, `package.json` 등)

- Files to change (expected):
  - plans/260126_01_firebat_pure-code-quality.md
  - packages/firebat/src/engine/dataflow.ts
  - packages/firebat/src/engine/types.ts
  - packages/firebat/package.json

- File → MUST IDs 매핑 (MUST):
  - plans/260126_01_firebat_pure-code-quality.md: MUST-2
  - packages/firebat/src/engine/dataflow.ts: MUST-2
  - packages/firebat/src/engine/types.ts: MUST-2
  - packages/firebat/package.json: MUST-2

<a id="Step-3"></a>

### Step 3) Dependency Graph Smells (5) 구현

- 목표:
  - import graph 구성 + cycle 탐지 + fan-in/fan-out 산출

- Contract (고정):
  - report의 `analyses.dependencies` 아래에 cycle path + fan-in/out top 리스트를 포함한다.
  - report의 `analyses.dependencies`는 edge cut(절단 후보) 힌트를 포함한다.
  - report의 `analyses.coupling` 아래에 hotspot(우선순위 후보) 리스트를 포함한다.

- Files to change (expected):
  - packages/firebat/src/analyses/dependencies/
  - packages/firebat/src/analyses/coupling/
  - packages/firebat/src/report.ts
  - packages/firebat/src/types.ts

- File → MUST IDs 매핑 (MUST):
  - packages/firebat/src/analyses/dependencies/: MUST-3
  - packages/firebat/src/analyses/coupling/: MUST-3
  - packages/firebat/src/report.ts: MUST-3
  - packages/firebat/src/types.ts: MUST-3

<a id="Step-4"></a>

### Step 4) Structural Duplication 확장 (1) 구현

- 목표:
  - near-miss fingerprint + clone class clustering + 리팩터 후보 제시

- Contract (고정):
  - report의 `analyses.duplication` 아래에 clone class(클러스터) 단위 결과를 포함한다.

- Files to change (expected):
  - packages/firebat/src/analyses/duplication/
  - packages/firebat/src/report.ts
  - packages/firebat/src/types.ts

- File → MUST IDs 매핑 (MUST):
  - packages/firebat/src/analyses/duplication/: MUST-4
  - packages/firebat/src/report.ts: MUST-4
  - packages/firebat/src/types.ts: MUST-4

<a id="Step-5"></a>

### Step 5) Nesting + EarlyReturn (신규) 구현

- 목표:
  - 메트릭 산출 + 리팩터 제안 카드 생성

- Contract (고정):
  - report의 `analyses.nesting` 아래에 함수/메서드 단위 depth/중첩 관련 메트릭을 포함한다.
  - report의 `analyses.earlyReturn` 아래에 guard clause/early return 신호 및 제안 카드를 포함한다.
  - “분기 수”는 `decisionPoints` 메트릭으로만 제공한다(독립 detector 금지).

- Files to change (expected):
  - packages/firebat/src/analyses/nesting/
  - packages/firebat/src/analyses/early-return/
  - packages/firebat/src/report.ts
  - packages/firebat/src/types.ts

- File → MUST IDs 매핑 (MUST):
  - packages/firebat/src/analyses/nesting/: MUST-5
  - packages/firebat/src/analyses/early-return/: MUST-5
  - packages/firebat/src/report.ts: MUST-5
  - packages/firebat/src/types.ts: MUST-5

<a id="Step-6"></a>

### Step 6) Semantic No-op (6) 구현

- 목표:
  - 확신도 기반 no-op 탐지 + evidence 제공

- Contract (고정):
  - report의 `analyses.noop` 아래에 confidence(0..1) + evidence(문자열) 포함 findings를 제공한다.

- Files to change (expected):
  - packages/firebat/src/analyses/no-op/
  - packages/firebat/src/report.ts
  - packages/firebat/src/types.ts

- File → MUST IDs 매핑 (MUST):
  - packages/firebat/src/analyses/no-op/: MUST-6
  - packages/firebat/src/report.ts: MUST-6
  - packages/firebat/src/types.ts: MUST-6

<a id="Step-7"></a>

### Step 7) API Shape Drift (7) 구현

- 목표:
  - 시그니처 shape 추출 + 군집화 + 표준 후보 제시

- Contract (고정):
  - report의 `analyses.apiDrift` 아래에 군집화 결과를 제공한다.

- Files to change (expected):
  - packages/firebat/src/analyses/api-drift/
  - packages/firebat/src/report.ts
  - packages/firebat/src/types.ts

- File → MUST IDs 매핑 (MUST):
  - packages/firebat/src/analyses/api-drift/: MUST-7
  - packages/firebat/src/report.ts: MUST-7
  - packages/firebat/src/types.ts: MUST-7

<a id="Step-8"></a>

### Step 8) CLI Wiring + Output 확장

- 목표:
  - `--only` 확장 또는 `--detectors` 체계로 신규 분석기 선택 가능
  - `--format json`을 LLM/자동화에 적합하게 안정화

- Contract (고정):
  - CLI detector id canonical set은 §3.1(D4)을 따른다.
  - `--format json`은 JSON만 출력한다(추가 프리픽스/로그 금지).

- Files to change (expected):
  - packages/firebat/src/arg-parse.ts
  - packages/firebat/src/firebat.ts
  - packages/firebat/src/report.ts

- File → MUST IDs 매핑 (MUST):
  - packages/firebat/src/arg-parse.ts: MUST-8
  - packages/firebat/src/firebat.ts: MUST-8
  - packages/firebat/src/report.ts: MUST-8

<!-- markdownlint-enable MD033 -->

---

## 10) 검증 매트릭스 (MUST → Evidence, 필수)

| MUST ID  | Evidence ID  | Step   |
| -------- | ------------ | ------ |
| MUST-1   | MUST-EVID-1  | Step 1 |
| MUST-2   | MUST-EVID-2  | Step 2 |
| MUST-3   | MUST-EVID-3  | Step 3 |
| MUST-4   | MUST-EVID-4  | Step 4 |
| MUST-5   | MUST-EVID-5  | Step 5 |
| MUST-6   | MUST-EVID-6  | Step 6 |
| MUST-7   | MUST-EVID-7  | Step 7 |
| MUST-8   | MUST-EVID-8  | Step 8 |

---

## 11) 리스크 / 완화

- 오탐 리스크(no-op, api drift):
  - confidence/evidence를 필수로 포함하고, 초기에는 gate를 약하게(리포트 중심)

- 기능 겹침 리스크(lint/tsc):
  - 단일 파일 룰 강제보다는 “클러스터링/우선순위/리팩터 제안” 중심으로 설계

- 성능 리스크:
  - 파일 캐시(해시 기반)와 분석기별 선택 실행(`--only`) 유지

- 의존성/플랫폼 리스크(`roaring`):
  - 네이티브 모듈 직접 import 제거를 최우선으로 두고, 대체 패키지 선정 시 Bun 호환성을 1순위로 평가
