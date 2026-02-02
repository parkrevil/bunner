
# Firebat vNext Plan (CLI + MCP)

이 문서는 `packages/firebat`의 vNext 목표를 달성하기 위한 **구체적 실행 계획(Phase Plan)**이다.

요구사항(필수)

- 분석 엔진: `tsgo`, `@ast-grep/*`, `oxc-parser`, `oxlint`, `sqlite`(Bun `bun:sqlite`)
- 런타임/언어: Bun + TypeScript 최신 문법(ESM, `import type`, `satisfies`, strict TS)
- 배포/실행:
  - **firebat 단독 커맨드**만 허용 (`bunner firebat` 금지)
  - MCP 실행 커맨드: `bunx -y firebat mcp` (즉, `firebat mcp` 서브커맨드 지원)
- MCP 서버는 `tsgo + ast-grep + oxc-parser` 기반으로 “정확한 추적/검출/검토”를 최상의 성능으로 제공해야 한다.
- 디렉토리/파일/패턴은 최신 모던 트렌드(직관적 계층, 꼬임 없음, 에이전트가 이해하기 쉬움)로 정렬한다.

용어(혼용 금지)

- type-aware: **oxlint의 TypeScript rule이 타입 정보를 사용하는 모드**를 의미한다(`oxlint --type-aware`).
- typecheck/tsc diagnostics: `tsc --noEmit` 진단 수집(컴파일러 진단).
- trace (tsgo): 심볼/레퍼런스/타입 기반 “추적/그래프”의 SSOT(= `firebat.traceSymbol`의 근거).

비고(현재 상태)

- 현재 firebat은 `index.ts` → `runFirebat()`로 곧바로 CLI 실행 흐름이 결합되어 있고, 분석은 `oxc-parser` 중심으로 동작한다.
- 현재 firebat은 `bunx tsc --noEmit` 기반의 typecheck(컴파일러 진단 수집)를 이미 포함한다.
- 레포에 `tsgo`, `@ast-grep`, `sqlite`, `@modelcontextprotocol/*` 기반 MCP 구현은 아직 없다(신규 도입 필요).

---

## 0) 목표 실행 UX (정확히 이 형태로 고정)

CLI

- `firebat [targets...] [options]`
- 예: `firebat src/**/*.ts --format json --only duplicates,waste`
- duplicates 임계값은 기본 `auto`가 SSOT이며, 필요 시에만 `--min-size <n>`로 override 한다.

MCP

- `firebat mcp` (로컬 설치/빌드된 바이너리)
- `bunx -y firebat mcp` (패키지 설치 없이 실행)

정책

- CLI/MCP는 동일한 코어 유스케이스(Scan/Trace)를 호출한다.
- MCP는 **절대 process.exit를 호출하지 않는다**(stdio 서버 안정성).
- CLI만 exit-code 정책을 갖는다.

---

## 1) vNext 아키텍처: Hexagonal + UseCase + Provider

핵심 원칙

- “코어(도메인/유스케이스)”는 입출력 프레임워크(CLI/MCP)에 종속되지 않는다.
- 외부 시스템은 `ports/*` 인터페이스로 추상화하고, `infrastructure/*` 구현체로 주입한다.
- 파일명만 봐도 계층이 판별되어야 한다(에이전트 가독성/추적성 최우선).

권장 디렉토리(vNext)

- `src/core/` : 도메인 타입/계약/에러 (현재 `src/types.ts`, `src/interfaces.ts`를 이쪽으로 이동)
- `src/application/` : 유스케이스(Scan/Trace), detector registry
- `src/ports/` : 교체 가능한 경계(캐시, 타입정보, 구조검색, 린트)
- `src/infrastructure/` : 실제 구현(oxc, ast-grep, tsgo, oxlint, sqlite, fs)
- `src/adapters/cli/` : argv/출력/exitcode
- `src/adapters/mcp/` : MCP server(tool/resource/prompt) + stdio transport
- `rules/` : ast-grep 룰팩(프로젝트 내 규칙 SSOT)

파일명/역할 규약

- `*.usecase.ts`: 외부로 노출되는 유스케이스 단위(스펙/테스트 기준점)
- `*.provider.ts`: 외부 도구/프로세스/SDK 래퍼(oxlint/tsgo/ast-grep)
- `*.repository.ts`: sqlite 캐시
- `*.schema.ts`: MCP tool input/output schema(zod)

---

## 2) MCP 서버 설계(도구 표면: Tools / Resources / Prompts)

MCP는 stdio 기반으로 제공한다.

### Tools (최소 v1)

- `firebat.scan`
  - 목적: 타깃 파일들을 분석하여 `FirebatReport` + 성능/캐시 메타를 반환
  - Input(초안):
    - `targets: string[]`
    - `detectors?: string[]` (예: `duplicates`, `waste`, `astgrep:*`, `tsgo:*`, `oxlint:*`)
    - `minSize?: number | "auto"` (기본: `auto`, duplicates/duplication 분석에 사용)
    - `tsconfigPath?: string`
    - `useCache?: boolean`
    - `rulesets?: string[]` (룰팩 그룹)
  - Output(초안):
    - `report: FirebatReport`
    - `timings: { parseMs, astGrepMs, tsgoMs, lintMs, totalMs }`
    - `cache: { hitFiles, missFiles }`

- `firebat.traceSymbol`
  - 목적: 타입/심볼 기반 코드 추적(정확성 최우선)
  - Input(초안):
    - `entryFile: string`
    - `symbol: string` (표현식 또는 export명)
    - `tsconfigPath?: string`
    - `maxDepth?: number`
  - Output(초안):
    - `graph: { nodes: [...], edges: [...] }`
    - `evidence: { spans: [...], references: [...] }`

- `firebat.findPattern`
  - 목적: ast-grep 기반 구조 검색/검토(룰 기반 매칭 결과)
  - Input(초안):
    - `targets: string[]`
    - `ruleId?: string`
    - `ruleYaml?: string` (inline rule)
  - Output(초안):
    - `matches: Array<{ filePath, span, text, ruleId }>`

- `firebat.lint`
  - 목적: oxlint 진단을 firebat 스키마로 반환
  - Input(초안):
    - `targets: string[]`
    - `configPath?: string`
  - Output(초안):
    - `diagnostics: [...]`

### Resources

- `firebat://report/last` : 마지막 실행 report(JSON)
- `firebat://rules/index` : 사용 가능한 ruleId + ruleset 목록

### Prompts

- `firebat.review` : report를 LLM에게 전달하기 위한 표준 프롬프트(검토/우선순위/수정 제안)

---

## 3) 성능 전략(필수): sqlite 캐시 + 해시 + 재사용

기본 저장소

- DB 파일: `.bunner/firebat/cache.sqlite`
- 준비: 디렉토리 자동 생성(없으면 생성)

캐시 키

- `projectKey`: `(tsconfigPath + lockfile hash + tool versions)`의 해시
- `fileKey`: `(filePath + contentHash)`
  - `contentHash`: 기존 `xxhash-wasm` 해셔(`src/engine/hasher.ts`)로 통일

저장 대상(최소)

- oxc 결과 요약: 토큰 카운트/핑거프린트/스팬
- ast-grep 결과 요약: ruleId별 match 스팬
- tsgo 결과 요약: 심볼/레퍼런스/타입 맵(요약/인덱스)
- 마지막 report 스냅샷(리소스 제공용)

운영

- `bun:sqlite` prepared statement를 재사용(`db.query()` 캐시 활용)
- 병렬 처리: 파일 읽기/oxc 파싱은 동시 처리하되, 워커 수/배치 크기 제한으로 메모리 폭주 방지

---

## 4) tsgo / ast-grep / oxlint 통합 방식(정확성 우선)

### tsgo (추적: 심볼/레퍼런스/타입)

- `tsgo`는 **외부 바이너리**로 가정하고, Bun에서 `spawn`으로 실행한다.
- 원칙: MCP `traceSymbol`은 `tsgo` 결과를 SSOT로 사용한다.
- 실패 정책:
  - MCP: `tsgo` 실행 실패 시 오류를 structuredContent로 반환(서버 유지)
  - CLI: `--require-tsgo` 옵션 시 실패하면 exit 1, 아니면 fallback(Phase 5에서 결정)

### @ast-grep (룰팩 기반 구조 분석)

- `@ast-grep/napi`를 사용(프로세스 외부 호출 최소화, 대량 코드에서 성능 유리)
- 룰팩은 `rules/*.yaml`로 SSOT화하고, ruleset(그룹) 개념을 제공한다.
- detector는 “룰 id → findings”로 매핑되는 어댑터를 둔다.

### oxlint (진단 수집)

- `oxlint`는 현재 레포에서 lint 도구로 이미 사용 중.
- firebat 내부 detector로 편입 시:
  - CLI 실행 + JSON 출력 파싱(지원 포맷을 확인 후 결정)
  - 결과를 firebat report 스키마로 정규화
  - type-aware 용어는 oxlint 문맥에서만 사용한다(혼용 금지).

---

## 5) Phase Plan (매우 구체적)

### Phase 1 — 엔트리포인트 분리 + 서브커맨드 라우팅

목표

- `firebat` 바이너리가 `scan`(기본)과 `mcp` 서브커맨드를 지원한다.

작업

- `index.ts`를 “바이너리 라우터”로 전환: `firebat mcp`면 MCP 실행, 아니면 기존 scan 실행
- CLI 실행 코드는 `src/adapters/cli/*`로 이동
- 기존 `runFirebat()`는 유스케이스 호출로 축소

산출물(파일)

- `src/adapters/cli/entry.ts`
- `src/adapters/mcp/entry.ts`
- `src/application/scan/scan.usecase.ts`

완료 기준

- `firebat --help` 정상
- `firebat [targets...]` 기존과 동일 결과
- `firebat mcp`가 stdio 서버로 대기(로그는 stderr)

리스크

- stdio 프로토콜 혼선: stdout 로그 금지(모든 로그 stderr)

---

### Phase 2 — sqlite 캐시 도입(bun:sqlite)

목표

- 스캔 재실행이 빨라지고, MCP에서 반복 호출 시 성능이 안정화된다.

작업

- `src/ports/cache.repository.ts` 정의
- `src/infrastructure/sqlite/cache.repository.ts` 구현
- `.bunner/firebat/cache.sqlite` 생성/마이그레이션

스키마(최소)

- `meta(key TEXT PRIMARY KEY, value TEXT)`
- `files(projectKey TEXT, filePath TEXT, contentHash TEXT, updatedAt INTEGER, PRIMARY KEY(projectKey, filePath, contentHash))`
- `artifacts(projectKey TEXT, filePath TEXT, contentHash TEXT, kind TEXT, payload BLOB, PRIMARY KEY(...))`

완료 기준

- 동일 targets 2회 실행 시, cache hit 증가 + totalMs 감소

---

### Phase 3 — ast-grep 룰팩 + 구조 검색 Tool

목표

- `firebat.findPattern` MCP tool 제공
- 룰팩 기반 detector가 report에 합류

작업

- deps 추가: `@ast-grep/napi` (승인 게이트 대상)
- `rules/` 디렉토리 신설 + ruleset 인덱스(`rules/index.json` 또는 TS index)
- `src/infrastructure/ast-grep/*` 구현
- `src/application/scan/detectors/ast-grep.detector.ts` 추가

완료 기준

- 동일 ruleId로 반복 실행 시 성능이 유지(룰 로딩 캐시)
- 결과 스팬(filePath/line/column)이 firebat 스키마와 일치

---

### Phase 4 — tsgo 통합 + 코드 추적 Tool

목표

- `firebat.traceSymbol` MCP tool 제공
- 타입/심볼 기반 추적 그래프를 안정적으로 반환

작업

- `src/ports/type-info.provider.ts` 정의
- `src/infrastructure/tsgo/tsgo-runner.ts` 구현(바이너리 탐색/실행/결과 파싱)
- sqlite에 “project 단위” 결과 캐시
- 그래프 스키마 정의: `TraceNode`, `TraceEdge`, `EvidenceSpan`

완료 기준

- 동일 tsconfig 기준 1회 분석 후, 여러 trace 요청에 재사용(속도)

리스크

- tsgo 출력 포맷 불명확/변경 가능: 파서/스키마를 “버전 태그”와 함께 캐시

---

### Phase 5 — oxlint detector 편입(검토/보강)

목표

- `firebat.lint` MCP tool 제공 + report에 선택적으로 합류

작업

- `src/ports/lint.provider.ts` 정의
- `src/infrastructure/oxlint/oxlint-runner.ts` 구현
- 결과 정규화(진단 코드/심각도/스팬)

완료 기준

- oxlint 결과가 report에 합쳐져도 기존 detectors 결과와 충돌하지 않음

---

### Phase 6 — MCP 서버 마감(툴/리소스/프롬프트) + DX

목표

- MCP tool 표면을 고정하고, VS Code MCP 클라이언트에서 안정적으로 사용 가능

작업

- deps 추가: `@modelcontextprotocol/sdk` + `zod` (승인 게이트 대상)
- `src/adapters/mcp/server.ts`에서 tool/resource/prompt 등록
- `firebat://report/last`, `firebat://rules/index` 리소스 제공
- `firebat.review` prompt 제공

완료 기준

- `bunx -y firebat mcp`로 실행 가능(패키지 이름/배포는 아래 Phase 6.1에서 확정)

---

### Phase 7 — Inspector CLI 기반 MCP 스모크 테스트(자동화)

목표

- UI 클릭이 아니라 **CLI로 tools/resources/prompts 호출을 자동화**한다.
- CI에서 “서버가 뜬다/툴이 보인다/툴 호출이 된다/스키마가 유지된다”를 회귀 테스트한다.

도구 선택

- `@modelcontextprotocol/inspector`의 `--cli` 모드를 사용한다(Context7 근거).

테스트 타깃(최소)

- `tools/list`는 항상 성공해야 한다.
- `tools/call`로 아래 최소 2개 툴을 호출한다.
  - `firebat.scan` (fixtures 대상으로 1회)
  - `firebat.findPattern` 또는 `firebat.traceSymbol` (Phase 3/4 완료 여부에 따라 선택)
- `resources/list`, `prompts/list`도 최소 1회 확인한다.

테스트 실행 커맨드(예시, 표준화)

- tools/list
  - `bunx -y @modelcontextprotocol/inspector --cli bunx -y firebat mcp --method tools/list`
- tools/call
  - `bunx -y @modelcontextprotocol/inspector --cli bunx -y firebat mcp --method tools/call --tool-name firebat.scan --tool-arg 'targets=["<fixture>"]'`

주의

- MCP stdio는 stdout에 로그가 섞이면 통신이 깨질 수 있다. 서버 로그는 stderr로만 출력한다.
- 위 커맨드/arg 포맷은 Inspector CLI의 규약을 따른다(필요 시 `--tool-arg` JSON 인코딩 규칙을 고정).

산출물(파일)

- `test/mcp/fixtures/*` (최소 fixture 1개)
- `test/mcp/smoke.test.ts` 또는 `scripts/mcp-smoke.ts` (Bun test 또는 스크립트)
- package script(초안): `bun run test:mcp`

완료 기준

- 로컬에서 `bun run test:mcp`가 통과한다.
- CI에서 동일하게 통과한다(네트워크/환경 의존성 최소화).

---

## 6) 패키지/배포: `bunx -y firebat mcp`를 성립시키는 방법

현재 패키지명은 `@bunner/firebat`이다.
요구 커맨드가 `bunx -y firebat mcp`이므로, 아래 중 하나를 반드시 선택해야 한다.

Option A (권장, 리스크 낮음)

- 새 “래퍼” 패키지 `packages/firebat-npm/` (name: `firebat`)를 추가한다.
- 내용: `@bunner/firebat`에 의존하고, bin `firebat`를 그대로 노출한다.
- 장점: 기존 스코프 패키지 유지, 내부 구조 변경 최소

Option B (리스크 큼)

- `@bunner/firebat`의 패키지명을 `firebat`로 변경한다.
- 단점: 외부/내부 의존, 배포/다운스트림 영향 큼

본 계획은 Option A를 기본으로 진행한다.

---

## 7) 검증(Verify) / 테스트 전략

- 기존 fuzz/integration 테스트를 유지한다: [packages/firebat/test/integration](packages/firebat/test/integration)
- 새 유스케이스/프로바이더에는 최소 단위 테스트 추가
- MCP는 Inspector CLI 기반 스모크 테스트를 추가한다(Phase 7).
- 검증 커맨드는 레포 표준을 따른다: `bun run verify`

---

## 8) 승인 게이트(Decision Artifact) 체크포인트

아래는 `package.json` deps 변경 또는 새 패키지 추가를 포함하므로, 구현 전에 승인 토큰이 필요하다.

- `@modelcontextprotocol/sdk`, `zod` 추가
- `@ast-grep/napi` 추가
- tsgo 도입 방식(바이너리 설치/관리) 결정
- Option A 선택 시 래퍼 패키지 추가

