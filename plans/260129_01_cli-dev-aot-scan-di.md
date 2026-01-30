---
status: draft
allowed_paths:
	- packages/cli/**
	- packages/core/**
	- packages/common/**
	- tooling/**
	- examples/**
	- plans/**
	- tasks/**
---

# Run Plan

## Agent Handshake

페르소나 **@Architect**로서 작업을 시작합니다. **AGENTS.md (E0)**에 명시된 행동 제한 규약을 숙지하였으며, 작업 도중 불확실성 발생 시 즉시 중단(STOP IF UNCERTAIN)할 것을 서약합니다.

---

## 0) Metadata (필수)

- Plan ID: `260129_01_cli-dev-aot-scan-di`
- Created at (UTC): `2026-01-29`
- Owner: `user`
- Related: `none`
- Target branch: `main`
- Tooling constraints (선택): `bun (repo default)`

---

## 1) 원문(사용자 입력) (필수)

- 원문:
	- "CLI dev 커맨드 관련 작업 진행한다. 이번 작업의 스코프는 아래와 같다

CLI dev 커맨드 실행시 bunner.{json,jsonc} 를 읽고 엔트리 파일부터 빌드타임에 스캔한다.
엔트리 파일의 createApplication 의 정보와 entry module 의 defineModule 그리고 코드베이스 전체를 스캔해서 bunner.jsonc 에 명시된 module.fileName 의 파일명을 전수조사해서 디렉토리 구조와 모듈 구조를 분석한다. 모듈 내의 Injectable 을 찾아 모듈에 배치시키고 scope 를 잡는다. DI 기능도 구현해야한다. 스펙문서를 모두 읽고 내가 말한 내용을 어떻게 구현해야 할지 계획 템플릿을 작성해라. 그리고 스펙문서가 닫히지않아 내용이 더 필요한 것들은 나에게 질문해라.

프로젝트엔 보그들이 많다 그리고 레거시 기능들도 많다. 철저히 배제하고 현재 구현해야될 것들에만 집중한다."

- 사용자 입력을 구조화(해석 금지):
	- Change target:
		- `bunner dev` 실행 시 config 로드/스캔/분석/아티팩트 생성
		- AOT 스캐닝(createApplication / defineModule / Injectable / inject() / DI graph)
	- Success condition:
		- `bunner dev`가 `bunner.json` 또는 `bunner.jsonc`를 읽는다.
		- `bunner.json`과 `bunner.jsonc`가 공존하면 빌드타임 에러가 발생한다.
		- `sourceDir`는 필수이며, 스캔 루트(= project-tree root)로 사용된다.
		- `entry`는 파일 경로(path)이며(파일명만 허용하지 않음), `sourceDir` 하위여야 한다(위반 시 빌드타임 에러).
		- `sourceDir` 하위 recognized file 집합에서 `createApplication(...)`을 빌드타임에 식별한다(엔트리 파일에 없을 수 있음).
		- `module.fileName`에 해당하는 파일을 전수 조사하여 모듈 디렉토리 구조를 결정론적으로 판정한다.
		- 모듈 내 `@Injectable`을 수집하여 모듈에 배치하고 scope/visibility를 결정론적으로 해석한다.
		- `inject()` call을 수집/해석하여 DI graph에 포함하고, 파일 귀속 규칙으로 모듈에 배치한다.
		- DI wiring/graph를 빌드타임에 구성하고(순환/위반은 build 실패), 런타임 스캔/리플렉션에 의존하지 않는다.
	- Explicit constraints:
		- 레거시/보그/범위 외 기능은 배제

- SSOT 충돌 여부:
	- [ ] 없음
	- [ ] 있음 → [workflow.md](../.agent/workflow.md)의 중단/논의 절차로 이관

---

## 2) Spec Binding (필수)

이 Plan이 구현하려는 SPEC:

- Primary SPEC:
	- `docs/30_SPEC/app/app.spec.md#3.3 Shape Rules`
	- `docs/30_SPEC/di/di.spec.md#3.3 Shape Rules`
	- `docs/30_SPEC/di/wiring.spec.md#3.3 Shape Rules`
	- `docs/30_SPEC/module-system/module-system.spec.md#3.3 Shape Rules`
	- `docs/30_SPEC/module-system/define-module.spec.md#3.3 Shape Rules`
	- `docs/30_SPEC/module-system/manifest.spec.md#3.3 Shape Rules`
	- `docs/30_SPEC/provider/provider.spec.md#3.3 Shape Rules`
	- `docs/30_SPEC/common/declarations.spec.md#3.3 Shape Rules`

- Secondary SPEC (참조):
	- `docs/30_SPEC/cli/diagnostics.spec.md#7. 진단 매핑(Diagnostics Mapping)`
	- `docs/30_SPEC/cli/handler-id.spec.md#3.3 Shape Rules`
	- `docs/30_SPEC/compiler/aot-ast.spec.md#` (AOT 수집/결정성 제약 확인용)
	- `docs/30_SPEC/compiler/config.spec.md#3.3 Shape Rules`
	- `docs/30_SPEC/compiler/manifest.spec.md#3.3 Shape Rules`

이 Plan에서의 SPEC 변경:

- [x] 없음(게이트)

- [ ] Section Gate: 이 섹션은 위 규칙을 모두 만족한다.

---

## 3) Open Questions (STOP 후보)

- Step Start Gate:
	- [ ] Open Questions가 비어 있음

- Unresolved (STOP):
	- none

- Resolved: config 정책
	- `bunner.json` 또는 `bunner.jsonc`만 허용
	- 둘 다 존재하면 build-time error
	- `bunner.config.ts`/`bunner.config.json`는 비범위(유기)이며, CLI는 로드/폴백/자동탐색을 하지 않는다.
	- `sourceDir`는 필수
	- `entry`는 project root 기준 파일 경로(path)이며, `sourceDir` 하위여야 한다(위반 시 build-time error)

- Resolved: "엔트리 파일부터 스캔" 해석(정합)
	- Entry 스캔은 `createApplication(...)`에서 entry module 식별(= app-entry)만을 위한 빌드타임 스캔으로 한정
	- Module boundary(= module.fileName 전수조사 + 디렉토리 경계)는 import 그래프와 무관하게 filesystem(project-tree) 기반으로 수행
	- 근거: `docs/30_SPEC/module-system/boundary.spec.md#3.3 Shape Rules`의 project-tree 입력 및 `MODULE-SYSTEM-BOUNDARY-R-008`

- Resolved: createApplication 수집 범위
	- 현재 스코프는 entry module만(추가 옵션 수집 없음)

- Resolved: orphan 정의/처리
	- orphan = "framework-recognized file"이 module root(= fileName을 포함하는 디렉토리)의 어떤 중첩 루트에도 귀속되지 못하는 케이스
	- 근거: `MODULE-SYSTEM-BOUNDARY-R-008` (every framework-recognized file is attributed to exactly one module)
	- 처리: build-time error (file not attributed / multiply attributed)
	- 가능한 발생 케이스 예시(해석이 아닌 구조적 예):
		- 어떤 파일이 존재하지만, 해당 파일의 디렉토리 또는 상위 디렉토리 어느 곳에도 `module.fileName`이 존재하지 않음

- Resolved: Injectable 모듈 배치 규칙
	- 배치 기준은 "파일 → 모듈 귀속" 규칙을 따른다(closest enclosing module root)
	- 근거: `docs/30_SPEC/module-system/boundary.spec.md#3.3 Shape Rules`의 `MODULE-SYSTEM-BOUNDARY-R-004`

- Resolved: `@Injectable` decorator
	- `@Injectable` 데코레이터는 이미 구현되어 있으며, AOT는 그 결과를 수집/해석한다.

- Resolved: `@Inject` decorator 가정 제거
	- 본 스코프에서는 `@Inject` 데코레이터를 전제하지 않는다(존재하지 않는다고 사용자 확인).
	- 의존성 표현은 `@Injectable` + `inject()` 기반으로 수집/해석한다.

- Resolved: "framework-recognized file" 파일 집합(결정론)
	- project-tree root = `sourceDir`
	- recognized file = `sourceDir` 하위의 소스 파일 중, 분석 대상 필터에 매칭되는 파일
		- 기본 필터(현행 CLI 기준): `.ts` (단, `.d.ts`/`*.spec.ts`/`*.test.ts` 제외)
	- `MODULE-SYSTEM-BOUNDARY-R-008` 판정은 이 recognized file 집합에 대해서만 수행한다.

- Resolved: inject-call 표면 + TokenThunk 허용 + DI-R-008 준수
	- inject-call 표면은 call-expression으로 고정한다.
		- `inject(Token)`
		- `inject(() => Token)` (TokenThunk 허용)
	- 런타임에서는 inject-call이 wiring으로 대체되어야 하며, 런타임에서 `inject()` 실행은 금지된다(DI-R-008).
	- `inject()`는 `packages/common`에 위치하며, 런타임 token resolution을 수행하지 않는다.
		- TokenThunk는 런타임에 실행되면 안 된다(COMMON-DECLARATIONS-R-008).

- Resolved: runtime container scanning/해결
	- 본 워크플로(`bunner dev` AOT)는 런타임 컨테이너 스캔/리플렉션 기반 해결에 의존하지 않는다(DI-R-007).
	- 레거시 스캐너의 개선/유지/삭제는 본 Plan의 Non-Goals이며, AOT 경로에서 import/호출하지 않는다.

- Resolved: config MUST 스냅샷 누락(Q3)
	- `docs/30_SPEC/compiler/config.spec.md#3.3 Shape Rules`의 규칙을 MUST-10~12로 추가 스냅샷한다.

---

## 4) SPEC MUST SNAPSHOT (필수, 원문 복사)

### Snapshot Metadata (권장)

- Captured at (UTC): `2026-01-29`
- Captured by: `agent`
- SPEC revision:
	- none

- MUST-1:
	- Source: `docs/30_SPEC/app/app.spec.md#3.3 Shape Rules`
	- Quote:

		```text
		| APP-R-002 | active                      | MUST            | inputs, outcomes            | InputKind:app-entry, Outcome:OUT-002                               | createApplication takes exactly one entry module and it is statically resolvable                                             | build                             |
		```

- MUST-2:
	- Source: `docs/30_SPEC/app/app.spec.md#3.3 Shape Rules`
	- Quote:

		```text
		| APP-R-018 | active                      | MUST            | outcomes                    | Outcome:OUT-018                                                    | BunnerApplication is unique per process/worker; multiple createApplication calls are rejected by CLI as error                | build                             |
		```

- MUST-3:
	- Source: `docs/30_SPEC/module-system/define-module.spec.md#3.3 Shape Rules`
	- Quote:

		```text
		| DEFINE-MODULE-R-003 | active | MUST | outcomes | Outcome:OUT-003 | each module file contains at most one defineModule call | build |
		```

- MUST-4:
	- Source: `docs/30_SPEC/module-system/module-system.spec.md#3.3 Shape Rules`
	- Quote:

		```text
		| MODULE-SYSTEM-R-001 | active | MUST | inputs, artifacts, shapes, outcomes | InputKind:module-fileName, Artifact:ModuleSystemData, Shape:local:ModuleSystemData, Outcome:OUT-001 | module boundary is directory-first and deterministic   | build |
		```

- MUST-5:
	- Source: `docs/30_SPEC/di/di.spec.md#3.3 Shape Rules`
	- Quote:

		```text
		| DI-R-001 | active | MUST | inputs, artifacts, shapes, outcomes | InputKind:inject-call, Artifact:DiContractData, Shape:local:DiContractData, Outcome:OUT-001 | wiring is build-time only and cycles fail build | build |
		```

- MUST-6:
	- Source: `docs/30_SPEC/di/di.spec.md#3.3 Shape Rules`
	- Quote:

		```text
		| DI-R-007 | active | MUST NOT | outcomes | Outcome:OUT-007 | runtime reflection/container scanning resolves dependencies | runtime |
		```

- MUST-7:
	- Source: `docs/30_SPEC/common/declarations.spec.md#3.3 Shape Rules`
	- Quote:

		```text
		| COMMON-DECLARATIONS-R-008 | active | MUST NOT | outcomes | Outcome:OUT-008 | TokenThunk is executed at runtime or used for runtime token resolution | runtime |
		```

- MUST-8:
	- Source: `docs/30_SPEC/module-system/manifest.spec.md#3.3 Shape Rules`
	- Quote:

		```text
		| MANIFEST-R-002 | active | MUST | shapes | Shape:local:BunnerManifest | modules, diGraph.nodes, handlerIndex are sorted deterministically by id | build |
		```

- MUST-9:
	- Source: `docs/30_SPEC/provider/provider.spec.md#3.3 Shape Rules`
	- Quote:

		```text
		| PROVIDER-R-003 | active | MUST | inputs, artifacts, shapes, outcomes | InputKind:provider-scope, Artifact:ProviderContractData, Shape:local:ProviderContractData, Outcome:OUT-003 | provider scope is explicitly declared or decidable; otherwise build fails                                     | build                             |
		```

- MUST-10:
	- Source: `docs/30_SPEC/compiler/config.spec.md#3.3 Shape Rules`
	- Quote:

		```text
		| COMPILER-CONFIG-R-001 | active | MUST | inputs, outcomes | InputKind:project-root, Outcome:OUT-001 | bunner config source path is exactly `<PROJECT_ROOT>`/bunner.json or `<PROJECT_ROOT>`/bunner.jsonc; if both exist or neither exists, build fails | build |
		```

- MUST-11:
	- Source: `docs/30_SPEC/compiler/config.spec.md#3.3 Shape Rules`
	- Quote:

		```text
		| COMPILER-CONFIG-R-002 | active | MUST | inputs, outcomes | InputKind:bunner-config, Outcome:OUT-002 | config source format is json or jsonc; build parses the config file to produce resolvedConfig and does not execute config as code | build |
		```

- MUST-12:
	- Source: `docs/30_SPEC/compiler/config.spec.md#3.3 Shape Rules`
	- Quote:

		```text
		| COMPILER-CONFIG-R-003 | active | MUST | shapes, outcomes | Shape:local:ContractData, Outcome:OUT-003 | resolved bunner config contains module.fileName, sourceDir, entry; no default is assumed when missing; entry is within sourceDir | build |
		```

- [ ] Section Gate: 이 섹션은 위 규칙을 모두 만족한다.

---

## 5) 목적 / 기대효과 (필수)

- One-liner goal: `bunner dev`가 config+entry 기반 AOT 스캔을 수행하고, 모듈/DI 결과를 결정론적으로 산출한다.
- 기대효과:
	- dev 실행 시점에 모듈 구조/DI 위반을 빌드타임으로 조기 탐지
	- 런타임 리플렉션/스캔 없는 DI(정적 wiring)로 예측 가능한 동작
	- `.bunner/manifest.json` 및 관련 아티팩트 생성의 결정성 확보
- Success definition(간단): dev 실행 → 스캔/진단 → 아티팩트 생성(또는 위반 시 명확한 build 실패)

---

## 6) 범위(Scope) / 비범위(Non-Goals) (필수)

### Scope
- `bunner dev`에서 읽는 config를 `bunner.json`/`bunner.jsonc`로 확장(또는 전환)하고, entry 기반 스캔을 수행
- `module.fileName` 기반 모듈 루트 파일 전수 조사 + 디렉토리 우선 모듈 경계 판정
- `defineModule()` / module marker export 제약을 빌드타임에서 검증
- `@Injectable` / `inject()` 기반 DI graph 구성 + 위반 진단
- manifest에 `modules`/`diGraph` 포함 및 deterministic sorting 유지

### Non-Goals

- 레거시 API/비사용 기능 정리, 대규모 리팩토링
- 런타임 컨테이너 스캔/리플렉션 기반 DI
- 프로토콜(HTTP 등) I/O 및 서버 런타임 기능 확장

---

## 9) 실행 계획 (Step Gates, 필수)

> 아래 Step은 설계가 아니라 “구현 순서 + 게이트”다. 설계 결정이 필요해지면 STOP 후 Open Questions로 회귀.

<a id="Step-1"></a>

### Step 1) Config surface 정합 (bunner.json/jsonc)

- Goal: `bunner dev`가 `bunner.json` 또는 `bunner.jsonc`를 로드한다.
- Must satisfy: MUST-10, MUST-11, MUST-12
- Work items (draft):
	- `packages/cli/src/common/config-loader.ts`의 로딩 정책을 `bunner.json`/`bunner.jsonc`로 전환
	- `bunner.json`+`bunner.jsonc` 공존 시 build-time error
	- jsonc 파싱 정책 결정(주석 허용) 및 오류 진단 코드 정합
	- `bunner.config.ts`/`bunner.config.json`는 로드/폴백/자동탐색을 하지 않는다(완전 미지원)
	- config shape에 `sourceDir`(required) 및 `entry`(path, required) 반영
	- `entry`가 `sourceDir` 하위가 아니면 build-time error
- Gate:
	- config load 실패 시 진단이 결정론적으로 재현

- File → MUST IDs 매핑 (MUST):
	- packages/cli/src/common/config-loader.ts: MUST-10, MUST-11, MUST-12
	- packages/cli/src/commands/dev.command.ts: MUST-10, MUST-12
	- packages/cli/src/commands/build.command.ts: MUST-10, MUST-12

<a id="Step-2"></a>

### Step 2) createApplication 탐색 (recognized file scan)

- Goal: `sourceDir` 하위 recognized file 집합에서 `createApplication(...)` 및 entry module(ref)을 빌드타임에 식별한다.
- Must satisfy: MUST-1, MUST-2
- Work items (draft):
	- recognized file(= `sourceDir` 하위 분석 대상) 전체를 대상으로 parse
	- `createApplication` call 식별 규칙 확정(별칭 import 포함)
		- 예: `import { createApplication as ca } from ...; ca(...)`
	- entry module string-id 정규화 규칙(APP-R-017)과의 정합 확인
	- `createApplication`이 entry 파일에 없더라도 오류로 취급하지 않음(다른 파일에 있어도 됨)
- Gate:
	- `createApplication` 미발견 시 CLI build 에러
	- 다중 createApplication 관측 시 CLI build 에러(APP-R-018)

- File → MUST IDs 매핑 (MUST):
	- packages/cli/src/analyzer/ast-parser.ts: MUST-1, MUST-2
	- packages/cli/src/commands/dev.command.ts: MUST-1, MUST-2
	- packages/cli/src/commands/build.command.ts: MUST-1, MUST-2

<a id="Step-3"></a>

### Step 3) Module discovery + module.fileName 전수 조사

- Goal: `module.fileName`을 기준으로 모듈 루트 파일을 전수 조사하고, directory-first로 파일을 모듈에 배치한다.
- Must satisfy: MUST-3, MUST-4
- Work items (draft):
	- 기존 `ModuleDiscovery`/`ModuleGraph` 흐름을 `sourceDir` 기반 project-tree 스캔으로 정합
	- recognized file 전체를 대상으로 `module.fileName` 전수 조사 및 module root 결정
	- orphan 정책 적용(= recognized file이 어떤 module root에도 귀속되지 못하면 build-time error)
	- 각 module root의 `defineModule()` call과 export 제약을 검증

- File → MUST IDs 매핑 (MUST):
	- packages/cli/src/analyzer/module-discovery.ts: MUST-3, MUST-4
	- packages/cli/src/analyzer/graph/module-graph.ts: MUST-3, MUST-4
	- packages/cli/src/analyzer/ast-parser.ts: MUST-3
	- packages/cli/src/analyzer/parser-models.ts: MUST-3

<a id="Step-4"></a>

### Step 4) Injectable 수집 + scope/visibility 해석

- Goal: 각 모듈 내 `@Injectable`을 수집하고, `visibleTo` allowlist 및 scope를 결정론적으로 해석한다.
- Must satisfy: MUST-5, MUST-6, MUST-7, MUST-9
- Work items (draft):
	- `@Injectable` 옵션 파싱(visibleTo, scope)
	- `inject()` call 수집 및 deps 반영(= inject-call 입력)
	- scope 위반(예: singleton → request 의존) 진단

- File → MUST IDs 매핑 (MUST):
	- packages/cli/src/analyzer/ast-parser.ts: MUST-5, MUST-6, MUST-7, MUST-9
	- packages/cli/src/analyzer/graph/module-graph.ts: MUST-5, MUST-6, MUST-7, MUST-9

<a id="Step-5"></a>

### Step 5) DI Graph 구성(순환/위반은 build 실패)

- Goal: 빌드타임에서 DI 그래프를 구성하고, 런타임 스캔/리플렉션 없이 wiring을 생성한다.
- Must satisfy: MUST-5, MUST-6, MUST-7, MUST-9
- Work items (draft):
	- `inject()` 함수 구현 상태 확인 및(현재 미구현) 기능 구현 필요 시 반영
	- CLI AOT 분석에서 `inject()` call을 그래프 노드/엣지로 포함
	- `inject()` call의 모듈 배치는 파일 귀속 규칙(closest enclosing module root)을 따른다
	- cycle detection 및 오류 메시지/진단 코드 확정
	- visibility allowlist 적용 및 위반 시 build 실패

- File → MUST IDs 매핑 (MUST):
	- packages/common/src/helpers.ts: MUST-5, MUST-6, MUST-7, MUST-9
	- packages/cli/src/analyzer/ast-parser.ts: MUST-5, MUST-6, MUST-7, MUST-9
	- packages/cli/src/analyzer/graph/module-graph.ts: MUST-5, MUST-6, MUST-7, MUST-9
	- packages/cli/src/generator/injector.ts: MUST-5, MUST-6, MUST-7, MUST-9

<a id="Step-6"></a>

### Step 6) Manifest 산출 정합

- Goal: `modules`/`diGraph`를 포함하는 manifest를 deterministic하게 생성한다.
- Must satisfy: MUST-8
- Work items (draft):
	- arrays sorting by id 보장
	- config sourcePath/sourceFormat/resolvedModuleConfig 동기화

- File → MUST IDs 매핑 (MUST):
	- packages/cli/src/generator/manifest.ts: MUST-8

<a id="Step-7"></a>

### Step 7) Dev watcher/증분 재빌드

- Goal: 파일 변경 시 분석 캐시를 갱신하고, manifest/아티팩트를 재생성한다.
- Must satisfy: MUST-8
- Work items (draft):
	- rename/delete 처리의 결정성 유지
	- entry 기반 스캔을 증분 rebuild에 반영

- File → MUST IDs 매핑 (MUST):
	- packages/cli/src/commands/dev.command.ts: MUST-8
	- packages/cli/src/watcher/project-watcher.ts: MUST-8

---

## 10) 검증 매트릭스 (MUST → Evidence, 필수)

| MUST ID | Evidence ID  | Step   | Evidence (요약) |
| ------ | ------------ | ------ | --------------- |
| MUST-10 | MUST-EVID-10 | Step 1 | config source 선택(bunner.json/jsonc) 및 공존/부재 오류 |
| MUST-11 | MUST-EVID-11 | Step 1 | json/jsonc 파싱(코드 실행 없음) |
| MUST-12 | MUST-EVID-12 | Step 1 | sourceDir/entry/module.fileName 필수 + entry within sourceDir |
| MUST-1 | MUST-EVID-1  | Step 2 | entry module 결정론적 식별 |
| MUST-2 | MUST-EVID-2  | Step 2 | 다중 createApplication 시 build error |
| MUST-3 | MUST-EVID-3  | Step 3 | 동일 module file 내 defineModule 2회면 build error |
| MUST-4 | MUST-EVID-4  | Step 3 | 모듈 경계 판정 deterministic |
| MUST-5 | MUST-EVID-5  | Step 5 | DI cycle 존재 시 build failure |
| MUST-6 | MUST-EVID-6  | Step 5 | 런타임 스캔/리플렉션 호출 경로 없음 |
| MUST-7 | MUST-EVID-7  | Step 5 | TokenThunk runtime 실행 없음 |
| MUST-8 | MUST-EVID-8  | Step 6 | manifest sorting deterministic |
| MUST-9 | MUST-EVID-9  | Step 4 | scope 비결정/위반 시 build failure |

---

## 11) Completion / Verification

- Local verification:
	- `bun run verify`
	- (선택) `bun run test` (CLI/분석기 관련 단위 테스트 추가 시)

---

## 12) Notes / Out-of-scope legacy

- 본 Plan은 "레거시 정리"를 포함하지 않는다.
- 기존 구현/버그는 본 스코프의 계약(MUST) 충족을 방해하는 경우에만 최소 수정한다.