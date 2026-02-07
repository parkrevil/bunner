# MCP_PLAN — Bunner Knowledge Graph System

> **목적**: 프레임워크 제작(설계/구현/리팩터/검증)을 위한 **결정론적 지식 그래프(KG)** 를 구축한다.
> 에이전트가 프레임워크의 모든 설계·규칙·코드·테스트를 정확히 이해하고, 근거 기반으로 일관된 작업을 수행할 수 있게 한다.

---

## §0. Vision & Principles

### 0.1 핵심 원칙

| 원칙 | 설명 |
|------|------|
| **SSOT = File System** | Git 의존 완전 제거. 디스크 위의 파일이 유일한 진실. KB는 파생 facts store |
| **Mechanism-guaranteed** | 에이전트가 규칙을 지키든 안 지키든 KB 정합성이 자율적으로 유지됨 |
| **Content-addressed** | 변경 감지는 오직 `content_hash`(SHA-256). 파일 내용이 바뀌었는지만 본다 |
| **Plugin-based Extraction** | 파서는 인터페이스 기반 플러그인. 새 파일 유형 추가 시 코드 변경 없이 파서 등록 |
| **Config-driven** | Watch scope, exclude 규칙, 파서 활성화 등은 선언적 설정 파일로 관리 |
| **Workspace = DB Identity** | workspace_id는 쿼리 필터가 아니라 모든 자연키의 구성요소. DB 유니크 제약으로 격리를 강제 |
| **Bun-first** | `Bun.CryptoHasher`, `Bun.file()`, `Glob.scan()`, `fs.watch` (Bun 런타임) 사용 |

### 0.2 목표

1. 스펙/규칙/코드/테스트를 하나의 **지식 그래프**로 연결해, 질문 → 근거 → 변경 작업으로 이어지게 한다
2. **에이전트 행동에 의존하지 않고** KB ↔ 파일 시스템 정합성을 자율 보장한다
3. 단순 검색을 넘어 **영향 분석, 의존 그래프, 커버리지 갭 분석** 등 고수준 분석을 제공한다
4. 검색은 하이브리드(lexical+vector) 기반으로 품질을 확보하고, 필터/근거 설명을 제공한다
5. 관측성(metrics, structured logging), 정합성 검증(structural+semantic), 변경 감사(audit trail)를 제품 기능으로 포함한다

### 0.3 비목표

- 원문 전체(코드/문서 blob)의 영구 복제 저장. 단, **추출된 구조화 facts**는 DB에 저장한다
- Git 의존. rev/commit 기반 변경 감지를 사용하지 않는다
- 실시간(수백ms 이내) 반영. eventual consistency at query time이 목표다

### 0.4 왜 Git-free인가

- Git은 항상 변한다 (branch switch, rebase, force push, worktree)
- 브랜치 전환 시 단일 RAG DB와 Git 상태 간 충돌이 불가피
- 멀티유저/멀티워크트리 환경에서 Git 기반 SSOT는 정합성을 보장할 수 없다
- **대안**: `content_hash`(SHA-256) 기반 변경 감지. 파일 내용이 바뀌었는지만 판단. Git 상태와 무관

### 0.5 "결정론적"의 정의

**동일한 파일 시스템 스냅샷에 대해 항상 동일한 KB 상태가 산출된다** (idempotent extraction).
시간 축 이력 재현(과거 KB 상태 복원)은 범위 밖이다.
단, **변경 감사**(§2.6 sync_event)를 통해 "언제 무엇이 변경되었는지"는 추적한다.

---

## §1. Conceptual Model

KB를 구성하는 4가지 핵심 개념과 3가지 보조 개념을 정의한다.
이후 모든 섹션은 이 용어를 기준으로 서술한다.

### 1.1 Entity — "무엇이 존재하는가"

프레임워크 내 의미 있는 개념 단위. 유일한 Stable ID를 가진다.

| 타입 | 예시 | entity_key 패턴 |
|------|------|----------------|
| spec | pipeline-shape spec | `spec:pipeline-shape` |
| rule | shape rule | `rule:pipeline-shape/R1` |
| diagnostic | diagnostic code | `diag:BNR0101` |
| package | npm package | `pkg:@bunner/core` |
| module | TS module | `module:packages/core/src/di/container.ts` |
| symbol | public API symbol | `symbol:packages/core/src/di/container.ts#Container` |
| test | test case | `test:packages/core/test/di.test.ts#creates-container` |
| decision | 설계 결정 | `decision:git-free-sync` |
| invariant | 불변 규칙 | `invariant:INV-001` |

**생명주기**: `active` → `tombstoned` → `restored` | `purged`

### 1.2 Source — "어디서 왔는가"

Entity의 원천 위치. 파일 시스템의 구체적 위치 + content_hash.
하나의 entity가 여러 source를 가질 수 있다 (예: 한 모듈이 index.ts + types.ts에 걸침).

- **Natural key**: `(workspace_id, kind, file_path, span_start, span_end)`
- `content_hash`는 key가 아닌 **속성(attribute)**. 파일 변경 시 UPDATE-in-place
- `kind`: `spec` | `code` | `test` | `config` | `doc`

### 1.3 Fact — "무엇을 말하는가"

Entity에서 추출된 구체적 정보 조각. 독립적으로 검색·인용 가능.

| fact_type | 예시 |
|-----------|------|
| summary | entity 1줄 요약 |
| signature | public API 시그니처 |
| rule_definition | shape rule 정의 |
| diagnostic_mapping | rule ↔ diagnostic 매핑 |
| dependency | import/export 의존 |
| test_assertion | 테스트가 검증하는 것 |
| behavior | 동작 설명 |

- `fact_key`: entity 내 하위 안정 ID (예: `"export:Container"`)
- `payload_text`: 검색 가능한 텍스트
- `payload_json`: 구조화된 데이터 (JSONB)
- `content_hash`: payload의 해시 (중복 업데이트 방지)

### 1.4 Relation — "어떻게 연결되는가"

Entity 간의 typed 연결. **반드시 evidence(fact)를 가진다.**

| relation_type | 의미 | 예시 |
|---------------|------|------|
| depends_on | A가 B에 의존 | spec → spec, module → module |
| implements | A가 B를 구현 | code → spec |
| tests | A가 B를 테스트 | test → code, test → rule |
| triggers | A가 B를 트리거 | rule → diagnostic |
| relates_to | 일반 관련 | entity ↔ entity |
| derives_from | A가 B에서 파생 | derived → source entity |
| renamed_to | A가 B로 개명됨 | old_entity → new_entity |

**강도(strength)**: `contract` > `implementation` > `convention` > `reference`

- evidence 없는 relation 생성은 거부하거나 `strength = reference`로 격하
- `verify_integrity`에서 evidence 없는 relation을 dangling으로 검출

### 1.5 Workspace — 격리 단위

- ID: `sha256(hostname + repo_root_path)`의 앞 16자
- 자동 계산: `os.hostname()` + `process.cwd()` → 환경변수 불필요
- **격리는 DB 정체성으로 강제**: workspace_id는 entity, source의 자연키(UNIQUE 제약)의 구성요소이다. 애플리케이션 레벨 필터가 누락되어도 다른 workspace의 데이터와 키 충돌이 발생하지 않는다
- 모든 쿼리에 `WHERE workspace_id = ?` 자동 적용 (편의 + 성능)
- 동일 DB에 여러 workspace 공존 가능 (멀티유저/멀티워크트리)

### 1.6 Stable ID — 시간·경로 불변 식별자

파일 경로가 바뀌어도 entity key는 동일하게 유지된다.

| 범주 | ID 소스 |
|------|---------|
| 문서/규칙 | `SpecID`, `RuleID`, `DiagnosticCode` (문서 내 명시) |
| 코드 | `PackageID`(package name), `ModuleID`(repo path), `SymbolID`(stable signature) |
| 테스트 | `TestID`(file path + test name) |
| 의사결정 | `DecisionID`, `InvariantID` |
#### Stable ID 산출 불변조건

1. **결정론적**: 동일 파일 내용 → 동일 `entity_key` / `fact_key`. 추출 순서, 실행 시점, 파서 호출 횟수에 무관
2. **내용 파생**: ID는 파일 내용에서 파생된다 (예: package.json의 `name` 필드, spec 문서의 `id` 헤더, test의 `describe`/`it` 문자열). 외부 상태(시각, 카운터, 랜덤)에 의존하지 않음
3. **경로 독립** (entity_key): 파일 경로가 바뀌어도 entity_key는 동일 유지 (§2.4 Rename 참조). 단, `ModuleID`/`TestID`처럼 경로가 ID의 본질적 일부인 경우는 예외
4. **파서 버전 안정**: 파서 내부 구현이 변경되어도, 동일 파일에서 동일 `entity_key`/`fact_key`가 산출되어야 한다. 키 산출 로직 변경 시 migration으로 처리
5. **fact_key 형식**: entity 내에서 fact를 고유하게 식별하는 하위 키. 형식: `{fact_type}:{discriminator}`. 예: `dependency:@bunner/common`, `export:Container`, `test-case:creates-container`

### 1.7 Content Hash — 변경의 유일한 기준

- `SHA-256` hex digest of file content
- `Bun.CryptoHasher("sha256")` 사용
- 파일 내용 동일 → hash 동일 → no-op. Git 상태와 무관
- Streaming hash 지원: 큰 파일도 메모리 전체 로드 없이 처리

---

## §2. Data Architecture

### 2.1 스키마 개요

```
workspace ──< entity ──< source
                │──< fact
                │
            relation ──< relation_evidence ──> fact
                │
            sync_run ──< sync_event ──> entity
```

### 2.2 테이블 정의

#### workspace

| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | TEXT PK | sha256(hostname+repo_root)[:16] |
| hostname | TEXT NOT NULL | |
| repo_root | TEXT NOT NULL | |
| created_at | TIMESTAMPTZ | DEFAULT now() |

#### entity

| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | SERIAL PK | |
| workspace_id | TEXT FK → workspace | NOT NULL |
| entity_key | TEXT NOT NULL | stable ID |
| entity_type_id | INT FK → entity_type | NOT NULL |
| summary | TEXT | human-readable 1줄 |
| meta | JSONB | 유연한 메타데이터 |
| is_deleted | BOOLEAN | DEFAULT false (tombstone) |
| last_seen_run | INT FK → sync_run | 마지막 확인 run |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**UNIQUE(workspace_id, entity_key)**

#### source

| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | SERIAL PK | |
| workspace_id | TEXT FK → workspace | NOT NULL |
| entity_id | INT FK → entity | NOT NULL |
| kind | TEXT NOT NULL | spec/code/test/config/doc |
| file_path | TEXT NOT NULL | repo-relative path |
| span_start | INT | |
| span_end | INT | |
| content_hash | TEXT NOT NULL | SHA-256 (attribute, UPDATE-in-place) |

**UNIQUE(workspace_id, kind, file_path, span_start, span_end)**

#### fact

| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | SERIAL PK | |
| entity_id | INT FK → entity | NOT NULL |
| fact_type_id | INT FK → fact_type | NOT NULL |
| fact_key | TEXT NOT NULL | entity 내 하위 ID |
| payload_text | TEXT | 검색 대상 |
| payload_json | JSONB | 구조화 데이터 |
| payload_tsv | TSVECTOR | FTS 인덱스 |
| content_hash | TEXT | payload 해시 (dedup) |

**UNIQUE(entity_id, fact_type_id, fact_key)**

#### relation

| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | SERIAL PK | |
| src_entity_id | INT FK → entity | NOT NULL |
| dst_entity_id | INT FK → entity | NOT NULL |
| relation_type_id | INT FK → relation_type | NOT NULL |
| strength_type_id | INT FK → strength_type | NOT NULL |
| meta | JSONB | |

**UNIQUE(src_entity_id, dst_entity_id, relation_type_id, strength_type_id)**

#### relation_evidence

| 컬럼 | 타입 | 비고 |
|------|------|------|
| relation_id | INT FK → relation | |
| fact_id | INT FK → fact | |

**PK(relation_id, fact_id)**

#### sync_run

| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | SERIAL PK | |
| workspace_id | TEXT FK → workspace | NOT NULL |
| trigger | TEXT NOT NULL | startup/watch/manual/read_through |
| status | TEXT NOT NULL | running/completed/failed |
| started_at | TIMESTAMPTZ | |
| finished_at | TIMESTAMPTZ | |
| stats | JSONB | { files_scanned, entities_created, ... } |
| errors | JSONB | [{ path, error }] |

#### sync_event (Audit Trail)

| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | SERIAL PK | |
| run_id | INT FK → sync_run | NOT NULL |
| entity_id | INT FK → entity | NOT NULL |
| action | TEXT NOT NULL | created/updated/deleted/restored |
| prev_content_hash | TEXT | 변경 전 |
| new_content_hash | TEXT | 변경 후 |
| created_at | TIMESTAMPTZ | DEFAULT now() |

#### Type 테이블 (Seed Data)

| 테이블 | 컬럼 | 비고 |
|--------|------|------|
| entity_type | id, name | spec, rule, diagnostic, package, module, symbol, test, decision, invariant, derived |
| fact_type | id, name | summary, signature, rule_definition, diagnostic_mapping, dependency, test_assertion, behavior |
| relation_type | id, name | depends_on, implements, tests, triggers, relates_to, derives_from, renamed_to |
| strength_type | id, name, rank | contract(4), implementation(3), convention(2), reference(1) |

### 2.3 인덱스 전략

| 인덱스 | 대상 |
|--------|------|
| FTS GIN | fact.payload_tsv |
| Filter | entity.entity_type_id, entity.workspace_id, entity.is_deleted |
| FK | source.entity_id, fact.entity_id, relation.src_entity_id, relation.dst_entity_id |
| Hash lookup | source.content_hash, fact.content_hash |
| Composite | source(workspace_id, file_path) — file 단위 조회용 |

### 2.4 Rename/Move 추적

**Git-free 환경의 트레이드오프**: 파일 rename을 자동 감지하는 것은 불가능하다.

- **파일 rename**: delete + new로 처리 (경로가 다르면 별개 파일)
- **entity 레벨**: Stable ID(§1.6) 기반이므로, 파일 경로가 바뀌어도 entity key는 동일. 데이터 유실 없음
- **entity key 자체가 변경되는 경우** (spec ID 변경 등):
  - `relation_type = 'renamed_to'` edge로 old → new 연결
  - `entity.meta.aliases`에 old keys 기록

### 2.5 Derived Entity

- derived entity는 `entity_type = 'derived'` (또는 구체 타입)
- 원천과 `relation(derives_from)`으로 연결
- **source 규칙**: derived entity의 source는 원천 파일의 source를 공유. content_hash는 원천 파일의 해시 사용

### 2.6 Audit Trail (sync_event)

"이력 재현"이 아닌 **변경 감사**.

- 모든 sync 작업(startup/watch/manual/read_through)에서 entity가 생성/수정/삭제/복원될 때 sync_event 기록
- `recent_changes`, `changelog` 도구의 데이터 기반
- 변경 빈도 분석 가능 (자주 바뀌는 = 불안정한 코드/spec)
- **보관 정책**: 설정 가능 (기본 30일). 오래된 sync_event는 자동 purge

### 2.7 Workspace 격리

- 모든 entity, source는 workspace_id로 격리
- fact, relation은 entity FK를 통해 암묵적 격리
- **고아 데이터**: 디렉토리 이동 등으로 workspace_id가 달라지면 이전 데이터는 고아. `kb_health()`에서 workspace별 entity 수 노출. `purge_tombstones(workspaceId)` 로 정리

### 2.8 데이터 수명 모델 (Data Lifecycle)

각 객체의 생성→갱신→삭제→purge 수명 규칙을 정의한다.

| 객체 | 생성 | 갱신 | 삭제 | Purge |
|------|------|------|------|-------|
| **entity** | 파서가 새 entity_key 산출 시 | summary/meta 변경 시 `updated_at` 갱신 | 원천 파일 삭제 또는 파서가 해당 key를 더 이상 산출하지 않으면 `is_deleted=true` (tombstone) | `purge_tombstones(olderThan)` 호출 시 행 삭제. 연결된 source/fact/relation cascade 삭제 |
| **source** | entity 생성 시, 또는 새 파일에서 기존 entity 발견 시 | 파일 내용 변경 시 `content_hash` UPDATE-in-place. **행은 유지** | entity tombstone 시 함께 논리 삭제 (entity FK 경유) | entity purge 시 cascade 삭제 |
| **fact** | 파서가 추출 시 생성 | payload 변경 시 `content_hash` 비교 → 다르면 UPDATE, 동일하면 no-op | 파서가 해당 `fact_key`를 더 이상 산출하지 않으면 orphan → 해당 sync에서 삭제 | entity purge 시 cascade 삭제 |
| **relation** | 파서가 relation 추출 + evidence fact과 함께 생성 | 불변 (동일 자연키면 no-op) | src 또는 dst entity tombstone 시 ghost → `verify_integrity` semantic에서 검출 | entity purge 시 cascade 삭제 |
| **sync_event** | sync worker가 entity 변경(created/updated/deleted/restored) 시 기록 | 불변 (append-only, 수정 불가) | `audit.retentionDays` 경과 시 자동 purge | 날짜 기반 batch 삭제 |
| **sync_run** | sync 시작 시 생성 | 완료/실패 시 `status`/`finished_at` 갱신 | 보관 정책에 따라 purge | sync_event와 동일 주기 |

#### 수명 불변조건

1. **source row 불멸**: entity가 active인 한 source row는 삭제되지 않는다. `content_hash`만 UPDATE
2. **fact dedup**: 동일 `fact_key`가 재추출되면 `content_hash` 비교 → 변경 시 UPDATE, 동일하면 no-op. 새 row를 생성하지 않음
3. **cascade purge**: entity가 purge되면 source/fact/relation/relation_evidence 모두 cascade 삭제
4. **sync_event append-only**: sync_event는 생성 후 수정/삭제 불가 (retention purge 제외). 감사 추적의 무결성 보장
5. **orphan fact 정리**: sync 시 파서가 기존 entity에 대해 산출하지 않은 fact_key는 해당 sync에서 삭제. 다음 sync까지 잔류하지 않음

---

## §3. Synchronization Architecture

> **설계 철학**: "에이전트가 규칙을 지켜야만 동작하는 시스템은 반드시 깨진다."
> KB 정합성은 에이전트의 행동이 아닌 **MCP 서버의 자율 메커니즘**으로 보장한다.

### 3.1 전체 구조

```
┌──────────────────────────────────────────────────────────────┐
│                       MCP Server                             │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ Layer 1  │  │ Layer 2  │  │ Layer 3  │                   │
│  │ Startup  │  │ Watch    │  │ Read-    │                   │
│  │ Scan     │  │ Events   │  │ through  │                   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                   │
│       │              │             │                         │
│       ▼              ▼             ▼                         │
│  ┌──────────────────────────────────────────────────────┐    │
│  │            Sync Queue (in-memory, priority)          │    │
│  │      priority: read_through > watch > startup        │    │
│  └──────────────────────┬───────────────────────────────┘    │
│                         │                                    │
│                         ▼                                    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              Background Sync Worker                  │    │
│  │  1. content_hash check (in-memory cache → disk)      │    │
│  │  2. Parser registry → extract                        │    │
│  │  3. Diff (extracted vs DB)                           │    │
│  │  4. Commit (single TX + sync_event audit)            │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

**핵심**: 모든 sync 작업은 Background Sync Worker를 통과한다.
쿼리는 절대 re-extract에 블로킹되지 않는다.

### 3.2 Layer 1: Startup — Background Full Scan

1. 서버 **즉시 시작** (쿼리 수용 가능)
2. Background에서 full scan 시작:
   - `workspace_id` 자동 계산
   - 설정된 include 디렉토리 재귀 탐색
   - 모든 대상 파일의 `content_hash` 계산 (`Bun.CryptoHasher`)
   - DB의 기존 source `content_hash`와 비교
3. **변경된 파일**: sync queue에 enqueue
4. **DB에만 존재** (파일 삭제됨): tombstone (`is_deleted = true`)
5. **새 파일**: sync queue에 enqueue
6. **파일 복원** (tombstoned entity가 있는데 동일 key 파일이 다시 존재): `is_deleted = false` + re-extract
7. Scan 완료 전 쿼리는 가능하지만 stale일 수 있음 → `kb_health()`에서 scan 진행 상태 노출

### 3.3 Layer 2: Watch — fs.watch + Debounce

1. 설정된 include 디렉토리에 `fs.watch({ recursive: true })` 등록
2. 이벤트 → 설정된 debounce 시간(기본 500ms) 후 sync queue에 enqueue
3. **OS 호환성**: `fs.watch`의 `recursive` 옵션은 OS별 동작 신뢰도가 다를 수 있다 (macOS/Windows: 네이티브, Linux: inotify 폴백). Layer 2 단독으로 정합성을 보장하지 않으며, Layer 1과 Layer 3이 보완
4. **watch 실패 시**: 에러를 throw하지 않고 `kb_health()`에 `watch_healthy: false` 노출. 서버는 계속 동작

### 3.4 Layer 3: Read-through — Lightweight Validation

읽기 도구 호출 시, 반환 직전에 **hash 비교만** 수행 (re-extract는 하지 않음).

| Tool | 검증 대상 |
|------|----------|
| `search` | 반환 결과 전체의 source |
| `describe` | 해당 entity의 모든 source |
| `relations` | 반환되는 각 관련 entity의 source |
| `facts` | 해당 entity의 source (entity 단위 1회) |

**검증 결과 처리**:
- **content_hash 일치**: 그대로 반환
- **content_hash 불일치**: `stale: true` 플래그 부착 + sync queue에 enqueue(priority=high) + 현재 결과 즉시 반환
- **파일 삭제됨**: 결과에서 제외 + tombstone + sync queue에 enqueue
- **파일 읽기 실패** (권한 등): 현재 결과 반환 + `stale: true`

**In-Memory Hash Cache**: `file_path → { content_hash, mtime }` 캐시. watch event 시 해당 파일만 evict. Read-through 시 disk I/O 없이 캐시에서 비교 (cache miss 시에만 disk 접근).

### 3.5 Background Sync Worker

- In-memory priority queue에서 작업을 소비
- 파일별 처리: hash check → parser registry → extract → diff → commit (single TX)
- 각 변경마다 `sync_event` 기록 (audit trail)
- **동시성**: 단일 worker (순차 처리). 동시 sync 충돌 방지
- **에러 격리**: 개별 파일 실패는 해당 파일만 skip. sync_run.errors에 기록. 서버는 계속 동작

### 3.6 보장 / 비보장

| 보장 | 비보장 |
|------|--------|
| **쿼리 시점 freshness 표시**: stale 데이터는 stale 플래그와 함께 반환 | 실시간 반영 — debounce + worker 처리 시간만큼 지연 |
| 서버 재시작 시 자동 복구 (Layer 1) | 서버 꺼진 동안의 중간 이력 — 최종 상태만 반영 |
| 삭제된 파일은 tombstone + 기본 검색에서 숨김 | 조회되지 않은 stale 데이터는 watch 또는 다음 scan까지 잔류 |
| workspace 간 데이터 격리 | |
| 쿼리가 re-extract에 블로킹되지 않음 | |

### 3.7 에러 모델

| 실패 유형 | 동작 |
|----------|------|
| **파서 실패** (깨진 파일, 예상 외 구조) | 해당 파일 skip + sync_run.errors에 기록. 기존 entity 유지 (삭제 안 함) |
| **파일 읽기 실패** (권한, 인코딩) | 동일. skip + 기록 + 기존 유지 |
| **DB 에러** (연결 끊김, 제약 위반) | 해당 TX 전체 롤백. 재시도 없음. kb_health()에 에러 노출 |
| **Worker 실패** | 해당 파일만 skip. worker는 계속 동작. 다음 trigger에서 재시도 |

**원칙**: 개별 파일 실패가 전체 sync를 중단시키지 않는다. DB 에러(인프라 장애)만 즉시 중단.

---

## §4. Parser Architecture

### 4.1 Parser Interface

```ts
interface Parser {
  /** 파서 이름 (설정에서 활성화/비활성화에 사용) */
  name: string

  /** 이 파서가 해당 파일을 처리할 수 있는지 */
  canHandle(filePath: string, content: string): boolean

  /** 파일에서 entity, fact, relation, source를 추출 */
  extract(filePath: string, content: string, ctx: ExtractContext): ExtractionResult

  /** 높을수록 먼저 평가 */
  priority: number
}

interface ExtractContext {
  workspaceId: string
  filePath: string
  contentHash: string
  existingEntities: Map<string, EntityRef>  // relation linking에 사용
}

interface ExtractionResult {
  entities: EntityDraft[]
  facts: FactDraft[]
  relations: RelationDraft[]
  sources: SourceDraft[]
}
```

### 4.2 Parser Registry

- 서버 시작 시 모든 내장 파서를 registry에 등록
- 설정(§7)에서 파서별 `enabled` 플래그로 활성화/비활성화
- 파일 처리 시: 등록된 파서를 priority 순으로 순회 → `canHandle() === true`인 모든 파서의 `extract()` 실행 → 결과 merge

### 4.2a 파서 확장 로드맵 (추후)

- config의 `parsers` 섹션에서 외부 모듈 경로를 지정하여 3rd-party 파서를 `dynamic import`로 로드
- `Parser` interface를 만족하면 내장 파서와 동일하게 registry에 등록·실행
- 예: `"custom-parser": { "enabled": true, "module": "./parsers/custom.ts" }`

### 4.3 내장 파서

| 파서 | priority | 대상 | 추출 |
|------|----------|------|------|
| **PackageJsonParser** | 100 | `**/package.json` | pkg entity + dependency relations |
| **TypeScriptModuleParser** | 90 | `**/*.ts`, `**/*.tsx` | module/symbol entities + export/import relations |
| **TestFileParser** | 80 | `**/*.test.ts`, `**/*.spec.ts` | test entities + tests relations |
| **SpecMarkdownParser** | 70 | `**/*.spec.md` | spec/rule/diagnostic entities + cross-refs |
| **GenericMarkdownParser** | 10 | `**/*.md` | document entities (fallback) |

### 4.4 파서 체인

한 파일에 여러 파서가 `canHandle=true` → 모두 실행 → 결과 merge → single TX commit.
예: `pipeline.test.ts`에 TestFileParser + TypeScriptModuleParser 모두 적용 가능.

### 4.5 Extract 범주

> 각 범주에 **현재** / **추후** 를 명시.

#### 4.5a Code index (packages/\*, examples/\*) — 현재
- package.json (name, exports, description)
- 모듈 경로/exports map → module entity
- TS symbol index: public API, 핵심 타입, 핵심 함수

#### 4.5b Tests — 현재
- test 파일/케이스 목록 + 무엇을 검증하는지 (가능하면 AST 기반 rule/diag 링크)

#### 4.5c Specs/Rules/Diagnostics (docs/30_SPEC) — 추후
- Spec identity (title/id/version/status/owner/depends-on/supersedes)
- Rule table (Shape Rules)
- Diagnostics mapping (rule ↔ diagnostic)
- Links: spec→spec (depends_on), spec→rule (relates_to), rule→diag (triggers)
- **Type 매핑**: entity_type: `spec`, `rule`, `diagnostic` (기존) / fact_type: `rule_definition`, `diagnostic_mapping`, `behavior` (기존) / relation_type: `depends_on`, `triggers` (기존)

#### 4.5d Engineering/Structure/Policy (docs/\*) — 추후
- 구조 규칙, SSOT hierarchy, invariants
- 테스트 규율/검증 기준, 금지/권장 패턴
- KB 기본 구축 완료 후 docs DB화 시 별도 계획으로 추가
- **Type 매핑**: entity_type: `invariant`, `decision` (기존) / fact_type: `convention`, `constraint` (신규, 파서 도입 migration에서 추가) / relation_type: `relates_to` (기존)

#### 4.5e Pipeline/Execution — 추후
- build step, manifest generator, adapter/provider wiring 등 실행 흐름을 entity/relation으로 표현
- **Type 매핑**: entity_type: `module`, `symbol` (기존 재사용) / fact_type: `behavior`, `dependency` (기존) / relation_type: `triggers`, `depends_on` (기존)

---

## §5. Search & Analysis

### 5.1 검색 전략

| 계층 | 엔진 | 상태 |
|------|------|------|
| **Lexical** | PostgreSQL FTS (tsvector + ts_rank_cd) | 현재 |
| **Vector** | pgvector embedding + cosine distance | 추후 |
| **Hybrid** | lexical 후보 + vector rerank | 추후 |
| **Graph** | Relation 기반 BFS/DFS traversal | 현재 |

### 5.2 랭킹 피처

- entity_type / fact_type 우선순위 (질문 의도 기반)
- evidence 수 (근거가 많은 relation/fact 우선)
- 최신성 (sync_run)
- 강도 (strength_type: contract > implementation > convention > reference)

### 5.3 필터

- `entityType`, `factType`, `packageName`, `includeDeleted`, `workspaceId`

### 5.4 임베딩 전략 (Vector Search 전제 조건)

- **대상**: `fact.payload_text`가 의미론적 검색에 유의미한 fact (summary, behavior, diagnostic)
- **모델 선택**: 추후 결정
- **점진적 도입**: lexical search 안정화 후 임베딩을 점진적으로 추가

### 5.5 분석 도구

#### Graph Navigation
| 도구 | 입력 | 출력 |
|------|------|------|
| `impact_analysis(entityKey, depth?)` | entity key, depth (기본 3) | 변경 시 영향받는 entity 목록 (reverse dependency walk) |
| `dependency_graph(entityKey, direction?, depth?)` | entity key, upstream/downstream/both | 의존 그래프 서브트리 |
| `trace_chain(fromKey, toKey)` | 시작/끝 entity key | 최단 관계 경로 (BFS) |

#### Coverage & Quality
| 도구 | 설명 |
|------|------|
| `coverage_map(specKey)` | spec → implements → code → tests → test entities 체인 매핑 |
| `inconsistency_report(scope?)` | spec without implementation, code without tests, orphan entities |
| `find_orphans(entityType?)` | 어떤 relation도 없는 고립 entity |

#### Temporal
| 도구 | 설명 |
|------|------|
| `recent_changes(since?, limit?)` | sync_event 기반 최근 변경 entity 목록 |
| `changelog(entityKey, limit?)` | 특정 entity의 변경 이력 (sync_event) |

---

## §6. MCP Interface

### 6.1 Query (읽기)

| Tool | 파라미터 | 설명 |
|------|----------|------|
| `search` | query, limit?, filters?, mode? | 하이브리드 검색. stale 표시 포함 |
| `describe` | entityKey | entity + sources + facts 요약 |
| `relations` | entityKey, direction?, relationType?, depth?, limit? | 관계 탐색 (multi-hop 지원) |
| `facts` | entityKey, factType?, limit? | entity의 fact 목록 |
| `evidence` | relationId | relation의 evidence fact 목록 |

### 6.2 Analysis (분석)

| Tool | 파라미터 | 설명 |
|------|----------|------|
| `impact_analysis` | entityKey, depth? | 변경 영향 범위 |
| `dependency_graph` | entityKey, direction?, depth? | 의존 그래프 |
| `trace_chain` | fromKey, toKey | 최단 관계 경로 |
| `coverage_map` | specKey | spec → code → test 커버리지 |
| `inconsistency_report` | scope? | 불일치/누락 검출 |
| `find_orphans` | entityType? | 고립 entity |

### 6.3 Temporal (시간)

| Tool | 파라미터 | 설명 |
|------|----------|------|
| `recent_changes` | since?, limit? | 최근 변경 entity |
| `changelog` | entityKey, limit? | entity 변경 이력 |

### 6.4 Operations (운영)

| Tool | 파라미터 | 설명 |
|------|----------|------|
| `kb_health` | — | 시스템 전체 상태 (DB, watch, queue, metrics) |
| `verify_integrity` | level? (structural/semantic/full) | 정합성 검증 |
| `sync` | scope?, dryRun? | 수동 sync 트리거 (optional helper) |
| `purge_tombstones` | olderThan?, workspaceId? | tombstone 정리 |

### 6.5 Bulk (효율)

| Tool | 파라미터 | 설명 |
|------|----------|------|
| `bulk_describe` | entityKeys[] | 다수 entity 일괄 describe |
| `bulk_facts` | entityKeys[], factType? | 다수 entity 일괄 fact 조회 |

### 6.6 Autonomous (에이전트 호출 불필요)

- **Startup**: Background full scan (§3.2)
- **Watch**: fs.watch auto-sync (§3.3)
- **Read-through**: Lightweight validation (§3.4)
- **Worker**: Background sync (§3.5)

### 6.7 응답 스키마 (Response Schema)

에이전트가 문서/시각화 제작 시 데이터 구조를 정확히 알 수 있도록 핵심 도구의 응답 구조를 정의한다.

```ts
/** search 응답 */
interface SearchResult {
  matches: {
    entity: { key: string; type: string; summary: string }
    facts: { factKey: string; factType: string; payloadText: string }[]
    score: number
    stale: boolean
  }[]
  totalMatches: number
}

/** describe 응답 */
interface DescribeResult {
  entity: {
    key: string; type: string; summary: string
    meta: Record<string, unknown>; isDeleted: boolean
  }
  sources: { filePath: string; kind: string; contentHash: string; stale: boolean }[]
  facts: {
    factKey: string; factType: string
    payloadText: string; payloadJson: Record<string, unknown> | null
  }[]
  relationSummary: { incoming: number; outgoing: number }
}

/** dependency_graph 응답 */
interface DependencyGraphResult {
  nodes: { entityKey: string; entityType: string; summary: string }[]
  edges: { src: string; dst: string; relationType: string; strength: string }[]
}

/** coverage_map 응답 */
interface CoverageMapResult {
  spec: { key: string; summary: string }
  implementations: { entityKey: string; relationType: string; strength: string }[]
  tests: { entityKey: string; relationType: string; targetKey: string }[]
  gaps: { type: "no_implementation" | "no_test"; entityKey: string; summary: string }[]
}

/** impact_analysis 응답 */
interface ImpactAnalysisResult {
  root: { key: string; type: string; summary: string }
  affected: {
    entityKey: string; entityType: string
    distance: number; path: string[]
  }[]
  totalAffected: number
}

/** kb_health 응답 — §8.3 참조 */
```

---

## §7. Configuration

### 7.1 설정 파일

`bunner.kb.jsonc` (프로젝트 루트). 없으면 기본값으로 동작.

```jsonc
{
  // Watch 대상 디렉토리
  "watch": {
    "include": ["examples/", "packages/"],
    "debounceMs": 500
  },

  // Scan 제외 규칙
  "scan": {
    "exclude": {
      "dirs": ["node_modules", "dist", ".git", "coverage", ".turbo"],
      "files": ["bun.lockb", "package-lock.json", "yarn.lock", ".DS_Store"],
      "extensions": [".png", ".jpg", ".woff", ".wasm", ".sqlite"],
      "patterns": [".env*"]
    },
    "maxFileSizeBytes": 1048576
  },

  // 파서 활성화
  "parsers": {
    "package-json": { "enabled": true },
    "typescript-module": { "enabled": true },
    "test-file": { "enabled": true },
    "spec-markdown": { "enabled": false },
    "generic-markdown": { "enabled": false }
  },

  // 동기화
  "sync": {
    "fullScanOnStartup": true,
    "readThroughValidation": true,
    "workerConcurrency": 1
  },

  // 검색 기본값
  "search": {
    "defaultLimit": 10,
    "defaultMode": "lexical"
  },

  // 감사 이력
  "audit": {
    "retentionDays": 30
  }
}
```

### 7.2 설정 우선순위

1. 설정 파일 (`bunner.kb.jsonc`) — 있으면 사용
2. 기본값 (코드 내 `DEFAULT_CONFIG` 상수) — 설정 파일 없을 때

환경변수는 사용하지 않는다.

### 7.3 설정 스키마 타입

```ts
interface KBConfig {
  watch: {
    include: string[]
    debounceMs: number
  }
  scan: {
    exclude: {
      dirs: string[]
      files: string[]
      extensions: string[]
      patterns: string[]
    }
    maxFileSizeBytes: number
  }
  parsers: Record<string, { enabled: boolean }>
  sync: {
    fullScanOnStartup: boolean
    readThroughValidation: boolean
    workerConcurrency: number
  }
  search: {
    defaultLimit: number
    defaultMode: 'lexical' | 'vector' | 'hybrid'
  }
  audit: {
    retentionDays: number
  }
}
```

---

## §8. Operations

### 8.1 성능 아키텍처

| 영역 | 전략 |
|------|------|
| **Startup** | 서버 즉시 시작 → full scan은 background. scan 중 쿼리 가능 (stale 허용) |
| **In-Memory Cache** | file_path → {content_hash, mtime} 캐시. read-through 시 disk I/O 제거. watch event 시 해당 file만 evict |
| **Streaming Hash** | `Bun.file(path).stream()` + `CryptoHasher` — 큰 파일도 메모리 전체 로드 없이 |
| **Connection Pool** | Drizzle + postgres driver pool. 읽기/쓰기 분리 준비 |
| **Batch Commit** | sync worker가 여러 파일 결과를 single TX로 commit |
| **Type Cache** | entity_type, fact_type, relation_type, strength_type — 프로세스 내 메모리 캐시 |

### 8.2 SLO

| 연산 | 목표 | 조건 |
|------|------|------|
| search (lexical, 10건) | ≤ 200ms | entity 10,000개 기준 |
| describe / relations | ≤ 100ms | |
| read-through validation | ≤ 10ms 추가 | hash cache hit 기준 |
| impact_analysis (depth=3) | ≤ 500ms | |
| startup (서버 시작) | 즉시 | full scan은 background |

초기에는 정확성 > 성능.

### 8.3 관측성

**kb_health() 응답**:
```jsonc
{
  "db": { "healthy": true, "latencyMs": 2 },
  "watch": { "healthy": true, "dirs": ["examples/", "packages/"] },
  "sync": {
    "queueDepth": 0,
    "workerStatus": "idle",
    "lastSyncAt": "2026-02-08T12:00:00Z",
    "lastSyncDurationMs": 1200,
    "startupScanComplete": true
  },
  "counts": {
    "entities": 342,
    "facts": 1580,
    "relations": 890,
    "tombstoned": 5,
    "workspaces": 1
  },
  "cache": {
    "hashCacheSize": 280,
    "hitRate": 0.94
  }
}
```

**Structured Logging**: sync events, query events, errors → JSON format.

### 8.4 정합성 검증 (verify_integrity)

#### Structural (빠름)
- Dangling relations (src/dst entity 없음)
- Orphan facts (entity 없는 fact)
- Missing sources (entity에 source 없음)
- Evidence-less relations
- Stale content_hash (source hash ≠ file hash)

#### Semantic (느림)
- **Spec 커버리지 갭**: spec entity 있지만 `implements` relation 없음
- **테스트 갭**: code entity 있지만 `tests` relation 없음
- **순환 의존**: `depends_on` 관계에 cycle 존재
- **Ghost references**: relation의 대상 entity가 tombstoned
- **Duplicate entities**: 다른 key지만 동일 file의 동일 span을 가리키는 entity

### 8.5 멀티 에이전트 동시성

- **읽기**: 동시 무제한. 읽기 전용 replica 지원 준비
- **쓰기**: sync_run.status='running' 체크로 동시 sync 방지. 장기: advisory lock

### 8.6 스키마 진화 전략

- Drizzle Kit migration이 SSOT
- **무중단 원칙**: NOT NULL 제약은 backfill 완료 후 별도 migration에서 추가
- **새 테이블/컬럼**: additive migration (하위 호환)
- **Breaking change**: 2단계 — (1) 새 컬럼 추가 + dual write, (2) 이전 컬럼 제거
- **Type 테이블 확장**: 새 파서가 새 `entity_type`/`fact_type`/`relation_type`을 사용하면, 해당 파서 도입 migration에서 type row를 `INSERT`. type 테이블은 schema의 일부이므로 **config가 아닌 migration으로만 관리**

### 8.7 KB 자체 테스트 전략

| 테스트 유형 | 검증 대상 |
|------------|----------|
| **Parser 단위** | input file → expected entities/facts/relations |
| **Sync 통합** | 파일 변경 → KB 상태 검증 (create/update/delete/restore) |
| **Search 품질** | known queries → expected results (precision/recall) |
| **Integrity** | 의도적 불일치 → verify_integrity 검출 확인 |
| **Performance** | SLO 기준 benchmark |

### 8.8 Bun API 매핑

| 기능 | API |
|------|-----|
| 파일 읽기 | `Bun.file(path).text()` / `.bytes()` / `.stream()` |
| 해싱 | `new Bun.CryptoHasher("sha256").update(content).digest("hex")` |
| 글롭/스캔 | `new Glob(pattern).scan({ cwd })` |
| 파일 감시 | `import { watch } from "fs"` + `{ recursive: true }` |
| hostname | `import { hostname } from "os"` |

---

## §9. Execution Plan

### Phase 1: Foundation
1. Clean 스키마 마이그레이션 (workspace, entity, source, fact, relation, relation_evidence, sync_run, sync_event, type tables)
2. Drizzle schema 정의
3. KB config loader (`bunner.kb.jsonc` parsing + defaults)
4. workspace_id 자동 계산 로직

### Phase 2: Sync Engine
5. File scanner (Glob.scan + content_hash 계산)
6. In-memory sync queue (priority queue)
7. Background sync worker (queue consumer)
8. Startup background scan (Layer 1)

### Phase 3: Parser System
9. Parser interface + registry
10. PackageJsonParser
11. TypeScriptModuleParser (기본 module/export 추출)
12. TestFileParser

### Phase 4: Watch & Read-through
13. fs.watch + debounce → sync queue (Layer 2)
14. In-memory hash cache + eviction
15. Read-through validation — hash check + stale flag (Layer 3)

### Phase 5: Query Tools
16. Lexical search (FTS + ts_rank_cd)
17. describe, relations, facts, evidence
18. search with filters
19. bulk_describe, bulk_facts

### Phase 6: Analysis Tools
20. impact_analysis (reverse dependency BFS)
21. dependency_graph (upstream/downstream)
22. trace_chain (shortest path BFS)
23. coverage_map, inconsistency_report, find_orphans

### Phase 7: Temporal & Operations
24. sync_event 기록 로직 (worker에 통합)
25. recent_changes, changelog
26. kb_health (full metrics)
27. verify_integrity (structural + semantic)
28. purge_tombstones
29. Structured logging

### Phase 8 (추후): Advanced
30. Vector search (pgvector embeddings)
31. SpecMarkdownParser (docs/ 추가 시)
32. GenericMarkdownParser
33. Scheduled integrity checks
34. Read replica 지원
35. Audit retention auto-purge

### Definition of Done

- [ ] MCP 서버 시작 시 즉시 쿼리 가능. full scan은 background에서 자동 실행
- [ ] fs.watch로 파일 변경을 감지하고 background worker가 자동 sync
- [ ] 읽기 쿼리에서 stale 데이터는 `stale: true` 플래그와 함께 반환. re-extract는 background
- [ ] sync 도구를 호출하지 않아도 KB가 파일 시스템과 일치 (eventual consistency)
- [ ] 모든 데이터가 workspace_id로 격리
- [ ] content_hash 기반 변경 감지. Git 의존 제로
- [ ] 삭제된 파일의 entity가 tombstone 처리. 기본 검색에서 숨김
- [ ] 모든 relation이 evidence를 가짐 (또는 생성 거부)
- [ ] Parser는 interface 기반 플러그인. 새 파서 추가 시 기존 코드 수정 불필요
- [ ] impact_analysis, dependency_graph, trace_chain 동작
- [ ] coverage_map, inconsistency_report, find_orphans 동작
- [ ] recent_changes, changelog가 sync_event 기반으로 동작
- [ ] verify_integrity가 structural + semantic 검증 수행
- [ ] kb_health()가 DB, watch, queue, counts, cache 상태를 반환
- [ ] bunner.kb.jsonc로 watch scope, exclude, parser 활성화 설정 가능
- [ ] Bun API만 사용 (node:fs, node:path 사용 없음)

---

## §10. Agent Protocol (KB 활용 규범)

> **이 섹션은 "권장사항"이 아니라 "의무 규범"이다.**
> KB 정합성(§3)은 mechanism으로 보장되지만, KB 활용은 이 프로토콜로 강제한다.
> 데이터가 정확해도 에이전트가 참조하지 않으면 KB의 존재 의의가 없다.

### 10.1 두 레이어

| 레이어 | 보장 수단 | 상태 |
|--------|----------|------|
| **KB 정합성** — 데이터가 파일 시스템과 일치 | Mechanism (3-Layer sync, §3) | ✅ 자동 |
| **KB 활용** — 에이전트가 KB를 참조하여 작업 | **이 프로토콜** | ✅ 의무 |

### 10.2 필수 도구 호출 (의무적 체크포인트)

#### 작업 시작 시 (세션 시작, 새 태스크)

| 순서 | 호출 | 목적 | 필수 |
|------|------|------|------|
| 1 | `kb_health()` | KB 상태 확인. `startupScanComplete=false`면 scan 완료 대기 | ✅ |
| 2 | `search(관련_키워드)` | 작업 대상 entity 파악 | ✅ |
| 3 | `describe(entityKey)` + `relations(entityKey)` | 대상의 구조·의존 파악 | ✅ |
| 4 | `facts(entityKey)` | 상세 사항 확인 | 상황별 |

#### 변경 전 (파일 수정/생성/삭제 전)

| 순서 | 호출 | 목적 | 필수 |
|------|------|------|------|
| 1 | `impact_analysis(entityKey, depth≥3)` | 변경 영향 범위 파악 | ✅ |
| 2 | `coverage_map(specKey)` | spec 관련 변경 시 커버리지 확인 | spec 변경 시 ✅ |
| 3 | 영향 범위가 예상보다 크면 **사용자에게 보고** 후 진행 | 리스크 관리 | ✅ |

#### 변경 후 (파일 수정 완료 후)

| 순서 | 호출 | 목적 | 필수 |
|------|------|------|------|
| 1 | (자동) Background worker sync | 에이전트 호출 불필요 | 자동 |
| 2 | `verify_integrity("structural")` | 기본 정합성 확인 | ✅ |
| 3 | integrity 위반 발견 시 **즉시 수정** | 정합성 복구 | ✅ |

### 10.3 금지 행동

| # | 금지 | 이유 |
|---|------|------|
| F1 | **KB 미확인 코드 수정 금지**: `describe` + `relations` 확인 없이 기존 파일 수정 불가 | 의존 관계를 모르고 수정하면 연쇄 파괴 |
| F2 | **stale 결과 신뢰 금지**: `stale=true`인 결과로 최종 판단하지 않음. sync 완료 후 재조회 | stale 데이터는 현재 파일과 다를 수 있음 |
| F3 | **impact 미확인 Public API 변경 금지**: `impact_analysis` 없이 exports, CLI, MCP 인터페이스 변경 불가 | 하류 의존자가 깨질 수 있음 |
| F4 | **불일치 무시 금지**: `inconsistency_report` / `find_orphans` 결과를 확인하지 않고 작업 진행 불가 | 기존 불일치 위에 새 변경을 쌓으면 복구 비용 증가 |

### 10.4 도구 선택 가이드

| 질문 / 상황 | 호출 도구 |
|---|---|
| "이 코드가 뭘 하는가?" | `describe` + `facts` |
| "이걸 바꾸면 뭐가 깨지나?" | `impact_analysis` |
| "이 spec이 구현되었나?" | `coverage_map` |
| "이 entity와 연관된 건?" | `relations` |
| "A에서 B까지 어떻게 연결되나?" | `trace_chain` |
| "전체적으로 빠진 건?" | `inconsistency_report` + `find_orphans` |
| "최근 뭐가 바뀌었나?" | `recent_changes` |
| "이 entity의 변경 이력은?" | `changelog` |
| "KB가 정상인가?" | `kb_health` |
| "데이터 무결성 확인" | `verify_integrity` |
| "여러 entity 한번에 파악" | `bulk_describe` + `bulk_facts` |

### 10.5 결과 해석 프로토콜

| 결과 | 대응 | 금지 |
|------|------|------|
| `stale: true` | sync 대기 → 재조회. 급하면 현재 결과 참고하되 **변경 판단은 sync 후** | stale 결과로 파일 수정 |
| 검색 0건 | 키워드 변경 재시도 (최소 2회). 그래도 0건이면 **새 entity 가능성** 보고 | 0건 = "없다"로 단정 |
| integrity 위반 | 즉시 사용자에게 보고 + 수정 시도. 수정 불가 시 에스컬레이션 | 위반 무시하고 작업 속행 |
| `kb_health.db.healthy=false` | **작업 즉시 중단**. DB 복구 후 재개 | DB 없이 작업 속행 |
| `kb_health.watch.healthy=false` | `sync(scope="full")` 수동 호출 고려. 작업은 계속 가능 | — |
| `kb_health.startupScanComplete=false` | 결과가 불완전할 수 있음을 인지. 중요 작업은 scan 완료 후 | scan 미완료 상태에서 대규모 변경 |

### 10.6 AGENTS.md 연동

- `bunner-kb`는 AGENTS.md의 **필수 MCP 도구**로 등록되어야 한다
- 역할 분담:
  - `context7` = **외부** 패키지·API·버전 확인
  - `bunner-kb` = **프로젝트 내부** 구조·규칙·의존·커버리지 확인
  - `sequential-thinking` = 분석·판단·계획
- 세 도구는 상호 보완적이며, 각각의 영역에서 대체 불가

---

## Appendix A: Migration Mapping

현재 코드베이스의 테이블명과 새 설계의 매핑.

| 현재 (legacy) | 새 설계 | 비고 |
|---------------|---------|------|
| pointer | **source** | entity_id FK 추가, rev→content_hash |
| chunk | **fact** | fact_key = chunk_key |
| edge | **relation** | |
| edge_evidence | **relation_evidence** | |
| ingest_run | **sync_run** | trigger 컬럼 추가 |
| — | **workspace** | 신규 |
| — | **sync_event** | 신규 (audit trail) |
