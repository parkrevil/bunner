# Card-centric Knowledge Base 설계 v4 (PostgreSQL 확정)

> **범위**: bunner-kb MCP 서버를 Card-centric 아키텍처로 전환  
> **상태**: 설계 v4.6 (이전 문서 의존성 완전 제거 — 2026-02-11)  
> **DB**: PostgreSQL (확정)  
> **관련 코드**: `tooling/mcp/`  
> **v4는 자체 완결 문서이며, 이전 설계 문서에 의존하지 않는다.**

---

## 1. 배경 및 동기

### 1.1 현재 운영 모델

| 구분 | 설명 | 등록 방식 |
|------|------|-----------|
| **스펙(spec)** | 사용자와 에이전트가 논의하여 확정한 기능 명세 | 수동 등록 (`entity_type = 'spec'`) |
| **코드(code)** | TypeScript 소스 파일에서 추출한 모듈/심볼 | `sync` 파서가 자동 생성 (`module:`, `symbol:` 엔티티) |
| **스펙↔코드 연결** | 어떤 코드가 어떤 스펙을 구현하는지 | 수동 링크 (`relation_type = 'implements'`, `strength = 'manual'`) |

### 1.2 v1의 핵심 문제

코드 엔티티의 `entity_key`가 **파일 경로에 종속**되어 있다. 파일 이동/리네임 시 `entity.id`가 바뀌어 **링크가 파손**된다.

현재 설계의 `entity_key rewrite` + `grace window` 접근은:
- 정체성 보존이 "보정 메커니즘"에 의존 (선언이 아닌 패치)
- grace window edge case 7종, pending_delete 등 부수 복잡도
- 거버넌스 부재, 계약 이력 없음

### 1.3 이전 설계의 한계 (왜 v4가 필요한가)

identity/version 분리로 v1의 파일 경로 종속 문제는 해결되었다. 그러나 이전 설계에는 다음 한계가 있었다:

| 한계 | 설명 |
|------|------|
| **Code-centric** | KB의 중심이 코드이고 명세는 보조적 위치. "이 코드의 구조는?"이 핵심 질문 |
| **Spec/Claim 이원 구조** | 명세와 하위 항목을 별도 entity_type으로 분리 관리. 중첩 불가 (depth=1 고정) |
| **Flat coverage** | `linked / total` 단순 비율. 가중치, 우선순위 없음 |
| **단일 relation 테이블** | code↔code 정적 분석과 명세↔code 수동 link가 같은 테이블에 혼재 |
| **Evidence 단일 유형** | fact 참조만 가능. test, annotation, review 등 다형성 부재 |
| **명세 속성 부재** | status, priority, tags, weight 없음. 분류/필터링 수단 부족 |
| **설계 버그 다수** | DDL 버그, SQL 오류, 명세 누락 등이 리뷰 과정에서 식별됨 |

### 1.4 v4 설계 목표

이전 설계의 identity/version 분리 + 3-tier defense + approval_event 거버넌스를 **기반**으로 하되:

1. **Card-centric KB**: 중심축을 code → card로 이동. Card = 1급 지식 객체
2. **Unified card model**: spec/claim 이원 구조 폐지 → card nested tree 단일 모델
3. **연결 모델 분리**: card_link / card_relation / code_relation 3종 분리
4. **Evidence 다형성**: code_link, test_pass, annotation, manual_review, ai_verification
5. **Card lifecycle**: draft → accepted → implementing → verified → deprecated + 하위 전파
6. **Composite coverage**: 재귀 가중 집계 + tag 횡단 집계
7. **Card 속성 정규화**: status/priority/tags/weight는 전용 컬럼으로 승격 (JSONB 과용 방지)
8. **멀티 테넌시/멀티 프로젝트/브랜치**: tenant > project > workspace(branch) + user
9. **배포 모델**: N MCP(로컬) : 1 DB(공유). workspace/user = 라벨 원칙, Git 독립 원칙 (v4.3)
10. **Graph Read Model(데이터 준비만)**: VIEW/TABLE 생성 없이도 서브그래프 조회가 가능한 스키마/인덱스/쿼리 패턴 제공
11. **검색/벡터 준비**: Postgres FTS + pgvector 훅
12. **Agent Context Retrieval**: 에이전트가 최소 컨텍스트를 빠르게 얻는 도구 추가
13. **이전 설계 리뷰에서 식별된 DDL/SQL/명세 버그 전부 반영**

### 1.5 DB 선택: PostgreSQL 확정

**결정 요약**: bunner-kb는 로컬 개발 도구(MCP 서버) 성격이 강하고, v4 모델은 거버넌스/정합성(approval_event, identity/version, link/evidence)이 핵심이므로 PostgreSQL을 SSOT로 확정한다.

**근거**

- **참조 무결성**: FK + `ON DELETE CASCADE/SET NULL/RESTRICT`를 DB 레벨에서 선언적으로 보장
- **트랜잭션 안전성**: approval_event + version + link/evidence를 하나의 트랜잭션으로 강하게 묶기 유리
- **자체 호스팅**: FTS/pgvector를 포함한 핵심 기능을 클라우드 종속 없이 운영 가능
- **현 스택 적합성**: `tooling/mcp/`가 Drizzle ORM + PostgreSQL을 전제로 구성

---

## 2. 설계 원칙

### 2.1 Card-first

> KB의 중심축은 card이다. 코드는 card를 구현하는 증거(evidence)이다.

핵심 질문의 전환:
- 이전: "이 코드의 구조는?"
- **v4: "이 요구사항의 구현 상태는?"**

Card는 단순 문서가 아니라 **1급 지식 객체**이다. Stable ID를 갖고, 버전이 관리되며, lifecycle state machine으로 상태가 추적된다.

### 2.2 Evidence-typed

코드는 card 이행의 **증거(evidence)**이다. 증거에는 여러 유형이 있다:

| Evidence Type | 설명 | 수집 방식 |
|---------------|------|----------|
| `code_link` | 코드 entity가 연결됨 | 수동 (link_card) |
| `test_pass` | 테스트가 통과함 | 자동 (CI 연동) |
| `annotation` | `@card` 주석이 코드에 존재 | 자동 (파서) |
| `manual_review` | 사람이 확인함 | 수동 |
| `ai_verification` | AI가 코드↔card 일치 확인 | 자동 |

### 2.3 Human-approved Truth

시스템의 진실은 추론이 아니라 **승인 로그**이다.

- **자동**: 결정론적 케이스만 (동일 content_hash, 1:1 매칭)
- **반자동**: 후보와 근거만 제시
- **수동확정**: 최종 링크/정체성 확정은 승인 이벤트 필요

### 2.4 평가 기준

| 기준 | 정의 | v4 목표 |
|------|------|---------|
| **Auditability** | 왜 이 링크가 생겼는지 재현 가능한가? | approval_event + evidence + anchor로 완전 재현 |
| **Reversibility** | 오탐을 안전하게 되돌릴 수 있는가? | compensating approval_event로 롤백 |
| **Governance** | 자동화와 인간 책임 경계가 명확한가? | card lifecycle + 승인 이벤트가 단일 진실 소스 |
| **Evolution cost** | 규모가 커져도 규칙 복잡도가 선형 이하인가? | identity+version + nested card tree |
| **Discoverability** | 원하는 정보를 쉽게 찾을 수 있는가? | tag + priority + status 필터링 |

### 2.5 범용화 원칙 (Portability)

bunner-kb는 언어/프로젝트/환경에 무관한 **바이브코딩 RAG 서버**.

| 원칙 | 실천 |
|------|------|
| 코어와 파서를 섞지 않는다 | identity/version/card/approval 로직에 특정 언어 파서 코드를 넣지 않는다 |
| entity_key 형식을 코어에서 가정하지 않는다 | 코어는 entity_key를 opaque string으로 취급 |
| 파서 인터페이스를 확정한다 | `KBParser` 인터페이스를 명시적으로 정의 |
| config를 한 곳에 모은다 | 파일 확장자, hash 단위, @card 패턴 등을 config 파일로 외부화 |

#### KBParser 인터페이스

```typescript
interface KBParser {
  /** 지원하는 파일 확장자 */
  extensions: string[];
  /** 파일을 파싱하여 entity/fact/relation을 추출 */
  parseFile(filePath: string, content: string): ParseResult;
  /** content_hash 계산 (정규화 규칙 명시) */
  computeHash(content: string): string;
}

interface ParseResult {
  entities: ParsedEntity[];
  facts: ParsedFact[];
  relations: ParsedRelation[];
}
```

> **content_hash 계산 규칙**: UTF-8 정규화 후 SHA-256. BOM 제거, trailing whitespace 제거, LF 정규화 후 해싱. `computeHash` 구현에 명시.

### 2.6 KB 범위 정책 (Scope Boundary)

판단 기준: "이 지식이 바뀌면 **특정 코드를 수정해야 하는가?**"

| 지식 유형 | 코드와 결속력 | 관리 위치 |
|----------|-------------|----------|
| **Card (요구사항)** | 🔴 강함 | **KB** (entity) |
| 프로젝트 철학/비전 | ⚪ 없음 | **문서** |
| 아키텍처 결정 (ADR) | 🟡 약함 | **문서** |
| 스타일 가이드 | 🟡 약함 | **문서 + 린터** |
| 에이전트 규칙 | ⚪ 없음 | **문서** (AGENTS.md) |

### 2.7 멀티 테넌시/프로젝트/브랜치 모델

v4는 단일 워크스페이스 가정에서 확장하여, 다음 계층을 SSOT로 둔다:

- **tenant**: 조직/사용자 경계(배포 단위)
- **project**: card 지식의 경계(요구사항 SSOT)
- **workspace**: 코드 인덱싱 단위 = **project + branch**
- **user**: 행위자 식별 (v4.3 B-1)

#### 설계 원칙 (v4.3 E-1, E-2, E-3)

1. **workspace/user = 라벨 원칙**: workspace와 user는 데이터를 **구분하는 라벨** 역할만 한다. 데이터가 이것들에 의존하면 안 된다. 어떤 브랜치/사용자 패턴이든 DB 데이터는 보장되어야 한다.
2. **Git 독립 원칙**: DB는 Git과 독립적이다. Git hook에 의존하지 않는다. 브랜치를 머지하든 버리든 삭제하든 DB 데이터는 영향받지 않는다.
3. **project_id 유지 사유**: 1 project 환경에서 `project_id`는 `'default'`로 고정. 기능적 역할은 없으나 멀티 프로젝트 확장을 위해 유지. 제거 비용(34회 참조, 전 테이블/인덱스/RLS) > 유지 비용(TEXT 1컬럼).

#### 스코프 규칙(핵심)

- **Card / Card 관계(`card_relation`)**: **project scope**
- **Code / Code 관계(`code_relation`)**: **workspace scope**
- **Card↔Code 연결(`card_link`)**: **cross-scope**(project의 card ↔ workspace의 code)
- **Approval Event**: 기본은 **project scope**, 필요 시 `workspace_id`를 보조로 기록

#### 최소 스키마(개념)

```sql
CREATE TABLE tenant (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "user" (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE project (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL REFERENCES tenant(id),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workspace (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES project(id),
  branch_name TEXT NOT NULL,
  root_path   TEXT,
  status      TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- active workspace만 branch_name 유니크 (v4.3 A-2)
CREATE UNIQUE INDEX workspace_project_branch_unique
  ON workspace(project_id, branch_name)
  WHERE status = 'active';
```

> 단일 사용자/단일 프로젝트 환경에서는 `tenant = 'default'`, `project = repo`, `workspace = branch`로 고정해도 된다.

> **`"user"` 테이블** (v4.3 B-1): 행위자(사용자)를 식별하는 최소 테이블. `user`는 PostgreSQL 예약어이므로 `"user"`로 감싼다. Drizzle ORM에서 테이블명 매핑으로 코드에서는 `user`로 참조 가능. 이후 인증/관리 시스템은 이 테이블을 확장하면 된다.

> **TEXT PK 생성 전략** (v4.5 L-2): `tenant.id`, `project.id`, `workspace.id`, `"user".id`는 모두 `TEXT PRIMARY KEY`이다. 생성 전략:
> - `workspace.id`: **ULID** (`01HXYZ...`) 권장. 시간 정렬 가능 + 충돌 없는 고유값. `Bun.randomUUIDv7()` 또는 `ulid()` 라이브러리 사용.
> - `tenant.id`, `project.id`: 사용자가 지정하는 slug (`'default'`, `'my-project'`). 단일 환경에서는 고정값.
> - `"user".id`: 사용자가 지정하는 식별자 (예: `'alice'`, `'bob'`). 이후 인증 시스템 연동 시 외부 ID로 대체 가능.

> **workspace append-only 원칙** (v4.3 A-5): workspace는 **생성만 한다. 삭제하지 않는다.** entity_identity와 동일한 철학. 비활성화는 `status = 'archived'`로 처리. 같은 `branch_name`이라도 매번 새 workspace를 생성한다(id는 항상 새 고유값). 이전에 archived된 동일 branch_name의 workspace와는 별개의 레코드다. 이유: 같은 이름의 브랜치라도 시점이 다르면 완전히 다른 코드 상태이므로, old 데이터 혼재를 방지한다 (v4.3 A-3).

#### 배포 토폴로지 (v4.3 D-1)

권장 배포 모델: **N MCP(각 로컬) : 1 DB(공유)**

```
[Alice PC]  Cursor IDE ↔ 로컬 MCP 서버 → 공유 PostgreSQL
[Bob PC]    Cursor IDE ↔ 로컬 MCP 서버 → 공유 PostgreSQL
[서버]      PostgreSQL (팀 공유)
```

- 각 개발자 PC에서 MCP 서버를 실행 (Cursor ↔ MCP는 stdio/로컬 HTTP)
- DB만 팀 공유 (PostgreSQL 서버 1대)
- Sync Worker는 각 로컬에서 자기 코드를 인덱싱 → `workspace_id`로 구분되어 DB에 저장
- Card는 DB에서 자연스럽게 팀 공유 (project scope)
- `DATABASE_URL`만 공유 PostgreSQL로 향하게 하면 됨

> **MCP 서버 config 필수 설정** (v4.3 D-3): 각 MCP 인스턴스는 `user_id`(→ `"user".id` 참조)를 설정해야 한다. 모든 write 작업에 이 `user_id`가 `actor_id`로 자동 기록된다.
>
> **user_id 미설정 시 동작** (v4.4 P-5): `user_id`가 config에 없으면 MCP 서버는 **시작 시 에러**를 발생시키고 종료한다 (`"BUNNER_USER_ID is required"`). `"user"` 테이블에 해당 id가 없으면 첫 write 시점에 에러를 발생시킨다 (`"User not found: {user_id}"`). 자동 생성(auto-create)은 하지 않는다 — 사용자 등록은 별도 관리 절차(seed 또는 관리 도구)로 수행한다.

> **동시 sync 방어** (v4.3 D-2): 같은 workspace에 2명이 동시에 sync를 실행하면 충돌 가능. `sync_run` 시작 시 workspace별 `pg_advisory_xact_lock(hashtext(workspace_id))`으로 직렬화한다. v3.1에서 세밀한 파일 단위 잠금으로 전환 가능.

#### Archived Workspace 쿼리 제외 패턴 (v4.4 P-4)

모든 workspace scope 쿼리는 archived 데이터를 제외해야 한다. 두 가지 패턴:

```sql
-- 패턴 1: workspace_id 직접 필터 (대부분의 도구 — 명시적 workspaceId 입력)
WHERE ev.workspace_id = :workspace_id  -- workspace_id가 active인지는 호출자가 보장

-- 패턴 2: workspace 목록 조회 (dashboard, 관리 도구)
SELECT * FROM workspace WHERE project_id = :project_id AND status = 'active'
```

> **규칙**: MCP 도구는 입력받은 `workspaceId`의 `status`를 검증한다. archived workspace에 대한 write 시도는 에러를 반환한다 (`"Workspace is archived"`). read는 히스토리 조회 목적으로 허용하되, 도구 응답에 `archived: true` 플래그를 포함한다.

#### RLS (Row-Level Security) 방향

멀티 테넌시 격리는 PostgreSQL RLS로 강제한다. v4 scope에서는 정책 설계만 명시하고, 구현은 v3.1에서 진행.

```sql
-- 예: entity_version에 대해 project 기준 RLS
ALTER TABLE entity_version ENABLE ROW LEVEL SECURITY;
CREATE POLICY entity_version_project_isolation ON entity_version
  USING (project_id = current_setting('app.current_project_id')::text);
```

| 적용 대상 | 격리 기준 | 비고 |
|-----------|-----------|------|
| card 관련 테이블 | `project_id` | card, card_relation, approval_event |
| code 관련 테이블 | `workspace_id` | code_relation, entity_version(code) |
| cross-scope 테이블 | `project_id` + `workspace_id` | card_link |

> **v4 scope**: RLS 정책 정의. **v3.1**: `SET app.current_project_id` 주입 메커니즘 + Drizzle ORM 통합.

---

## 3. 정체성(Identity) 모델

> identity/version 분리가 v4의 핵심 기반이다. 아래 원칙과 스키마가 v4 전체를 관통한다.

### 3.1 핵심 원칙

> **`entity_identity.id`가 진짜 정체성이다. 이 ID는 entity의 전 생애에 걸쳐 불변이다.**
>
> `entity_key`는 특정 시점의 주소(version)이며, 파일 이동 시 새 version이 추가된다.
> card_link는 `entity_identity.id`를 FK로 참조하므로, **경로 변경에 관계없이 link은 유지된다.**

### 3.2 계층별 정체성 정의

| 레벨 | Identity (불변) | Address (가변) | 매칭 신호 |
|------|-----------------|----------------|-----------|
| **Module** | `entity_identity.id` | `module:{file_path}` → `entity_version` | `content_hash` (SHA-256) |
| **Symbol** | `entity_identity.id` | `symbol:{file_path}#{symbol_name}` → `entity_version` | 부모 module의 identity + `symbol_name` |
| **Card** | `entity_identity.id` | `card::{path}` → `entity_version` | 사용자 지정 `stable_key` (불변, project scope) |

> **v2와의 차이**: `spec`과 `claim` 두 타입이 `card` 하나로 통합됨. `spec::` / `claim::` prefix 대신 `card::` 단일 prefix.

### 3.3 Identity + Version 스키마

#### 참조 테이블 (`entity_type`, `sync_run`)

`entity_identity`와 `entity_version`이 참조하는 기반 테이블:

```sql
CREATE TABLE entity_type (
  id   SMALLSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE   -- 'module', 'symbol', 'card'
);

CREATE TABLE sync_run (
  id          SERIAL PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace(id),
  run_type    TEXT NOT NULL CHECK (run_type IN ('startup', 'watch', 'manual')),
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  files_scanned INTEGER,
  entities_created INTEGER,
  entities_updated INTEGER,
  entities_archived INTEGER,
  meta        JSONB NOT NULL DEFAULT '{}'::jsonb
);
```

#### `entity_identity` (정체성 — 불변)

```sql
CREATE TABLE entity_identity (
  id            SERIAL PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES project(id),
  workspace_id  TEXT REFERENCES workspace(id),
  entity_type_id SMALLINT NOT NULL REFERENCES entity_type(id),
  stable_key    TEXT,          -- card entity만 값이 있음. code entity는 NULL
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- stable_key가 있는 경우만 (card entity). card는 project scope이므로 project_id 기준으로 유니크
CREATE UNIQUE INDEX idx_identity_card_stable_key
  ON entity_identity(project_id, stable_key)
  WHERE stable_key IS NOT NULL;

-- code entity는 workspace scope이므로 workspace_id 기반 조회 최적화
CREATE INDEX idx_identity_workspace_type
  ON entity_identity(workspace_id, entity_type_id)
  WHERE workspace_id IS NOT NULL;
```

> **project_id ↔ workspace.project_id 정합성** (v4.2 A-2): code entity(`workspace_id IS NOT NULL`)의 `project_id`가 workspace의 `project_id`와 반드시 일치해야 한다. DB 트리거로 강제:
> ```sql
> CREATE OR REPLACE FUNCTION enforce_identity_project_consistency() RETURNS trigger AS $$
> BEGIN
>   IF NEW.workspace_id IS NOT NULL THEN
>     IF NEW.project_id != (SELECT project_id FROM workspace WHERE id = NEW.workspace_id) THEN
>       RAISE EXCEPTION 'entity_identity.project_id must match workspace.project_id';
>     END IF;
>   END IF;
>   RETURN NEW;
> END;
> $$ LANGUAGE plpgsql;
>
> CREATE TRIGGER trg_identity_project_consistency
>   BEFORE INSERT OR UPDATE ON entity_identity
>   FOR EACH ROW EXECUTE FUNCTION enforce_identity_project_consistency();
> ```

> **stable_key 불변성**: `stable_key`는 한번 설정되면 변경 불가. DB 트리거로 강제:
> ```sql
> CREATE OR REPLACE FUNCTION prevent_stable_key_update() RETURNS trigger AS $$
> BEGIN
>   IF OLD.stable_key IS NOT NULL AND NEW.stable_key IS DISTINCT FROM OLD.stable_key THEN
>     RAISE EXCEPTION 'stable_key is immutable once set';
>   END IF;
>   RETURN NEW;
> END;
> $$ LANGUAGE plpgsql;
>
> CREATE TRIGGER trg_stable_key_immutable
>   BEFORE UPDATE ON entity_identity
>   FOR EACH ROW EXECUTE FUNCTION prevent_stable_key_update();
> ```

#### `entity_version` (버전 — 가변 주소/상태)

```sql
CREATE TABLE entity_version (
  id            SERIAL PRIMARY KEY,
  identity_id   INTEGER NOT NULL REFERENCES entity_identity(id) ON DELETE CASCADE,
  project_id    TEXT NOT NULL REFERENCES project(id),
  workspace_id  TEXT REFERENCES workspace(id),
  entity_key    TEXT NOT NULL,
  summary       TEXT,

  -- card 정규화 컬럼 (project scope)
  card_status        TEXT,
  card_priority      TEXT,
  card_tags          TEXT[] NOT NULL DEFAULT '{}',
  card_weight        REAL,
  card_template_type TEXT,
  card_body          TEXT,
  card_external_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  card_acceptance_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,

  meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_hash  TEXT,
  status        TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'superseded')),
  version_num   INTEGER NOT NULL DEFAULT 1,
  last_seen_run INTEGER REFERENCES sync_run(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- card(active) 유니크: project scope (workspace_id IS NULL)
CREATE UNIQUE INDEX version_active_unique_project
  ON entity_version(project_id, entity_key)
  WHERE status = 'active' AND workspace_id IS NULL;

-- code(active) 유니크: workspace scope
CREATE UNIQUE INDEX version_active_unique_workspace
  ON entity_version(workspace_id, entity_key)
  WHERE status = 'active' AND workspace_id IS NOT NULL;

-- card 컬럼 제약 (code entity는 NULL 허용)
ALTER TABLE entity_version
  ADD CONSTRAINT card_weight_range
  CHECK (card_weight IS NULL OR (card_weight >= 0.0 AND card_weight <= 1.0));

ALTER TABLE entity_version
  ADD CONSTRAINT card_priority_enum
  CHECK (card_priority IS NULL OR card_priority IN ('P0', 'P1', 'P2', 'P3'));

ALTER TABLE entity_version
  ADD CONSTRAINT card_status_enum
  CHECK (card_status IS NULL OR card_status IN ('draft', 'proposed', 'accepted', 'implementing', 'implemented', 'verified', 'deprecated'));

-- card_tags 필터링/집계용 GIN 인덱스 (v4.2 D-3)
CREATE INDEX entity_version_card_tags_gin_idx
  ON entity_version USING GIN (card_tags)
  WHERE card_tags != '{}';

-- FTS (v4.5 H-1): search_tsv는 summary + card_body + entity_key를 결합한 tsvector
ALTER TABLE entity_version ADD COLUMN search_tsv TSVECTOR;

CREATE INDEX entity_version_search_tsv_idx
  ON entity_version USING GIN (search_tsv)
  WHERE search_tsv IS NOT NULL;

-- search_tsv 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_entity_version_search_tsv() RETURNS trigger AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('simple', COALESCE(NEW.entity_key, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.summary, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.card_body, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_entity_version_search_tsv
  BEFORE INSERT OR UPDATE OF entity_key, summary, card_body ON entity_version
  FOR EACH ROW EXECUTE FUNCTION update_entity_version_search_tsv();
```

> **entity_version.project_id ↔ entity_identity.project_id 정합성** (v4.5 I-1): entity_version의 project_id는 해당 identity의 project_id와 반드시 일치해야 한다. 앱 레벨에서 보장하되, 방어적 트리거도 설치한다:
> ```sql
> CREATE OR REPLACE FUNCTION enforce_version_project_consistency() RETURNS trigger AS $$
> BEGIN
>   IF NEW.project_id != (SELECT project_id FROM entity_identity WHERE id = NEW.identity_id) THEN
>     RAISE EXCEPTION 'entity_version.project_id must match entity_identity.project_id';
>   END IF;
>   RETURN NEW;
> END;
> $$ LANGUAGE plpgsql;
>
> CREATE TRIGGER trg_version_project_consistency
>   BEFORE INSERT OR UPDATE ON entity_version
>   FOR EACH ROW EXECUTE FUNCTION enforce_version_project_consistency();
> ```

> **컬럼 네이밍 규약** (v4.2 E-1): `entity_version`에 `status`와 `card_status` 두 컬럼이 존재한다. 혼동 방지를 위해 다음 규약을 따른다:
> - `status` = **version lifecycle** ('active'/'archived'/'superseded'). 코드에서 `versionStatus`로 참조
> - `card_status` = **card lifecycle** ('draft'/'proposed'/...). 코드에서 `cardStatus`로 참조
> - SQL 쿼리에서 양쪽 모두 사용 시 반드시 `ev.status AS version_status, ev.card_status` 형태로 alias 부여

| 컬럼 | 설명 |
|------|------|
| `status` | version lifecycle. `'active'` = 현재 유효, `'archived'` = 경로 변경으로 비활성, `'superseded'` = identity merge/대체 시 사용 |

> **`superseded` 전이 조건**: `apply_identity_rewrite`로 relation이 다른 identity로 이전될 때, 원래 identity의 version을 `superseded`로 전이. 전이 조건: "해당 identity의 모든 manual relation이 다른 identity로 이전 완료된 경우".

#### `entity_lifecycle` (생애 이벤트 로그)

```sql
CREATE TABLE entity_lifecycle (
  id            SERIAL PRIMARY KEY,
  identity_id   INTEGER NOT NULL REFERENCES entity_identity(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL
    CHECK (event_type IN ('created', 'updated', 'renamed', 'split', 'merged',
                          'superseded', 'archived', 'restored',
                          'status_changed', 'reparented')),
    -- v4 추가: status_changed (card lifecycle), reparented (card 이동)
  from_version_id INTEGER REFERENCES entity_version(id) ON DELETE SET NULL,
  to_version_id   INTEGER REFERENCES entity_version(id) ON DELETE SET NULL,
  related_identity_id INTEGER REFERENCES entity_identity(id),
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

> `from_version_id`와 `to_version_id`에 `ON DELETE SET NULL`을 설정하여 version purge 시 FK 위반을 방지한다.

#### `source` (파일 출처 — version에 종속)

```sql
CREATE TABLE source (
  id          SERIAL PRIMARY KEY,
  version_id  INTEGER NOT NULL REFERENCES entity_version(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('file', 'card', 'manual')),
  file_path   TEXT,                -- file: 실제 경로, card: "__manual__/card/{cardKey}"
  file_hash   TEXT,
  meta        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX source_version_idx ON source(version_id);
CREATE INDEX source_file_path_idx ON source(file_path);
```

#### `fact_type`, `strength_type`, `fact` (파싱 결과 저장)

```sql
CREATE TABLE fact_type (
  id   SMALLSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE      -- 'module_info', 'symbol_info', 'card_body', ...
);

CREATE TABLE strength_type (
  id   SMALLSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE      -- 'inferred', 'manual', 'derived'
);

CREATE TABLE fact (
  id              SERIAL PRIMARY KEY,
  version_id      INTEGER NOT NULL REFERENCES entity_version(id) ON DELETE CASCADE,
  fact_type_id    SMALLINT NOT NULL REFERENCES fact_type(id),
  fact_key        TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload_text    TEXT,            -- card_body 등 FTS 대상 텍스트
  strength_id     SMALLINT NOT NULL REFERENCES strength_type(id),
  meta            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX fact_version_idx ON fact(version_id);
CREATE INDEX fact_type_key_idx ON fact(fact_type_id, fact_key);
```

> **source/fact 생명주기**: 둘 다 `entity_version(id)`를 FK로 참조하며, version이 CASCADE 삭제되면 자동 정리된다. `card_evidence.fact_id`는 `ON DELETE SET NULL`이므로 fact 삭제 시에도 evidence 레코드는 보존된다 (snapshot 필드에 스냅샷 저장).

### 3.4 Identity 조회 전략

4단계 우선순위:

```
1. stable_key   — NOT NULL인 경우 (card entity). WHERE project_id = :project AND stable_key = :key
2. entity_key   — active version의 entity_key로 조회 (scope에 따라 project/workspace로 분기)
3. identity.id  — 직접 ID 지정 (내부 도구용)
4. content_hash — identity matching용
```

```typescript
type IdentityLookup =
  | { by: 'stableKey'; stableKey: string; projectId: string }
  | { by: 'projectEntityKey'; entityKey: string; projectId: string }
  | { by: 'workspaceEntityKey'; entityKey: string; workspaceId: string }
  | { by: 'identityId'; identityId: number }
  | { by: 'contentHash'; contentHash: string; workspaceId: string; entityTypeId?: number };
```

---

## 4. Card 모델 (Unified Nested Card)

### 4.1 핵심 전환: spec/claim → card

이전 설계의 spec/claim 이원 구조를 **card 단일 모델**로 통합한다.

| | 이전 | v4 |
|---|---|---|
| entity_type | `spec`, `claim` (2종) | **`card`** (1종) |
| 계층 | spec → claim (depth=1 고정) | **card nested tree** (depth 무제한) |
| prefix | `spec::`, `claim::` | **`card::`** |
| parent | claim만 parentSpecKey 필요, spec은 불가 | **모든 card가 parent_card_id 보유** (root는 NULL) |

### 4.2 Card 키 형식

```
card::{path}

예:
  card::auth                        (root card)
  card::auth/login                  (child)
  card::auth/login/oauth            (grandchild)
  card::auth/login/oauth/google     (great-grandchild)
```

검증 정규식: `/^card::([a-z0-9][a-z0-9-]*[a-z0-9])(\/[a-z0-9][a-z0-9-]*[a-z0-9])*$/`

- 각 path segment는 kebab-case (2자 이상)
- `/`로 계층 구분
- path가 tree 구조를 반영하지만, **실제 부모-자식 관계는 `card_relation`의 `contains` relation이 SSOT**

> **card_key path vs 실제 tree 불일치 정책** (v4.2 B-1):
> `stable_key`는 불변이므로 `move_card`로 card를 다른 parent로 이동해도 card_key path는 변경되지 않는다. 예: `card::auth/login`을 `billing`의 child로 이동하면, key는 여전히 `card::auth/login`이지만 실제 parent는 `billing`.
>
> **규칙**:
> - card_key path는 **초기 등록 시의 의도를 반영하는 힌트**일 뿐이다
> - 실제 tree 구조는 **반드시 `card_relation(contains)`을 조회**하여 확인한다
> - 도구 응답에서 card 정보 반환 시 `actualParentKey` 필드를 함께 제공하여 불일치를 명시한다
> - `get_context`, `get_implementation_guide` 등 소비 도구는 card_key path가 아닌 card_relation 기반으로 tree를 구성한다

### 4.3 Card 속성 확장

v4에서는 **검색/필터/집계를 자주 하는 card 핵심 속성**을 `entity_version`의 **전용 컬럼으로 승격**한다. (JSONB 과용 방지)

- 전용 컬럼: `card_status`, `card_priority`, `card_tags`, `card_weight`, `card_template_type`, `card_body`
- JSONB 유지: `card_external_refs`, `card_acceptance_criteria`, 기타 확장 메타(`meta`)

```typescript
interface CardRecord {
  body: string;
  status: CardStatus;
  priority: CardPriority | null;
  tags: string[];
  weight: number;
  templateType: CardTemplateType | null;
  externalRefs: ExternalRef[];
  acceptanceCriteria: AcceptanceCriterion[];
}

type CardStatus = 'draft' | 'proposed' | 'accepted' | 'implementing' | 'implemented' | 'verified' | 'deprecated';
type CardPriority = 'P0' | 'P1' | 'P2' | 'P3';
type CardTemplateType = 'feature' | 'bug' | 'integration' | 'constraint' | 'custom';

interface ExternalRef {
  type: 'jira' | 'github_issue' | 'figma' | 'url';
  url: string;
  label?: string;
}

interface AcceptanceCriterion {
  given: string;
  when: string;
  then: string;
}
```

> `CardRecord`는 API 관점의 모델이며, 저장은 `entity_version` 컬럼 + 일부 JSONB로 분해된다.

### 4.4 Card Lifecycle State Machine

```
draft ──propose──→ proposed ──accept──→ accepted ──start──→ implementing
                                                              │
                  deprecated ←──deprecate── verified ←──verify── implemented
```

#### 상태 정의

| 상태 | 의미 | 진입 조건 |
|------|------|----------|
| `draft` | 초안. 아직 논의 중 | 기본 생성 상태 |
| `proposed` | 검토 요청됨 | draft에서 전이 |
| `accepted` | 승인됨. 구현 대기 | proposed에서 전이 (approval 필요) |
| `implementing` | 구현 진행 중 | accepted에서 전이 |
| `implemented` | 구현 완료. 검증 대기 | implementing에서 전이 |
| `verified` | 검증 완료 | implemented에서 전이 (evidence 조건 충족 — 아래 참조) |
| `deprecated` | 폐기됨. 더 이상 유효하지 않음 | 어떤 상태에서든 전이 가능 |

#### 상태 전이 규칙

```typescript
const CARD_STATUS_TRANSITIONS: Record<CardStatus, CardStatus[]> = {
  draft:        ['proposed', 'deprecated'],
  proposed:     ['accepted', 'draft', 'deprecated'],
  accepted:     ['implementing', 'proposed', 'deprecated'],
  implementing: ['implemented', 'accepted', 'deprecated'],
  implemented:  ['verified', 'implementing', 'deprecated'],
  verified:     ['deprecated'],
  deprecated:   [],  // terminal state (복원은 rollback으로만)
};
```

#### 하위 전파 정책

| parent 상태 전이 | child에 대한 영향 | 방식 |
|-----------------|------------------|------|
| → `deprecated` | 모든 child도 `deprecated` + 연결된 card_link에 `stale_status = 'stale_confirmed'` | **강제 전파** (재귀). child별 개별 `card_status_changed` event 생성 (v4.2 D-5) |
| → `draft` (롤백) | 영향 없음 | child 상태 유지 |
| 기타 전이 | **상한 경고** (soft): child 상태가 parent를 초과하면 경고 반환, 차단하지 않음 | 예: parent가 `accepted`인데 child가 `verified`면 경고 |

> **상한 제약 → 상한 경고로 변경** (v4.2 F-2): v4.1의 "상한 제약"은 hard block이었으나, 바이브코딩에서 에이전트가 leaf card부터 bottom-up으로 구현을 완료하는 흐름이 자연스럽다. 따라서 상한을 **경고(warning)**로 완화한다. `update_card_status` 응답에 `warnings: string[]`를 포함하여 "child exceeds parent status" 경고를 반환하되, 전이 자체는 허용한다.

> **상한 순서** (경고 기준): `draft < proposed < accepted < implementing < implemented < verified`

#### deprecated 전이 시 card_link stale 마킹 (v4.2 D-1)

`update_card_status`에서 card가 `deprecated`로 전이될 때:
1. 해당 card의 모든 `card_link`를 `stale_status = 'stale_confirmed'`로 갱신
2. 전파된 child card의 `card_link`도 동일하게 처리
3. `inconsistency_report`에 deprecated card의 stale link 포함

> **card_link 삭제는 하지 않음**: deprecated는 "폐기"이지 "삭제"가 아니다. link은 유지하되 stale로 마킹하여, 필요 시 `unlink_card`로 명시적 정리하거나, 다른 card로 이관(`unlink` → `link_card`)할 수 있도록 한다.

#### verified 전이 evidence 조건 (v4.2 C-1)

`implemented → verified` 전이 시 다음 조건을 검증한다:

| 조건 | 규칙 | 강제 수준 |
|------|------|----------|
| active evidence 존재 | 해당 card의 card_link 중 1건 이상에 `is_active=true`인 evidence 존재 | **필수** (미충족 시 전이 거부) |
| acceptance_criteria 매칭 | card.acceptance_criteria가 있으면, 모든 항목에 대응하는 evidence/link 존재 | **경고** (미충족 시 경고 반환, 전이 허용) |

> leaf card(child 없음)는 card_link + evidence가 직접 필요하고, parent card는 모든 child가 verified인 경우 evidence 없이도 verified 전이 가능하다 (composite coverage = 100%).

#### approval_event 연동

모든 상태 전이는 `approval_event`를 생성한다:
- `event_type: 'card_status_changed'`
- `payload: { cardKey, fromStatus, toStatus, propagatedChildren: [...] }`
- **deprecated 전파 시**: parent event + **child별 개별 `card_status_changed` event** 생성 (v4.2 D-5). 각 child event의 `parent_event_id`는 parent의 event id를 참조. 이를 통해 **child별 개별 rollback**이 가능하다.

#### status 변경과 version의 관계 (v4.2 B-2)

> **설계 결정**: `card_status` 변경은 기존 active version의 **in-place update**이며, 새 version을 생성하지 않는다 (version_num 불변). 이유:
> - status 변경은 card의 **내용(body)** 변경이 아니라 **워크플로우 상태** 변경이다
> - status만 변경할 때마다 version을 만들면 version이 폭발한다
> - status 변경 이력은 `entity_lifecycle(event_type: 'status_changed')` + `approval_event(card_status_changed)`에 기록된다
>
> **stale detection 영향**: version_num 비교 기반 stale detection은 body 변경에만 반응하고 status 변경에는 반응하지 않는다. 이것은 의도적이다 — status 변경은 "코드가 card를 구현하는지"와 무관하므로 link을 stale로 만들 이유가 없다. 단, `deprecated` 전이는 §4.4 "deprecated 전이 시 card_link stale 마킹"에서 별도 처리한다.

### 4.5 Card Body 권장 형식

강제가 아닌 **권장 컨벤션**. 자유 마크다운도 허용.

```markdown
## 요구사항
{이 카드가 무엇을 요구하는지 1~3문장}

## 검증 기준
- Given: {사전 조건}
- When: {행위}
- Then: {기대 결과}

## 비고 (선택)
{추가 맥락, 관련 카드 참조 등}
```

### 4.6 Structural Versioning (v3.1 기반 설계)

Card tree의 **구조 변경**(reparent, reorder)은 content 변경과 구분되어야 한다.

| 변경 유형 | 기록 위치 | 예시 |
|----------|----------|------|
| Content 변경 | `entity_version` (새 version 추가) | card body 수정 |
| 구조 변경 | `entity_lifecycle` (`event_type: 'reparented'`) + `card_relation` 업데이트 | card 이동 |

> **v4 scope**: `entity_lifecycle`에 `reparented` 이벤트로 기록. 전체 tree snapshot은 v3.1.

---

## 5. 연결 모델 (Connection Model)

### 5.1 3종 분리

이전 설계에서는 모든 관계가 `relation` 단일 테이블이었다. v4에서는 성격에 따라 3종으로 분리.

| 테이블 | 대상 | 고유 속성 | 생성 방식 |
|--------|------|----------|----------|
| **`card_link`** | card ↔ code | anchor, rationale, stale_status, verified_at | 수동 / @card 자동 |
| **`card_relation`** | card ↔ card | contains, depends_on, extends, cycle 검사 | 수동 |
| **`code_relation`** | code ↔ code | import, extends, calls | 파서 자동 |

#### 분리 이유

- **card_link**에만 필요한 속성: `anchor`, `rationale`, `stale_status`, `verified_at`, `evidence[]`
- **code_relation**에는 불필요한 거버넌스 (approval_event, 수동 삭제 금지 등)
- 쿼리 단순화: `SELECT * FROM card_link WHERE stale_status = 'stale'`

#### relation_type_registry (관계 타입 확장)

`card_relation`/`code_relation`의 `relation_type`을 `CHECK (IN ...)`로 고정하면 확장 비용이 크다.
v4에서는 관계 타입을 레지스트리 테이블로 관리하고 FK로 참조한다.

```sql
CREATE TABLE relation_type_registry (
  id          SMALLSERIAL PRIMARY KEY,
  domain      TEXT NOT NULL CHECK (domain IN ('card_relation', 'code_relation')),
  key         TEXT NOT NULL,
  description TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(domain, key)
);
```

도구/API는 `relationType: 'contains' | ...`처럼 **key**를 사용하고, 저장 계층에서 `(domain, key) → id`를 resolve하여 `*_relation.relation_type_id`로 기록한다.

### 5.2 `card_link` (card ↔ code)

```sql
CREATE TABLE card_link (
  id              SERIAL PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES project(id),
  workspace_id    TEXT NOT NULL REFERENCES workspace(id),
  card_identity_id  INTEGER NOT NULL REFERENCES entity_identity(id) ON DELETE CASCADE,
  code_identity_id  INTEGER NOT NULL REFERENCES entity_identity(id) ON DELETE CASCADE,
  anchor          JSONB NOT NULL,          -- LinkAnchor snapshot
  rationale       TEXT NOT NULL,
  weight          REAL NOT NULL DEFAULT 1.0
    CHECK (weight >= 0.0 AND weight <= 1.0),
  confidence      REAL
    CHECK (confidence IS NULL OR (confidence >= 0.0 AND confidence <= 1.0)),
  created_by      TEXT NOT NULL REFERENCES "user"(id),  -- v4.3 B-5: 행위자 (user FK)
  stale_status    TEXT NOT NULL DEFAULT 'fresh'
    CHECK (stale_status IN ('fresh', 'stale_candidate', 'stale_confirmed')),
  verified_at     TIMESTAMPTZ,             -- 마지막 검증 시각
  linked_at_card_version_id  INTEGER REFERENCES entity_version(id) ON DELETE SET NULL,
  linked_at_code_version_id  INTEGER REFERENCES entity_version(id) ON DELETE SET NULL,
  meta            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(card_identity_id, code_identity_id)
);

CREATE INDEX card_link_stale_idx ON card_link(stale_status) WHERE stale_status != 'fresh';
CREATE INDEX card_link_scope_idx ON card_link(project_id, workspace_id);
CREATE INDEX card_link_card_idx ON card_link(card_identity_id);
CREATE INDEX card_link_code_idx ON card_link(code_identity_id);
```

> **동일 card↔code pair는 단일 link** (v4.2 F-3): `UNIQUE(card_identity_id, code_identity_id)`에 의해 같은 card와 code 사이에 link는 하나만 존재한다. 하나의 코드 파일이 같은 card의 여러 측면을 구현하는 경우, **symbol 수준**(`symbol:path#functionName`)으로 분리하여 별도 link를 생성한다. module 수준에서 다중 anchor가 필요하면 `card_link.meta`에 보조 anchor를 기록한다.

| 컬럼 | 설명 |
|------|------|
| `card_identity_id` | card의 identity (FK) |
| `code_identity_id` | code entity의 identity (FK) |
| `anchor` | 링크 생성 시점의 코드 식별 정보 (`LinkAnchor`) |
| `rationale` | 왜 이 코드가 이 card를 구현하는지 |
| `created_by` | 링크 생성자 (`"user".id` FK) (v4.3 B-5) |
| `stale_status` | `fresh` = 유효, `stale_candidate` = version_num 차이 감지, `stale_confirmed` = anchor 불일치 확인 |
| `verified_at` | 마지막으로 stale 검증을 통과한 시각 |
| `linked_at_card_version_id` | 링크 생성 시점의 card version |
| `linked_at_code_version_id` | 링크 생성 시점의 code version |

#### LinkAnchor

```typescript
interface LinkAnchor {
  entityKey: string;
  symbolName: string | null;
  filePath: string;
  entityType: string;
  signatureText: string | null;
  symbolKind: string | null;
  versionId: number;
  contentHash: string | null;
}
```

### 5.3 `card_relation` (card ↔ card)

```sql
CREATE TABLE card_relation (
  id              SERIAL PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES project(id),
  src_identity_id INTEGER NOT NULL REFERENCES entity_identity(id) ON DELETE CASCADE,
  dst_identity_id INTEGER NOT NULL REFERENCES entity_identity(id) ON DELETE CASCADE,
  relation_type_id SMALLINT NOT NULL REFERENCES relation_type_registry(id),
  meta            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(src_identity_id, dst_identity_id, relation_type_id)
);

CREATE INDEX card_rel_src_idx ON card_relation(project_id, src_identity_id, relation_type_id);
CREATE INDEX card_rel_dst_idx ON card_relation(project_id, dst_identity_id, relation_type_id);

-- contains relation에서 child(dst)는 부모가 하나만 가능 (tree 구조 DB 강제) (v4.2 A-1)
-- relation_type_registry의 contains id는 seed 시 고정 (§14.4 참조)
CREATE UNIQUE INDEX card_relation_single_parent
  ON card_relation(dst_identity_id)
  WHERE relation_type_id = 1;  -- contains type id (seed에서 고정)
```

| relation_type(key) | 방향 | 의미 | cycle 허용 |
|---------------|------|------|-----------|
| `contains` | parent → child | 소속. nested tree의 edge | ❌ (tree) |
| `depends_on` | A → B | A는 B에 의존 | ❌ (DAG) |
| `extends` | A → B | A는 B를 확장 | ✅ (위임은 순환 허용) |

#### relation_type별 제약 강제 방식

| relation_type | 제약 | 강제 위치 | 이유 |
|--------------|------|----------|------|
| `contains` | **tree** (순환 금지, 부모 단일) | **DB partial unique index** (`card_relation_single_parent`) + **앱 레벨** CTE 순환 검사 | 부모 단일성은 DB에서 강제, 순환 검사는 앱에서 수행 (v4.2 A-1) |
| `depends_on` | **DAG** (순환 금지) | **앱 레벨** (`relate_cards`에서 CTE 순환 검사) | 동일 |
| `extends` | cycle 허용 | 제약 없음 | 상호 확장 가능 |

> **Direct SQL INSERT 방어**: `card_relation` 테이블에 대한 INSERT 권한을 앱 전용 role로 제한. 운영 환경에서 직접 SQL INSERT를 차단하여 앱 레벨 검사를 우회하지 못하게 한다.

#### edge 속성 확장 (v3.1 검토 대상)

현재 `weight`/`confidence`는 `card_link`에만 존재한다. `card_relation`/`code_relation`에도 edge 속성이 필요할 수 있다:

| 테이블 | 현재 | v3.1 검토 |
|--------|------|-----------|
| `card_link` | `weight`, `confidence` ✅ | — |
| `card_relation` | `meta` JSONB만 | `strength` (strong/weak), `confidence` 추가 여부 |
| `code_relation` | `strength` (inferred/manual) | `confidence` 추가 여부 |

> v4에서는 `card_relation.meta`에 임시로 저장하고, v3.1에서 사용 패턴을 확인 후 전용 컬럼 승격 여부를 결정한다.

### 5.4 `code_relation` (code ↔ code)

```sql
CREATE TABLE code_relation (
  id              SERIAL PRIMARY KEY,
  workspace_id    TEXT NOT NULL REFERENCES workspace(id),
  src_identity_id INTEGER NOT NULL REFERENCES entity_identity(id) ON DELETE CASCADE,
  dst_identity_id INTEGER NOT NULL REFERENCES entity_identity(id) ON DELETE CASCADE,
  relation_type_id SMALLINT NOT NULL REFERENCES relation_type_registry(id),
  strength        TEXT NOT NULL DEFAULT 'inferred'
    CHECK (strength IN ('inferred', 'manual')),
  source_file     TEXT,           -- 어떤 파일 파싱에서 생성되었는지
  meta            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(src_identity_id, dst_identity_id, relation_type_id)
);
```

> **이전의 `relation` 단일 테이블**: v4에서는 `card_link` + `card_relation` + `code_relation`으로 분리. migration 시 relation_type에 따라 분배.

### 5.5 연결 방향 확장

| 방향 | 방식 | 설명 |
|------|------|------|
| code → card | `link_card` 수동 | 사용자/에이전트가 명시적으로 연결 |
| code → card | `@card` 주석 자동 | 파서가 `/** @card card::auth/login */` 인식 → 자동 link |
| card → code | glob pattern (v3.1) | card.meta에 `implementsPattern: "src/auth/**"` → 자동 매칭 |
| card → external | external_refs | Jira, GitHub issue, Figma URL |

### 5.6 Graph Read Model (VIEW/TABLE 미생성)

시각화/탐색을 위해 "그래프 조회 가능한 데이터 형태"가 필요하지만, v4에서는 **DB VIEW/TABLE을 생성하지 않는다**.
대신 아래와 같은 **표준 쿼리 패턴**을 도구/서버에서 직접 사용한다.

#### (예) 카드 서브트리 + 링크를 한 번에 로드

```sql
WITH contains_type AS (
  SELECT id FROM relation_type_registry
  WHERE domain = 'card_relation' AND key = 'contains'
),
subtree AS (
  SELECT :root_card_id::int AS card_id, 0 AS depth
  UNION ALL
  SELECT cr.dst_identity_id, st.depth + 1
  FROM card_relation cr
  JOIN subtree st ON st.card_id = cr.src_identity_id
  WHERE cr.project_id = :project_id
    AND cr.relation_type_id = (SELECT id FROM contains_type)
    AND st.depth < :max_depth
)
SELECT
  st.card_id,
  ev.entity_key AS card_key,
  ev.card_status,
  ev.card_priority,
  ev.card_tags,
  ev.card_weight,
  ev.card_body,
  cl.id AS link_id,
  cl.code_identity_id
FROM subtree st
JOIN entity_version ev ON ev.identity_id = st.card_id AND ev.status = 'active'
LEFT JOIN card_link cl ON cl.card_identity_id = st.card_id
  AND cl.project_id = :project_id
  AND cl.workspace_id = :workspace_id;
```

---

## 6. Evidence 모델

### 6.1 다형성 Evidence

이전의 `relation_evidence`를 v4에서는 `card_evidence`로 확장. card_link에 연결.

```sql
CREATE TABLE card_evidence (
  id              SERIAL PRIMARY KEY,
  card_link_id    INTEGER NOT NULL REFERENCES card_link(id) ON DELETE CASCADE,
  evidence_type   TEXT NOT NULL
    CHECK (evidence_type IN ('code_link', 'test_pass', 'annotation', 'manual_review', 'ai_verification')),
  fact_id         INTEGER REFERENCES fact(id) ON DELETE SET NULL,
  version_id      INTEGER REFERENCES entity_version(id) ON DELETE SET NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  snapshot        JSONB,           -- fact/evidence 삭제 시에도 참조 가능
  meta            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX card_evidence_link_active_idx ON card_evidence(card_link_id, is_active);
CREATE INDEX card_evidence_type_idx ON card_evidence(evidence_type);
```

> **확장성 노트**: `evidence_type`은 현재 CHECK constraint로 5종을 고정한다. `relation_type_registry`와 동일한 패턴으로 `evidence_type_registry` 테이블을 도입할 수 있으나, v4에서는 evidence 타입이 안정적(5종)이므로 CHECK를 유지한다. 새 evidence 타입 추가 빈도가 높아지면 v3.1에서 registry로 전환한다. 전환 시 DDL: `ALTER TABLE card_evidence DROP CONSTRAINT ...; ADD COLUMN evidence_type_id SMALLINT REFERENCES evidence_type_registry(id);`

### 6.2 Evidence Type별 수집 경로

| Type | 수집 경로 | is_active 전환 |
|------|----------|---------------|
| `code_link` | `link_card` 도구 호출 시 자동 생성 | 새 version 파싱 시 재확인 → 갱신 |
| `test_pass` | CI 결과 연동 (v3.1) | 테스트 실패 시 `is_active=false` |
| `annotation` | 파서가 `@card` 주석 감지 시 | 주석 제거 시 `is_active=false` |
| `manual_review` | 사용자가 명시적으로 기록 | 사용자가 명시적으로 무효화 |
| `ai_verification` | AI 검증 도구 호출 시 (v3.1) | 재검증 시 갱신 |

### 6.3 Evidence와 is_active 전환 타이밍

sync worker `processFile()` 흐름에서:
1. 파서가 현재 파일의 entity를 파싱
2. 해당 entity의 identity에 연결된 `card_link`를 조회
3. 각 card_link의 evidence 중 `evidence_type = 'code_link'`인 것:
   - 현재 파싱에서 해당 relation이 확인됨 → 유지 (`is_active=true`)
   - 확인 안 됨 → `is_active=false`로 전환
4. `annotation` 타입도 동일 패턴: `@card` 주석이 존재하면 active, 없으면 inactive

---

## 7. Composite Coverage

### 7.1 Coverage 계산 모델

#### Leaf Coverage

leaf card (child가 없는 card)의 coverage:
- `stale_status = 'fresh'`인 `card_link`가 1건 이상 존재하고, 해당 link에 `is_active = true`인 `card_evidence`가 있으면 → **covered**
- 위 조건 미충족 → **uncovered**

> **v4.4 P-1, P-2**: coverage 계산은 (1) stale link를 제외하고 (2) active evidence가 있는 link만 유효한 구현으로 인정한다. evidence 없는 link나 stale link는 coverage에 기여하지 않는다.

#### Subtree Coverage (재귀 가중 집계)

```
coverage(card) =
  if card is leaf:
    1.0 if covered, 0.0 if uncovered
  else:
    Σ(child.weight × coverage(child)) / Σ(child.weight)
```

```sql
WITH contains_type AS (
  SELECT id
  FROM relation_type_registry
  WHERE domain = 'card_relation' AND key = 'contains'
),
card_tree AS (
  -- base: 대상 card의 직접 children
  SELECT cr.dst_identity_id AS card_id, 1 AS depth
  FROM card_relation cr
  WHERE cr.src_identity_id = {target_card_id}
    AND cr.relation_type_id = (SELECT id FROM contains_type)
  UNION ALL
  -- recursive: children의 children
  SELECT cr.dst_identity_id, ct.depth + 1
  FROM card_relation cr
  JOIN card_tree ct ON ct.card_id = cr.src_identity_id
  WHERE cr.relation_type_id = (SELECT id FROM contains_type)
    AND ct.depth < 50  -- depth limit
)
SELECT
  ct.card_id,
  ev.entity_key AS card_key,
  COALESCE(ev.card_weight, 1.0) AS weight,
  CASE WHEN COUNT(ce.id) > 0 THEN 1.0 ELSE 0.0 END AS leaf_coverage  -- v4.4 P-1: evidence 기준
FROM card_tree ct
JOIN entity_version ev ON ev.identity_id = ct.card_id AND ev.status = 'active'
LEFT JOIN card_link cl ON cl.card_identity_id = ct.card_id
  AND cl.stale_status = 'fresh'                                       -- v4.4 P-2: stale link 제외
  AND (:workspace_id IS NULL OR cl.workspace_id = :workspace_id)       -- v4.3 C-1: workspace 필터
LEFT JOIN card_evidence ce ON ce.card_link_id = cl.id
  AND ce.is_active = true                                              -- v4.4 P-1: active evidence만
GROUP BY ct.card_id, ev.entity_key, ev.card_weight;
```

### 7.2 Tag 기반 횡단 집계

tree 구조와 독립적으로, 특정 tag를 가진 card들의 coverage를 집계:

```sql
SELECT
  tag,
  COUNT(DISTINCT ev.identity_id) AS total_cards,
  COUNT(DISTINCT CASE WHEN ce.id IS NOT NULL THEN ev.identity_id END) AS covered_cards,  -- v4.4 P-1: evidence 기준
  ROUND(
    COUNT(DISTINCT CASE WHEN ce.id IS NOT NULL THEN ev.identity_id END)::numeric
    / NULLIF(COUNT(DISTINCT ev.identity_id), 0)::numeric * 100, 1
  ) AS coverage_pct
FROM entity_version ev
CROSS JOIN LATERAL unnest(ev.card_tags) AS tag
LEFT JOIN card_link cl ON cl.card_identity_id = ev.identity_id
  AND cl.stale_status = 'fresh'                                       -- v4.4 P-2: stale link 제외
  AND (:workspace_id IS NULL OR cl.workspace_id = :workspace_id)       -- v4.3 C-2: workspace 필터
LEFT JOIN card_evidence ce ON ce.card_link_id = cl.id
  AND ce.is_active = true                                              -- v4.4 P-1: active evidence만
WHERE ev.status = 'active'
  AND ev.identity_id IN (
    SELECT id FROM entity_identity WHERE entity_type_id = {card_type_id}
  )
GROUP BY tag;
```

### 7.3 Priority 기반 필터링

```sql
-- P0 카드 중 미구현 목록 (v4.5 M-1: §7.1과 동일한 evidence+stale 기준 적용)
SELECT ev.entity_key, ev.card_status AS status
FROM entity_version ev
WHERE ev.status = 'active'
  AND ev.card_priority = 'P0'
  AND ev.identity_id NOT IN (
    SELECT cl.card_identity_id
    FROM card_link cl
    JOIN card_evidence ce ON ce.card_link_id = cl.id AND ce.is_active = true
    WHERE cl.stale_status = 'fresh'
  );
```

---

## 8. 거버넌스 모델 (Approval Event)

### 8.1 핵심 원칙

**시스템의 진실은 추론이 아니라 승인 로그이다.**

### 8.2 `approval_event` 스키마

```sql
CREATE TABLE approval_event (
  id              SERIAL PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES project(id),
  workspace_id    TEXT REFERENCES workspace(id),
  event_type      TEXT NOT NULL
    CHECK (event_type IN (
      'link_created', 'link_updated', 'link_removed',
      'identity_rewritten', 'identity_merged',
      'link_rollback',
      'card_registered', 'card_updated',
      'card_status_changed',
      'card_relation_created', 'card_relation_updated', 'card_relation_removed',
      'card_reparented'
    )),
  actor_id        TEXT NOT NULL REFERENCES "user"(id),  -- v4.3 B-2: 행위자 (user FK)
  target_card_link_id   INTEGER REFERENCES card_link(id) ON DELETE SET NULL,
  target_identity_id    INTEGER REFERENCES entity_identity(id) ON DELETE SET NULL,
  target_card_relation_id INTEGER REFERENCES card_relation(id) ON DELETE SET NULL,
  payload         JSONB NOT NULL,
  rationale       TEXT,
  parent_event_id INTEGER REFERENCES approval_event(id),  -- 인과 관계 (아래 용도 참조)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX approval_target_link_idx ON approval_event(target_card_link_id);
CREATE INDEX approval_target_identity_idx ON approval_event(target_identity_id);
CREATE INDEX approval_project_time_idx ON approval_event(project_id, created_at DESC);
CREATE INDEX approval_workspace_time_idx ON approval_event(workspace_id, created_at DESC) WHERE workspace_id IS NOT NULL;
CREATE INDEX approval_actor_idx ON approval_event(actor_id);
```

> **`parent_event_id` 사용 시나리오** (v4.2 C-5):
> - **deprecated 전파**: parent card의 `card_status_changed` event → child별 개별 event의 `parent_event_id`가 parent event를 참조
> - **rollback**: `link_rollback` event의 `parent_event_id`가 원본 `link_created` event를 참조
> - **identity merge 후 link 이관**: merge event를 parent로, 이관된 각 link의 `link_updated` event가 참조
> - 용도가 없는 경우 NULL. 조회 시 `parent_event_id`로 인과 체인을 재구성한다.

> **확장성 노트**: `event_type` CHECK constraint는 `relation_type_registry`와 달리 레지스트리 테이블로 분리하지 않는다. 이유:
> - approval_event는 **감사 로그**이므로 새 타입 추가 빈도가 낮다 (도구 추가 시에만)
> - CHECK constraint가 감사 데이터의 무결성을 더 강하게 보장한다
> - 새 event_type 추가 시 `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT ...` DDL migration으로 처리
> - v3.1에서 도구 플러그인 시스템 도입 시 registry 전환을 재검토한다

> `link_removed`의 생성 경로를 명시.
> - `link_removed`는 `rollback_approval`로 `link_created`를 롤백할 때 생성
> - 또는 card가 `deprecated`로 전이 시 연결된 link에 대해 `link_removed` 이벤트 생성
> - 명시적 `unlink_card` 도구도 제공

### 8.3 도구-이벤트 매핑

| 도구 호출 | 생성되는 approval_event |
|-----------|------------------------|
| `register_card` (신규) | `card_registered` |
| `register_card` (갱신) | `card_updated` |
| `update_card_status` | `card_status_changed` |
| `link_card` (신규) | `link_created` |
| `link_card` (기존 갱신) | `link_updated` |
| `unlink_card` | `link_removed` |
| `move_card` | `card_reparented` |
| `relate_cards` (신규) | `card_relation_created` |
| `relate_cards` (기존 갱신) | `card_relation_updated` |
| `apply_identity_rewrite` | `identity_rewritten` |
| `rollback_approval` | `link_rollback` |
| identity merge (시스템 자동) | `identity_merged` |

> **actor_id 기록 원칙** (v4.3 B-2): 모든 approval_event의 `actor_id`는 해당 작업을 트리거한 사용자의 `"user".id`를 기록한다. identity merge처럼 시스템이 자동 수행하는 작업도, 해당 sync를 실행한 MCP 인스턴스의 `user_id` 설정값이 기록된다. 에이전트가 도구를 호출한 경우에도 에이전트를 운용하는 사용자의 ID가 기록된다 — 행위의 책임은 항상 사용자에게 귀속된다 (§2.7 설계 원칙 1).

### 8.4 Payload 검증

각 event_type별 payload에 필수 필드를 검증한다:

```typescript
const PAYLOAD_SCHEMAS: Record<string, z.ZodSchema> = {
  link_created: z.object({
    cardLinkId: z.number(),
    cardIdentityId: z.number(),
    cardKey: z.string(),
    codeIdentityId: z.number(),
    codeEntityKey: z.string(),
    anchor: LinkAnchorSchema,
    rationale: z.string(),
    cardVersionId: z.number(),
    codeVersionId: z.number(),
  }),
  card_status_changed: z.object({
    cardKey: z.string(),
    identityId: z.number(),
    fromStatus: CardStatusSchema,
    toStatus: CardStatusSchema,
    propagatedChildren: z.array(z.string()),
  }),
  // ... 각 event_type별 schema
};
```

> payload 검증 실패 시 이벤트 생성을 거부하고 에러 반환.

### 8.5 Reversibility (되돌리기)

`rollback_approval` 도구:

| event_type | compensating action |
|-----------|-------------------|
| `link_created` | card_link 삭제 (link_removed 이벤트 생성) |
| `link_updated` | card_link.meta를 payload.before로 복원 |
| `link_removed` | card_link 재생성 |
| `identity_rewritten` | card_link의 code_identity_id를 원래 값으로 복원 |
| `identity_merged` | version/relation을 원래 identity로 이관 원복 |
| `card_registered` | version 삭제 + identity 삭제 (cascade) |
| `card_updated` | 이전 version을 active로 복원, 현재 version 삭제 |
| `card_status_changed` | 이전 status로 복원. **child별 개별 event가 존재하므로**(v4.2 D-5) child는 개별 rollback 가능. parent rollback 시 `parent_event_id`로 연결된 child event도 자동 rollback |
| `card_relation_created` | 해당 card_relation 삭제 |
| `card_relation_updated` | card_relation.meta를 이전 상태로 복원 |
| `card_reparented` | 이전 parent로 재이동 |

> `identity_merged` 롤백 시 인과 순서 기준: merge 이후에 생성된 approval_event가 해당 identity를 참조하면 거부. 참조 여부는 `target_identity_id = merged_identity_id` OR payload 내 identity 참조로 판단.

### 8.6 Provenance Chain

특정 card_link에 대해 전체 이력 조회:

```sql
SELECT ae.*
FROM approval_event ae
WHERE ae.target_card_link_id = {card_link_id}
ORDER BY ae.created_at ASC;
```

### 8.7 entity_lifecycle vs approval_event 이중 기록 경계

두 테이블의 역할이 겹치는 이벤트가 있다. 원칙:

| 이벤트 | entity_lifecycle | approval_event | 비고 |
|--------|:---:|:---:|------|
| identity 생성 (sync 자동) | ✅ `created` | ❌ | 자동 이벤트는 lifecycle만 |
| identity 생성 (register_card) | ✅ `created` | ✅ `card_registered` | 수동 도구는 양쪽 모두 |
| version 갱신 (sync) | ✅ `updated` | ❌ | |
| version 갱신 (register_card) | ✅ `updated` | ✅ `card_updated` | |
| identity merge (자동) | ✅ `merged` | ✅ `identity_merged` | **예외**: 자동이지만 감사 필수이므로 양쪽 모두 |
| status 변경 | ✅ `status_changed` | ✅ `card_status_changed` | |
| reparent | ✅ `reparented` | ✅ `card_reparented` | |
| rename (sync 감지) | ✅ `renamed` | ❌ | |
| link 생성/삭제 | ❌ | ✅ `link_*` | link은 approval만 |

**원칙**: `approval_event`는 **거버넌스 감사**(수동 도구, 승인 필요 작업)에만 기록. `entity_lifecycle`은 **모든 identity 상태 변화**를 기록. 양쪽에 기록하는 경우 **단일 트랜잭션 내에서 원자적으로** 기록한다.

```typescript
// Example: register_card 내부
await db.transaction(async (tx) => {
  const version = await createVersion(tx, ...);
  await recordLifecycle(tx, { identityId, eventType: 'created', toVersionId: version.id });
  await recordApproval(tx, { eventType: 'card_registered', payload: {...} });
});
```

---

## 9. 계층적 방어 전략 (3-Tier Defense)

> identity/version 분리가 핵심. 3계층 방어로 파일 이동/리네임 시 link 보존을 보장한다.

### 9.1 개요

```
┌─────────────────────────────────────────────────┐
│  계층 1: content_hash 기반 identity matching     │ ← 자동 (결정론적)
│  대상: 파일 이동 (내용 동일)                       │
├─────────────────────────────────────────────────┤
│  계층 2: resolve_identity_candidates             │ ← 반자동 (인간 승인)
│  대상: 파일 분리/통합, 심볼 리네임                   │
├─────────────────────────────────────────────────┤
│  계층 3: register_card / link_card               │ ← 수동 (논의 기반)
│  대상: 새 카드 등록, 새 링크 생성                    │
└─────────────────────────────────────────────────┘
```

### 9.2 계층 1: content_hash Identity Matching

주요 흐름:

**startupScan 시**:
1. `scanFiles()` 결과와 DB의 active version을 교차 비교
2. content_hash가 동일한 1:1 쌍 → 기존 version archived, 같은 identity에 새 version active
3. 1:N, N:1, hash 불일치 → 기존 version archived, 새 identity 생성

**Watch 이벤트 시**:
- DELETE: version archived. identity + card_link 유지 (identity가 보호)
- CREATE: content_hash로 archived version 검색 → 매칭 성공이면 같은 identity에 연결

**Watch 역순 (CREATE→DELETE) 방어**: Post-DELETE Identity Merge Check — DELETE 처리 후 같은 content_hash를 가진 새 version이 이미 존재하면 자동 merge를 수행한다.

> **Cross-workspace identity merge 정책** (v4.2 C-2): identity merge는 **동일 workspace 내에서만** 수행된다. 다른 workspace(branch)에 같은 파일이 존재해도 서로 독립된 identity로 관리된다. 이유:
> - 각 branch는 독립적인 코드 상태를 가진다
> - branch 간 identity를 merge하면 branch 전환 시 정합성이 깨진다
> - card_link는 workspace_id를 포함하므로, 같은 card가 다른 branch의 같은 파일에 각각 link될 수 있다 (T9-4)

#### Identity Merge 시 card_link 이관 (v4 추가)

v4에서는 `card_link.code_identity_id`를 변경해야 한다:

```sql
-- merge: old_identity → surviving_identity
-- Step 1: card_link의 code_identity_id 이관
UPDATE card_link
SET code_identity_id = :surviving_identity_id,
    updated_at = now()
WHERE code_identity_id = :old_identity_id;

-- Step 2: UNIQUE 충돌 시 (같은 card↔code pair 중복) → 기존 link 유지, 새 link 삭제
-- ON CONFLICT 처리는 앱 레벨에서 선제 검사 후 처리
```

> merge 후 `approval_event(identity_merged)`의 payload에 이관된 card_link ID 목록을 포함한다. rollback 시 역이관에 사용.

#### Symbol-level Identity Cascade

module identity matching이 성공하여 파일 이동이 감지된 경우, **하위 symbol entity**도 처리해야 한다:

1. 이동된 module의 기존 active version에 연결된 symbol identity 목록 조회
2. 각 symbol에 대해:
   - 새 파일에서 동일 symbolName이 존재하면 → 해당 symbol identity에 새 version 추가 (자동)
   - 존재하지 않으면 → 기존 symbol version archived. card_link가 있으면 계층 2로 위임
3. `entity_lifecycle`에 `event_type: 'renamed'` 기록 (symbol 단위)

### 9.3 계층 2: Identity Resolution

`resolve_identity_candidates`로 후보를 제시하고, `apply_identity_rewrite`로 사용자 승인 후 identity를 재작성한다. 자세한 도구 인터페이스는 §12.3 참조.

### 9.4 동시성 Critical Section

v4에서 Advisory Lock은 v3.1로 미뤄졌지만, 다음 작업은 **critical section**으로 식별된다:

| Critical Section | 위험 시나리오 | v4 임시 방어 | v3.1 목표 |
|-----------------|-------------|-------------|-----------|
| `identity_merge` | 동시에 같은 identity를 merge 시도 | `SERIALIZABLE` isolation | `pg_advisory_xact_lock(identity_id)` |
| `link_card` (UPSERT) | 동시에 같은 card↔code pair를 link | `ON CONFLICT` clause | advisory lock |
| `apply_identity_rewrite` | 동시에 같은 identity를 rewrite | `SERIALIZABLE` isolation | advisory lock |
| `move_card` | 동시에 같은 card를 다른 parent로 이동 | `SERIALIZABLE` isolation | advisory lock |
| `update_card_status` (전파) | parent deprecated 중 child status 변경 | `SELECT ... FOR UPDATE` on parent version | advisory lock |
| Watch 이벤트 처리 | 같은 파일의 DELETE+CREATE 동시 처리 | 이벤트 직렬화 (debounce queue) | advisory lock |

> **v4 scope**: 모든 critical section에서 `SERIALIZABLE` 또는 `SELECT ... FOR UPDATE`를 사용한다. 성능 저하가 관측되면 v3.1에서 advisory lock으로 전환.

```typescript
// Example: identity_merge critical section
await db.transaction(async (tx) => {
  // FOR UPDATE로 두 identity를 잠금 (deadlock 방지: 항상 id 오름차순 잠금)
  const [id1, id2] = [oldIdentityId, survivingIdentityId].sort((a, b) => a - b);
  await tx.execute(sql`SELECT 1 FROM entity_identity WHERE id IN (${id1}, ${id2}) FOR UPDATE`);
  // ... merge 로직
});
```

#### Serialization Failure 재시도 (v4.2 D-4)

PostgreSQL `SERIALIZABLE` 격리 수준은 serialization failure (SQLSTATE `40001`)를 발생시킬 수 있다. 모든 critical section에서 **자동 재시도 래퍼**를 사용한다:

```typescript
async function withSerializableRetry<T>(
  db: DrizzleClient,
  fn: (tx: Transaction) => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await db.transaction(fn, { isolationLevel: 'serializable' });
    } catch (e: unknown) {
      const isSerializationFailure = e instanceof Error && 'code' in e && (e as any).code === '40001';
      if (isSerializationFailure && attempt < maxRetries - 1) {
        // exponential backoff: 10ms, 20ms, 40ms
        await new Promise(r => setTimeout(r, 10 * Math.pow(2, attempt)));
        continue;
      }
      throw e;
    }
  }
  throw new Error('unreachable');
}
```

> 이 래퍼는 `identity_merge`, `apply_identity_rewrite`, `move_card` 등 §9.4 표의 SERIALIZABLE critical section에 적용한다.
>
> **모니터링 메트릭** (v4.5 I-2): N명 동시 사용 시 serialization failure 빈도가 높아질 수 있다. 다음 메트릭을 `sync_run.meta` 또는 별도 로그에 기록하여 v3.1 advisory lock 전환 판단에 사용한다:
> - `serialization_retries`: 해당 작업에서 발생한 재시도 횟수
> - `serialization_failures`: 최대 재시도 초과로 실패한 횟수
> - `avg_retry_delay_ms`: 평균 재시도 대기 시간

### 9.5 계층 3: 수동 도구

이전의 spec 도구를 card-centric으로 변경. 도구명 변경:
- `register_spec` → `register_card`
- `link_spec` → `link_card`
- `relate_specs` → `relate_cards`
- `spec_impact` → `card_impact`
- `kb_status` → `card_dashboard` (v4.2 E-2: `card_status` 컬럼과 혼동 방지를 위해 리네임)

(상세 §13에서 정의)

---

## 10. Sync Worker

### 10.1 Core Loop

version append 중심. 파일 변경 시 기존 version을 archived로 전이하고 새 version을 추가한다.

#### `processFile()` 변경

기존 `processFile()`에 추가:
- `@card` 주석 파싱 → `card_link` 자동 생성 (evidence_type: `annotation`)
- 기존 annotation evidence가 없어졌으면 `is_active=false` 전환

#### `@card` 파싱 에러 처리 (v4.2 C-4)

| 상황 | 처리 |
|------|------|
| 참조된 card가 존재하지 않음 | `sync_event`에 경고 기록 (`action: 'warning'`, `meta: {reason: 'card_not_found', cardKey, filePath}`). card_link 생성하지 않음 |
| card_key 형식이 잘못됨 | 무시 + `sync_event`에 경고 기록 |
| 참조된 card가 `deprecated` | card_link 생성하되 `stale_status = 'stale_confirmed'`으로 생성. 경고 기록 |
| workspace.project_id에 해당 card가 없음 | `sync_event`에 경고 기록. card_link 생성하지 않음 |

> `@card` 파싱 실패는 **sync를 중단시키지 않는다**. 경고만 기록하고 나머지 파일 처리를 계속한다.

### 10.2 Orphan Cleanup

**code_relation orphan**: 파싱 파일 scope로 한정 + `strength='manual'` 제외.

**card_link orphan 금지**: card_link는 수동 생성이므로 sync에서 자동 삭제하지 않음. stale 마킹만.

### 10.3 `__manual__/` 경로 보호

5개 레이어 필터링: (1) `.gitignore` (2) `node_modules/` (3) `__manual__/` prefix (4) config 파일 확장자 (5) binary 감지. `__manual__/` 경로의 source는 sync 대상에서 완전 제외된다.

### 10.4 Stale Link Detection

card 갱신 시 기존 card_link의 stale 감지:

1. `card_updated` 이벤트 발생 시
2. 해당 card의 모든 card_link를 조회
3. 각 link에 대해:
   - `linked_at_card_version_id`의 `version_num` vs 현재 card의 `version_num` 비교
   - 차이 ≥ 1 → `stale_status = 'stale_candidate'`
   - anchor의 keyword가 현재 card body에서 매칭 안 되면 → `stale_status = 'stale_confirmed'`
4. `inconsistency_report`에 stale link 포함

---

## 11. Purge/Archive 모델

### 11.1 Version Purge

archived version의 TTL 기반 물리 삭제:

```sql
-- Step 1: entity_lifecycle의 version FK를 NULL로 설정
UPDATE entity_lifecycle
SET from_version_id = NULL
WHERE from_version_id IN (
  SELECT id FROM entity_version
  WHERE status = 'archived'
    AND created_at < now() - {olderThanDays} * interval '1 day'
);

UPDATE entity_lifecycle
SET to_version_id = NULL
WHERE to_version_id IN (
  SELECT id FROM entity_version
  WHERE status = 'archived'
    AND created_at < now() - {olderThanDays} * interval '1 day'
);

-- Step 2: card_evidence snapshot 보존
UPDATE card_evidence ce
SET snapshot = jsonb_build_object(
      'factKey', f.fact_key,
      'factPayload', f.payload,
      'entityKey', ev.entity_key,
      'contentHash', ev.content_hash
    ),
    is_active = false
FROM fact f
JOIN entity_version ev ON ev.id = f.version_id
WHERE ce.fact_id = f.id
  AND ev.status = 'archived'
  AND ev.created_at < now() - {olderThanDays} * interval '1 day'
  AND ce.snapshot IS NULL;

-- Step 3: archived version 삭제 (fact/source FK cascade)
DELETE FROM entity_version
WHERE status = 'archived'
  AND created_at < now() - {olderThanDays} * interval '1 day';
```

### 11.2 Identity Purge

모든 version이 삭제된 identity를 TTL 후 정리 (COALESCE fallback으로 lifecycle 없는 identity도 처리):

```sql
DELETE FROM entity_identity ei
WHERE NOT EXISTS (
  SELECT 1 FROM entity_version ev WHERE ev.identity_id = ei.id
)
AND COALESCE(
  (SELECT MAX(el.created_at) FROM entity_lifecycle el WHERE el.identity_id = ei.id),
  ei.created_at  -- fallback: lifecycle이 없으면 identity 생성 시각 사용
) < now() - {olderThanDays} * interval '1 day'
AND NOT EXISTS (
  SELECT 1 FROM card_link cl
  WHERE cl.card_identity_id = ei.id OR cl.code_identity_id = ei.id
);
```

> **보호 조건**: card_link가 참여하는 identity는 purge하지 않음. card_link 자체가 identity 보호 역할을 한다.

### 11.3 보호 해제 경로

| 해제 조건 | 설명 |
|-----------|------|
| `apply_identity_rewrite`로 card_link 이전 | 옛 identity에 link 없어지면 purge 가능 |
| `unlink_card`로 link 삭제 | link 해제 |
| card `deprecated` 전이 시 link 정리 | deprecated card의 link을 정리하면 code identity 보호 해제 |

### 11.4 Workspace Archive 절차 (v4.3 A-4, 구 v4.2 A-3 전면 교체)

workspace는 **삭제하지 않고 archive**한다 (append-only 원칙, §2.7). DDL에 ON DELETE CASCADE를 두지 않으며, workspace 레코드 자체도 DELETE하지 않는다.

```sql
-- Step 1: workspace의 code entity version을 archived로 전이
UPDATE entity_version
SET status = 'archived'
WHERE workspace_id = :workspace_id AND status = 'active';

-- Step 2: workspace의 card_link stale 마킹
UPDATE card_link
SET stale_status = 'stale_confirmed', updated_at = now()
WHERE workspace_id = :workspace_id AND stale_status = 'fresh';

-- Step 3: workspace 자체를 archived로 전이
UPDATE workspace
SET status = 'archived', updated_at = now()
WHERE id = :workspace_id;
```

> **DELETE 없음**: workspace, card_link, entity_identity, code_relation, sync_run 모두 삭제하지 않는다. workspace가 archived되면 해당 workspace의 모든 데이터는 감사/히스토리 목적으로 영구 보존된다.
>
> **code_relation 처리** (v4.4 P-3): code_relation은 workspace scope이며, archive 시 별도 상태 변경 없이 그대로 보존된다. 쿼리 시 workspace_id 필터로 active workspace의 데이터만 조회하므로, archived workspace의 code_relation은 자연스럽게 제외된다 (§2.7 쿼리 패턴 참조).
>
> **같은 branch_name 재생성 시** (v4.3 A-3): 이전 workspace는 archived 상태이므로 `workspace_project_branch_unique` partial unique index(`WHERE status = 'active'`)에 의해 충돌 없이 **새 workspace가 생성**된다. reactivate는 하지 않는다 — 같은 이름의 브랜치라도 시점이 다르면 코드 상태가 완전히 다르므로 old 데이터 혼재를 방지한다.
>
> **entity_identity 정리**: identity purge (§11.2)가 active version이 없는 identity를 정리한다.

### 11.5 머지 후 card_link 이관 정책 (v4.3 F-1)

feature branch가 main에 머지된 후의 card_link 처리:

| link 유형 | main 이관 여부 | 이유 |
|-----------|---------------|------|
| `@card` annotation 기반 | **자동** | main의 Sync Worker가 코드를 파싱하여 card_link를 재생성 |
| 수동/에이전트 link | **자동 이관 안 됨** | main의 code identity는 별개(cross-workspace merge 금지). 에이전트가 main에서 재연결 필요 |

> **의도적 설계**: branch의 수동 link가 자동으로 main에 이관되면 검증 안 된 link가 main에 유입되는 위험이 있다. main에서의 link는 main에서 명시적으로 생성해야 한다.

---

## 12. MCP 도구

### 12.1 Card 도구

> **스코프 규칙(도구 공통)**
> - card/card_relation/approval_event는 **project scope**이므로 입력에 `projectId`를 포함한다.
> - code/code_relation/card_link는 **workspace scope**이므로 code가 포함되는 도구는 `workspaceId`를 포함한다.

#### `register_card`

card entity를 KB에 등록/갱신한다.

```typescript
interface RegisterCardInput {
  /** project scope */
  projectId: string;
  /** Card 키. 예: "card::auth", "card::auth/login" */
  cardKey: string;
  /** Card 요약 (1~2줄) */
  summary: string;
  /** Card 본문 (markdown) */
  body: string;
  /** 부모 card 키 (선택). 예: "card::auth". 생략하면 root card */
  parentCardKey?: string;
  /** 초기 status (기본: 'draft') */
  status?: CardStatus;
  /** 우선순위 */
  priority?: CardPriority;
  /** 태그 */
  tags?: string[];
  /** coverage 가중치 (0.0 ~ 1.0, 기본: 1.0) */
  weight?: number;
  /** 카드 템플릿 유형 */
  templateType?: CardTemplateType;
  /** 외부 참조 */
  externalRefs?: ExternalRef[];
  /** 검증 기준 */
  acceptanceCriteria?: AcceptanceCriterion[];
  /** 추가 메타 */
  meta?: Record<string, unknown>;
}
```

**동작 절차** (단일 트랜잭션):

1. **Identity 생성/조회**: `stable_key = cardKey`로 조회. 없으면 `entity_type = 'card'`로 생성
2. **Version 생성/갱신**: `content_hash = SHA-256(body)` 비교. 다르면 새 version (version_num++)
3. **Source 생성**: `kind: "card"`, `file_path: "__manual__/card/{cardKey}"`, `file_hash: content_hash와 동일` (v4.2 C-6)
4. **Fact 생성**: `fact_type: "card_body"`, `payload_text: body`. (v4.2 B-3: fact은 `card_evidence.fact_id`의 참조 대상 및 FTS 보조 인덱싱용. `entity_version.card_body`가 SSOT이고, fact은 evidence 체인의 참조점. 갱신 시 양쪽 동시 갱신을 단일 트랜잭션으로 보장)
5. **Contains relation 자동 생성**: `parentCardKey` 지정 시
   - parent identity 조회 → 없으면 에러
  - `card_relation` INSERT (`relationType: 'contains'` → registry resolve → `relation_type_id`, `src = parent`, `dst = this`)
6. **Approval event**: `card_registered` 또는 `card_updated`
7. **Entity lifecycle**: `created` 또는 `updated`

```typescript
interface RegisterCardResult {
  cardKey: string;
  identityId: number;
  versionId: number;
  versionNum: number;
  action: 'created' | 'updated' | 'unchanged';
}
```

#### `link_card`

card와 code entity 사이에 link를 생성한다.

```typescript
interface LinkCardInput {
  /** project scope (card의 SSOT) */
  projectId: string;
  /** workspace scope (code 인덱싱 단위) */
  workspaceId: string;
  /** 코드 entity key */
  codeEntityKey: string;
  /** Card key */
  cardKey: string;
  /** 왜 이 코드가 이 card를 구현하는지 */
  rationale: string;

  /** edge 속성 (선택) */
  weight?: number;
  confidence?: number;
}
```

**동작 절차** (단일 트랜잭션):

1. **코드 entity 확인**: active version 존재 확인
2. **Card entity 확인**: stable_key로 identity 조회
3. **앵커 수집**: 코드 entity의 fact로부터 LinkAnchor 구성
4. **card_link 생성/갱신** (UPSERT on unique constraint)
5. **card_evidence 생성**: `evidence_type: 'code_link'`
6. **Approval event**: `link_created` 또는 `link_updated`

#### `unlink_card`

card와 code 사이의 link를 삭제한다.

```typescript
type UnlinkCardInput =
  | {
      projectId: string;
      workspaceId: string;
      cardLinkId: number;
      reason: string;
    }
  | {
      projectId: string;
      workspaceId: string;
      cardKey: string;
      codeEntityKey: string;
      reason: string;
    };
```

**동작**: card_link 삭제 + `link_removed` approval_event 생성.

#### Deprecated card → 다른 card link 이관 워크플로우 (v4.2 D-2)

card가 deprecated된 후, 해당 card의 code link를 다른 card로 옮기는 표준 절차:

1. `card_dashboard`(또는 `inconsistency_report`)로 deprecated card의 stale link 목록 확인
2. 각 link에 대해:
   - `unlink_card({ cardKey: deprecatedCardKey, codeEntityKey, reason: "migrating to new card" })`
   - `link_card({ cardKey: newCardKey, codeEntityKey, rationale: "migrated from deprecated card::..." })`
3. 이관 완료 후 deprecated card의 모든 link이 정리되면, code identity의 purge 보호가 해제됨

> deprecated card에 직접 `link_card`는 불가(§13.2). 반드시 `unlink` → `link` 순서.

#### `move_card`

card의 부모를 변경한다 (reparent).

```typescript
interface MoveCardInput {
  /** project scope */
  projectId: string;
  /** 이동할 card 키 */
  cardKey: string;
  /** 새 부모 card 키 (null이면 root로 이동) */
  newParentCardKey: string | null;
  /** 이동 이유 */
  reason: string;
}
```

**동작 절차**:
1. 순환 검사: 새 parent가 cardKey의 descendant가 아닌지 확인 (아래 CTE)
2. 기존 `contains` relation 삭제
3. 새 `contains` relation 생성 (newParentCardKey가 있으면)
4. `entity_lifecycle`에 `reparented` 이벤트 기록
5. `approval_event`에 `card_reparented` 기록

**순환 검사 CTE**:

```sql
WITH RECURSIVE contains_type AS (
  SELECT id FROM relation_type_registry
  WHERE domain = 'card_relation' AND key = 'contains'
),
descendants AS (
  -- base: cardKey 자신
  SELECT :card_identity_id::int AS id, 0 AS depth
  UNION ALL
  -- recursive: cardKey의 모든 descendants
  SELECT cr.dst_identity_id, d.depth + 1
  FROM card_relation cr
  JOIN descendants d ON d.id = cr.src_identity_id
  WHERE cr.relation_type_id = (SELECT id FROM contains_type)
    AND d.depth < 50
)
SELECT EXISTS (
  SELECT 1 FROM descendants WHERE id = :new_parent_identity_id
) AS is_circular;
-- is_circular = true이면 에러: "Circular reference detected"
```

#### `update_card_status`

card의 lifecycle 상태를 전이한다.

```typescript
interface UpdateCardStatusInput {
  /** project scope */
  projectId: string;
  cardKey: string;
  newStatus: CardStatus;
  reason?: string;
}
```

**동작 절차**:
1. 현재 status 조회
2. 전이 규칙 검증 (`CARD_STATUS_TRANSITIONS`)
3. status 변경 (active version의 `card_status` 갱신)
4. **하위 전파**: `deprecated` 전이 시 모든 descendants도 deprecated (재귀)
5. `approval_event`에 `card_status_changed` 기록

#### `relate_cards`

card 간 `depends_on` 또는 `extends` 관계를 생성한다.

```typescript
interface RelateCardsInput {
  /** project scope */
  projectId: string;
  srcKey: string;
  dstKey: string;
  relationType: 'depends_on' | 'extends';
  rationale: string;
}
```

`depends_on`에 대해 순환 검사 (recursive CTE, depth 50).

#### `unrelate_cards`

card 간 관계를 삭제한다.

```typescript
interface UnrelateCardsInput {
  /** project scope */
  projectId: string;
  srcKey: string;
  dstKey: string;
  relationType: 'contains' | 'depends_on' | 'extends';
  reason: string;
}
```

> `contains` 삭제 시 child card는 고아가 되지 않도록 경고 반환.

### 12.2 분석 도구

#### `card_impact`

특정 card 변경 시 영향받는 code·card 목록을 재귀 탐색한다.

card-centric 영향 분석:
- **양방향 탐색**: 
  - 역방향: card를 참조하는 code (card_link)
  - 정방향: card의 children (contains), depends_on, extends
- `contains` 관계는 **정방향**(src → dst)으로 탐색 (card의 하위 card)

```typescript
interface CardImpactInput {
  /** project scope */
  projectId: string;
  /** code까지 포함해 탐색할 때의 workspace scope (선택) */
  workspaceId?: string;
  cardKey: string;
  maxDepth?: number;
}

interface CardImpactResult {
  cardKey: string;
  depth: number;
  truncated: boolean;
  impactedCode: Array<{ entityKey: string; identityId: number; path: string[] }>;
  impactedCards: Array<{ cardKey: string; identityId: number; relationType: string; path: string[] }>;
  summary: { totalImpacted: number; codeCount: number; cardCount: number };
}
```

**양방향 BFS 구현 SQL 예시**:

```sql
WITH RECURSIVE
contains_type AS (
  SELECT id FROM relation_type_registry WHERE domain = 'card_relation' AND key = 'contains'
),
depends_type AS (
  SELECT id FROM relation_type_registry WHERE domain = 'card_relation' AND key = 'depends_on'
),
-- Forward: children (contains) + dependents (depends_on에서 역방향)
forward_bfs AS (
  SELECT :card_identity_id::int AS id, 0 AS depth, 'root'::text AS rel_type, ARRAY[:card_identity_id] AS path
  UNION ALL
  SELECT
    CASE
      WHEN cr.relation_type_id = (SELECT id FROM contains_type) THEN cr.dst_identity_id
      WHEN cr.relation_type_id = (SELECT id FROM depends_type) THEN cr.src_identity_id
    END,
    fb.depth + 1,
    rtr.key,
    fb.path || CASE
      WHEN cr.relation_type_id = (SELECT id FROM contains_type) THEN cr.dst_identity_id
      ELSE cr.src_identity_id
    END
  FROM card_relation cr
  JOIN forward_bfs fb ON (
    (cr.src_identity_id = fb.id AND cr.relation_type_id = (SELECT id FROM contains_type))
    OR
    (cr.dst_identity_id = fb.id AND cr.relation_type_id = (SELECT id FROM depends_type))
  )
  JOIN relation_type_registry rtr ON rtr.id = cr.relation_type_id
  WHERE fb.depth < :max_depth
),
-- Reverse: linked code entities
impacted_code AS (
  SELECT cl.code_identity_id, ev.entity_key, fb.path
  FROM forward_bfs fb
  JOIN card_link cl ON cl.card_identity_id = fb.id
    AND cl.project_id = :project_id
  JOIN entity_version ev ON ev.identity_id = cl.code_identity_id AND ev.status = 'active'
)
SELECT * FROM forward_bfs
UNION ALL
SELECT code_identity_id, -1, 'code_link', path FROM impacted_code;
```

#### `card_dashboard` (v4.2 E-2: `card_status`에서 리네임 — `entity_version.card_status` 컬럼과 혼동 방지)

KB 전체 또는 특정 card의 건강 상태.

```typescript
interface CardDashboardResult {
  scope:
    | { level: 'global' }
    | { level: 'project'; projectId: string }
    | { level: 'workspace'; projectId: string; workspaceId: string };
  cards: {
    total: number;
    byStatus: Record<CardStatus, number>;
    byPriority: Record<CardPriority, number>;
  };
  coverage: {
    percent: number;
    byCard: Array<{
      cardKey: string;
      totalChildren: number;
      linkedChildren: number;
      coveragePercent: number;
      weight: number;
    }>;
  };
  links: {
    total: number;
    fresh: number;
    staleCandidate: number;
    staleConfirmed: number;
  };
  recentActivity: {
    approvalEventsLast7d: number;
    lastSyncRun: string | null;
  };
}
```

#### `coverage_map`

특정 card의 subtree coverage를 재귀적으로 계산하여 트리 형태로 반환한다.

```typescript
interface CoverageMapInput {
  projectId: string;
  workspaceId?: string;
  rootCardKey: string;
  maxDepth?: number;
}
```

### 12.3 거버넌스 도구

- `rollback_approval`: compensating action으로 이전 상태 복원 (§8.5 참조)
- `resolve_identity_candidates`: archived version 중 identity 재연결 후보를 제시 (§9.3 참조)
- `apply_identity_rewrite`: 사용자 승인 후 card_link의 code_identity_id를 변경하여 identity 재연결 (§9.3 참조)

### 12.4 도구별 Bulk 지원

```typescript
interface RegisterCardBatchInput {
  cards: RegisterCardInput[];
}
```

> 단일 트랜잭션으로 다수의 card를 일괄 등록. 실패 시 전체 롤백.

### 12.5 기존 도구 변경

기존 18개 도구를 identity + active version JOIN 기반으로 전환.

추가 변경:

#### `search` (card-aware 검색)

```typescript
interface SearchInput {
  projectId: string;
  workspaceId?: string;
  /** 검색어 (FTS 적용) */
  query: string;
  /** 필터 조건 (선택) */
  filters?: {
    entityTypes?: ('card' | 'module' | 'symbol')[];
    cardStatus?: CardStatus[];
    cardPriority?: CardPriority[];
    cardTags?: string[];
    /** true이면 deprecated 제외 (기본: true) */
    excludeDeprecated?: boolean;
  };
  /** 정렬 기준 */
  orderBy?: 'relevance' | 'created_at' | 'card_priority';
  limit?: number;
  offset?: number;
}

interface SearchResult {
  items: Array<{
    identityId: number;
    entityKey: string;
    entityType: string;
    summary: string | null;
    cardStatus?: CardStatus;
    cardPriority?: CardPriority;
    cardTags?: string[];
    /** FTS rank score */
    rank: number;
  }>;
  total: number;
  hasMore: boolean;
}
```

> 내부 구현은 `entity_version.search_tsv`를 사용한 `ts_rank()` 기반 검색. 필터는 WHERE 조건으로 결합.

- `inconsistency_report`: card 고유 검사 추가 (§10.4 stale link, orphan card, **card_key path 불일치** (v4.4 P-7))
  > **card_key path 불일치 검사** (v4.4 P-7): `move_card` 후 card_key path와 실제 parent(card_relation의 contains)가 불일치하는 card를 감지한다. 예: key가 `card::auth/login`인데 실제 parent가 `card::billing`이면 불일치. 경고 수준(blocking 아님)으로 보고한다.
- `find_orphans`: "parent가 없는 non-root card" 검사 추가

### 12.6 Agent Context Retrieval 도구 (소비 도구)

> **핵심 동기**: bunner-kb는 "바이브코딩 RAG 서버"이다. §12.1~12.5의 CRUD/관리 도구만으로는 에이전트가 코딩 시 KB에서 컨텍스트를 꺼내 쓸 수 없다. 이 섹션의 도구들은 에이전트가 **실제 코딩 작업 중** 최소 컨텍스트를 빠르게 얻기 위한 **읽기 전용 소비 도구**이다.

#### `get_context`

특정 파일/코드에 관련된 card, relation, evidence를 일괄 반환한다. 에이전트가 파일을 열 때 자동 호출하는 것을 권장.

```typescript
interface GetContextInput {
  projectId: string;
  workspaceId: string;
  /** 파일 경로 또는 entity_key. 해석 규칙 (v4.2 C-3):
   * - "module:" 또는 "symbol:" prefix → entity_key로 해석
   * - "card::" prefix → card entity_key로 해석 (card의 linked code를 반환)
   * - 그 외 → 파일 경로로 해석. "module:{target}"으로 변환 후 조회
   */
  target: string;
  /** 반환할 정보 범위 (기본: 'full') */
  depth?: 'minimal' | 'standard' | 'full';
}

interface GetContextResult {
  /** 대상 code entity 정보 */
  codeEntity: {
    identityId: number;
    entityKey: string;
    summary: string | null;
    contentHash: string | null;
  } | null;
  /** 연결된 card 목록 (card_link 경유) */
  linkedCards: Array<{
    cardKey: string;
    summary: string;
    cardStatus: CardStatus;
    cardPriority: CardPriority | null;
    rationale: string;
    staleStatus: string;
    /** depth='full'일 때만 포함 */
    body?: string;
    acceptanceCriteria?: AcceptanceCriterion[];
  }>;
  /** 관련 code entities (code_relation 경유) */
  relatedCode: Array<{
    entityKey: string;
    relationType: string;
    direction: 'outgoing' | 'incoming';
  }>;
  /** depth='full'일 때: 연결된 card들의 상위/하위 card */
  cardContext?: Array<{
    cardKey: string;
    parentCardKey: string | null;
    childCardKeys: string[];
    dependsOn: string[];
    dependedBy: string[];
  }>;
}
```

#### `get_implementation_guide`

특정 card를 구현하기 위한 참고 정보(관련 코드, 의존성, 형제 card)를 반환한다.

```typescript
interface GetImplementationGuideInput {
  projectId: string;
  workspaceId: string;
  cardKey: string;
}

interface GetImplementationGuideResult {
  card: {
    cardKey: string;
    summary: string;
    body: string;
    cardStatus: CardStatus;
    cardPriority: CardPriority | null;
    acceptanceCriteria: AcceptanceCriterion[];
  };
  /** 이미 연결된 code entities */
  existingLinks: Array<{
    entityKey: string;
    filePath: string;
    rationale: string;
    staleStatus: string;
  }>;
  /** 의존하는 card들과 그 구현 상태 */
  dependencies: Array<{
    cardKey: string;
    summary: string;
    cardStatus: CardStatus;
    linkedCodeCount: number;
  }>;
  /** 같은 parent 아래 형제 card들 */
  siblings: Array<{
    cardKey: string;
    summary: string;
    cardStatus: CardStatus;
  }>;
  /** parent card 정보 */
  parent: {
    cardKey: string;
    summary: string;
  } | null;
  /** 구현 진행률 */
  coverage: {
    totalChildren: number;
    linkedChildren: number;
    coveragePercent: number;
  };
}
```

#### `get_subgraph`

특정 entity를 중심으로 N-hop 서브그래프를 추출한다. 시각화/탐색용.

```typescript
interface GetSubgraphInput {
  projectId: string;
  workspaceId?: string;
  /** 중심 entity의 identity_id 또는 entity_key */
  center: number | string;
  /** 탐색 깊이 (기본: 2) */
  hops?: number;
  /** 포함할 관계 타입 (기본: 전부) */
  includeRelationTypes?: string[];
  /** card_link도 포함할지 (기본: true) */
  includeCardLinks?: boolean;
}

interface GetSubgraphResult {
  nodes: Array<{
    identityId: number;
    entityKey: string;
    entityType: string;
    summary: string | null;
    cardStatus?: CardStatus;
    cardPriority?: CardPriority;
  }>;
  edges: Array<{
    sourceId: number;
    targetId: number;
    relationType: string;
    table: 'card_link' | 'card_relation' | 'code_relation';
    meta?: Record<string, unknown>;
  }>;
  center: number;
  truncated: boolean;
}
```

> **성능 기준**: `get_context`는 < 50ms, `get_implementation_guide`는 < 100ms, `get_subgraph(hops=2)`는 < 200ms.

### 12.7 에이전트 워크플로우 가이드 (v4.4 P-6, S-3)

에이전트(AI)가 bunner-kb MCP 도구를 **어떤 순서로, 어떤 상황에서** 사용하는지 정의한다. 이 섹션은 `AGENTS.md` 및 `.cursor/rules/`의 MCP 사용 규칙과 연동된다.

#### 핵심 원칙

1. **Read-before-Write**: 코드를 수정하기 전에 반드시 `get_context` 또는 `search`로 관련 card/link 상태를 확인한다
2. **Card-first Flow**: 구현 전에 card가 등록되어 있어야 한다. card 없이 코드만 작성하는 것은 KB 관점에서 "추적 불가능한 구현"이다
3. **Evidence 생성 의무**: 코드를 작성/수정했으면 `link_card`로 card_link + evidence를 생성한다

#### 워크플로우 A: 새 기능 구현

```
1. register_card        — 요구사항 정의 (사용자 지시 또는 에이전트 판단)
2. get_implementation_guide — 구현 가이드 확인 (sibling card, parent, coverage 현황)
3. [코드 작성]           — 에이전트가 코드를 생성/수정
4. link_card            — 작성한 코드를 card에 연결 (evidence 자동 생성)
5. update_card_status   — implementing → implemented (구현 완료 시)
6. coverage_map         — 진행률 확인 (선택)
```

#### 워크플로우 B: 기존 코드 수정

```
1. get_context          — 수정할 파일/코드의 관련 card 확인
2. card_dashboard       — stale link, 전체 현황 파악 (선택)
3. [코드 수정]           — card body를 참고하여 수정
4. link_card            — 수정한 코드의 link 재검증 (stale → fresh)
```

#### 워크플로우 C: 리팩토링 (파일 이동/리네임)

```
1. get_context          — 이동 대상 파일의 card_link 확인
2. [파일 이동/리네임]     — 에이전트가 리팩토링 수행
3. [startupScan/watch]  — Sync Worker가 자동으로 identity matching (계층 1)
4. get_context          — 이동 후 link 보존 확인
5. resolve_identity_candidates — 자동 매칭 실패 시 후보 검토 (계층 2)
```

#### 워크플로우 D: Card 관리 (사용자 주도)

```
1. register_card        — card 등록/수정
2. relate_cards         — card 간 관계 설정 (depends_on, extends 등)
3. update_card_status   — lifecycle 전이 (draft → proposed → accepted → ...)
4. card_impact          — 상태 변경 시 영향 범위 확인 (선택)
```

#### AGENTS.md / .cursor/rules 연동 (v4.4 S-3)

에이전트가 이 워크플로우를 자동으로 따르려면 `AGENTS.md` 또는 `.cursor/rules/mcp-usage.mdc`에 다음이 반영되어야 한다:

| 규칙 | AGENTS.md / rules 반영 내용 |
|------|---------------------------|
| Read-before-Write | "코드 변경 전 `get_context` 호출 필수" |
| Card-first | "새 기능 구현 시 card 등록 여부 확인. 없으면 `register_card` 선행" |
| Evidence 의무 | "코드 작성/수정 후 `link_card` 호출하여 card_link + evidence 생성" |
| Stale 처리 | "card body 수정 후 `card_dashboard`로 stale link 확인, 필요 시 `link_card` 재호출" |
| Workspace 확인 | "MCP 호출 시 현재 branch에 대응하는 workspace_id 사용. archived workspace에 write 금지" |

> **구현 시점**: 이 규칙들은 v4 MCP 도구가 구현된 후 `AGENTS.md`와 `.cursor/rules/mcp-usage.mdc`에 반영한다. 현재 기존 도구와는 다른 도구명/파라미터이므로, v4 도구 구현 완료 시점에 rules를 일괄 업데이트한다.

---

## 13. 에러 및 예외 처리

> v4에서는 card 핵심 속성이 `entity_version.card_*` 컬럼으로 정규화된다. (예: `card_status`, `card_priority`, `card_weight`, `card_tags`)
> 따라서 도구 입력 검증은 (1) 스키마 enum/range 제약, (2) 애플리케이션 레벨 검증을 함께 사용한다.

### 13.1 `register_card` 에러

| 검증 | 규칙 | 에러 메시지 |
|------|------|-------------|
| `cardKey` prefix | `card::` 시작 | "cardKey must start with 'card::'" |
| `cardKey` format | 정규식 검증 | "cardKey must be 'card::{path}' with kebab-case segments" |
| `parentCardKey` | card entity 존재 | "Parent card not found: {key}" |
| 순환 검사 | 자기 자신을 parent로 지정 불가 | "Cannot set self as parent" |
| `status` | 유효한 CardStatus | "Invalid status" |
| `priority` | P0~P3 또는 null | "Invalid priority" |
| `weight` | 0.0 ~ 1.0 | "weight must be between 0.0 and 1.0" |
| `projectId` | 필수 | "projectId is required" |

### 13.2 `link_card` 에러

| 상황 | 처리 |
|------|------|
| code entity active version 없음 | 에러 + search로 유사 entity 추천 |
| card identity 없음 | 에러: "Card not found. Use register_card first." |
| card status = 'deprecated' | 에러: "Cannot link to deprecated card" |
| project/workspace 불일치 | 에러: "Workspace does not belong to project" |
| 이미 동일 link 존재 | upsert: meta 갱신, `link_updated` |

### 13.3 `update_card_status` 에러

| 상황 | 처리 |
|------|------|
| 잘못된 전이 | 에러: "Cannot transition from {from} to {to}" |
| 상한 경고 (v4.2 F-2) | 경고: "Child status exceeds parent status" (전이는 허용, 응답의 `warnings[]`에 포함) |
| verified 전이 시 evidence 미충족 (v4.2 C-1) | 에러: "No active evidence found. Link code to this card first." |
| `projectId` 불일치 | 에러: "Card not found in project" |

### 13.4 `@card` 파싱 에러 (v4.2 C-4)

sync worker의 `@card` 주석 파싱 시 발생하는 에러는 §10.1에 정의. sync를 중단시키지 않으며 `sync_event`에 경고로 기록한다.

### 13.5 기타 에러

identity matching, apply_identity_rewrite, rollback_approval 등의 에러 처리:

---

## 14. 스키마 변경 상세

### 14.1 신규 테이블

| 테이블 | 용도 |
|--------|------|
| `tenant` | 멀티 테넌시 경계 (§2.7) |
| `project` | card 지식의 SSOT 경계 (§2.7) |
| `workspace` | code 인덱싱 단위(= project + branch) (§2.7) |
| `entity_identity` | 불변 정체성 (§3.3) |
| `entity_version` | 가변 주소/상태 (§3.3) |
| `entity_lifecycle` | 생애 이벤트 로그 (§3.3) |
| `approval_event` | 거버넌스 이벤트 (§8.2) |
| `relation_type_registry` | 관계 타입 레지스트리 (§5.1) |
| `card_link` | card↔code 연결 (§5.2) |
| `card_relation` | card↔card 관계 (§5.3) |
| `code_relation` | code↔code 관계 (§5.4) |
| `card_evidence` | 다형성 증거 (§6.1) |

### 14.2 변경 테이블

| 테이블 | 변경 내용 |
|--------|-----------|
| `source` | `entity_id` → `version_id` (FK 대상 변경) |
| `fact` | `entity_id` → `version_id` (FK 대상 변경) |
| `sync_event` | `entity_id` → `identity_id` + `version_id` |

> `source`, `fact`, `fact_type`, `strength_type` DDL은 §3.3에 정의되어 있다. migration 시 FK 대상을 `entity_id` → `version_id`로 변경한다.

#### `sync_event` (v4 DDL)

```sql
CREATE TABLE sync_event (
  id            SERIAL PRIMARY KEY,
  sync_run_id   INTEGER NOT NULL REFERENCES sync_run(id),
  identity_id   INTEGER REFERENCES entity_identity(id) ON DELETE SET NULL,
  version_id    INTEGER REFERENCES entity_version(id) ON DELETE SET NULL,
  action        TEXT NOT NULL CHECK (action IN ('created', 'updated', 'archived', 'deleted', 'matched')),
  entity_key    TEXT,
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sync_event_run_idx ON sync_event(sync_run_id);
CREATE INDEX sync_event_identity_idx ON sync_event(identity_id);
```

### 14.3 제거 테이블

| 테이블 | 시점 |
|--------|------|
| `entity` | migration 완료 후 제거 |
| `relation` | `card_link` + `card_relation` + `code_relation`으로 분리 후 제거 |
| `relation_evidence` | `card_evidence`로 대체 후 제거 |

### 14.4 Seed 데이터

```sql
-- entity_type seed (id 고정 — 다른 DDL에서 id를 직접 참조함) (v4.2 F-4)
INSERT INTO entity_type (id, name) VALUES
  (1, 'module'),
  (2, 'symbol'),
  (3, 'card')
ON CONFLICT (id) DO NOTHING;
SELECT setval('entity_type_id_seq', (SELECT MAX(id) FROM entity_type));

-- relation_type_registry seed (id 고정 — partial unique index가 id=1을 참조함) (v4.2 F-4)
INSERT INTO relation_type_registry (id, domain, key, description, is_system) VALUES
  -- card_relation types
  (1, 'card_relation', 'contains',   'parent → child (nested tree edge)', true),
  (2, 'card_relation', 'depends_on', 'A depends on B (DAG)', true),
  (3, 'card_relation', 'extends',    'A extends B (cycle allowed)', true),
  -- code_relation types (v4.2 E-3: 'implements'는 code↔code 인터페이스 구현 관계.
  --   v1의 spec↔code 'implements' relation과 다름 — v1의 것은 card_link로 migration됨. §15.3 참조)
  (4, 'code_relation', 'imports',    'module import', true),
  (5, 'code_relation', 'extends',    'class/interface inheritance', true),
  (6, 'code_relation', 'calls',      'function call', true),
  (7, 'code_relation', 'implements', 'interface implementation (code↔code only)', true)
ON CONFLICT (id) DO NOTHING;
SELECT setval('relation_type_registry_id_seq', (SELECT MAX(id) FROM relation_type_registry));

-- fact_type seed (id 고정)
INSERT INTO fact_type (id, name) VALUES
  (1, 'module_info'),
  (2, 'symbol_info'),
  (3, 'card_body')
ON CONFLICT (id) DO NOTHING;
SELECT setval('fact_type_id_seq', (SELECT MAX(id) FROM fact_type));

-- strength_type seed (id 고정)
INSERT INTO strength_type (id, name) VALUES
  (1, 'inferred'),
  (2, 'manual'),
  (3, 'derived')
ON CONFLICT (id) DO NOTHING;
SELECT setval('strength_type_id_seq', (SELECT MAX(id) FROM strength_type));

-- system user seed (v4.3 B-1) — migration, sync 등 시스템 작업용
INSERT INTO "user" (id, email) VALUES
  ('migration', 'system+migration@bunner.local'),
  ('system',    'system@bunner.local')
ON CONFLICT (id) DO NOTHING;
```

> 이전에 사용하던 `spec`, `claim` entity_type은 migration 완료 후 제거.
> 사용자 정의 관계 타입은 `is_system = false`로 추가한다.
> **(v4.2 F-4)**: seed id를 고정하여 partial unique index (`card_relation_single_parent WHERE relation_type_id = 1`) 등에서 안전하게 참조 가능. `setval`로 시퀀스 동기화.
> **(v4.3 B-1)**: `migration` user는 migration 시 card_link.created_by에 사용. `system` user는 MCP config에 user_id가 설정되지 않은 경우의 fallback (권장하지 않음).

### 14.5 성능 베이스라인

주요 쿼리의 성능 기준:

| 쿼리 | 목표 응답 시간 | 비고 |
|------|--------------|------|
| `resolveIdentity` (stable_key) | < 5ms | `project_id + stable_key` partial unique index |
| `resolveIdentity` (entity_key) | < 10ms | scope별 active unique index (project/workspace) |
| card_link stale 목록 | < 50ms | partial index on stale_status |
| coverage_map (depth 5) | < 200ms | recursive CTE + index |
| card_impact (depth 3) | < 100ms | BFS + index |

### 14.6 FTS 의존성 (v4.2 D-6 기본 전략 확정)

**기본 전략: `pg_bigm` (확정)**

바이브코딩에서 card body를 한국어로 작성하는 것이 자연스러우므로, 한국어 FTS는 **v4 scope에서 필수**이다. PostgreSQL 내장 `'simple'` config는 공백 기준 토크나이징만 하므로 한국어에서는 사실상 무용하다.

| 옵션 | 설치 | 한국어 | 선택 |
|------|------|--------|------|
| `pg_bigm` | Docker extension 1줄 | bigram 기반. 2자 이상 매칭 | ✅ **v4 기본** |
| `pgroonga` | 별도 Groonga 설치 | 정확도 높음 | v3.1 옵션 |
| 내장 `simple` | 없음 | 공백 기준만 | ❌ 한국어 불가 |

> `docker-compose.yml`에 `pg_bigm` extension 설치를 포함한다. `pgroonga`는 v3.1에서 정확도가 필요할 때 전환 검토.

### 14.7 검색(FTS) / 벡터(pgvector) 준비

v4는 **VIEW/TABLE을 추가로 만들지 않고**, SSOT 테이블(`entity_version`)에 검색/벡터용 컬럼을 두는 방식으로 "Graph Read Model(조회 가능한 데이터 형태)"을 제공한다.

#### FTS (PostgreSQL 내장)

```sql
-- pg_bigm 기반 FTS (v4.2 D-6)
-- pg_bigm은 LIKE '%query%'를 GIN 인덱스로 가속한다
CREATE INDEX entity_version_search_bigm_entity_key_idx
  ON entity_version USING gin (entity_key gin_bigm_ops)
  WHERE status = 'active';

CREATE INDEX entity_version_search_bigm_summary_idx
  ON entity_version USING gin (summary gin_bigm_ops)
  WHERE status = 'active' AND summary IS NOT NULL;

CREATE INDEX entity_version_search_bigm_card_body_idx
  ON entity_version USING gin (card_body gin_bigm_ops)
  WHERE status = 'active' AND card_body IS NOT NULL;
```

> **검색 쿼리 패턴**: `WHERE entity_key LIKE '%검색어%' OR summary LIKE '%검색어%' OR card_body LIKE '%검색어%'`. pg_bigm이 GIN 인덱스로 가속.
>
> **fallback**: pg_bigm이 설치되지 않은 환경에서는 PostgreSQL 내장 `to_tsvector('simple', ...)`로 fallback한다. 이 경우 한국어 토크나이징 품질이 떨어짐.
>
> SSOT는 `entity_version` 그대로 유지한다.

#### Vector (pgvector 훅)

```sql
-- 차원(dimension)은 모델/임베딩 정책에 따라 결정
-- ALTER TABLE entity_version ADD COLUMN embedding vector(<dim>);
-- CREATE INDEX entity_version_embedding_hnsw_idx ON entity_version USING hnsw (embedding vector_cosine_ops);
```

---

## 15. Migration Path (현재 → v4)

### 15.1 전략

현재 스키마에서 v4로 직접 migration.

| Phase | 내용 |
|-------|------|
| 1 | 신규 테이블 생성 (`"user"` 포함, workspace에 `status`/`updated_at` 추가) (v4.3) |
| 2 | entity → entity_identity + entity_version 데이터 복사 (INSERT...RETURNING 방식) |
| 3 | relation → card_link + card_relation + code_relation 분리 |
| 4 | source/fact FK 전환 |
| 5 | 레거시 테이블 제거 |

### 15.2 Phase 2: Entity 매핑

> `INSERT...RETURNING`으로 안전한 1:1 매핑 (ROW_NUMBER 매칭의 불안정성 방지).

```sql
-- (v4.2 A-4) 매핑 임시 테이블 생성 (v4.1에서 누락)
CREATE TEMP TABLE entity_to_identity_map (
  entity_id   INTEGER NOT NULL,
  identity_id INTEGER NOT NULL,
  entity_key  TEXT NOT NULL,
  workspace_id TEXT,
  PRIMARY KEY (entity_id)
);

-- PL/pgSQL 루프로 안전한 1:1 매핑 (v4.2 A-4: CTE JOIN의 비유니크 매칭 문제 해결)
DO $$
DECLARE
  rec RECORD;
  new_identity_id INTEGER;
  card_type_id SMALLINT;
BEGIN
  SELECT id INTO card_type_id FROM entity_type WHERE name = 'card';

  FOR rec IN
    SELECT e.id AS entity_id, e.entity_key, e.workspace_id, e.created_at,
           et.name AS type_name, et.id AS type_id,
           w.project_id
    FROM entity e
    JOIN entity_type et ON et.id = e.entity_type_id
    JOIN workspace w ON w.id = e.workspace_id
    ORDER BY e.id
  LOOP
    INSERT INTO entity_identity (
      project_id, workspace_id, entity_type_id, stable_key, created_at
    ) VALUES (
      rec.project_id,
      CASE WHEN rec.type_name IN ('spec', 'claim') THEN NULL ELSE rec.workspace_id END,
      CASE WHEN rec.type_name IN ('spec', 'claim') THEN card_type_id ELSE rec.type_id END,
      CASE
        WHEN rec.type_name = 'spec' THEN REPLACE(rec.entity_key, 'spec::', 'card::')
        WHEN rec.type_name = 'claim' THEN REPLACE(rec.entity_key, 'claim::', 'card::')
        ELSE NULL
      END,
      rec.created_at
    ) RETURNING id INTO new_identity_id;

    INSERT INTO entity_to_identity_map (entity_id, identity_id, entity_key, workspace_id)
    VALUES (rec.entity_id, new_identity_id, rec.entity_key, rec.workspace_id);
  END LOOP;
END $$;
```

> **검증**: entity 수 == identity 수 == map 수. 불일치 시 즉시 중단.
> **(v4.2 A-4)**: v4.1의 CTE + JOIN 방식은 `workspace_id + created_at` 비유니크 조인으로 중복 매칭 가능했다. PL/pgSQL 루프로 변경하여 각 entity에 대해 INSERT → RETURNING으로 정확한 1:1 매핑을 보장한다.

### 15.3 Phase 3: relation 분리

v1의 `relation` 테이블을 v4의 3종 테이블로 분리한다.

#### Step 1: 기존 relation_type → v4 registry 매핑

```sql
-- 기존 relation_type 테이블의 name을 v4 registry로 매핑
-- 매핑 임시 테이블 생성
CREATE TEMP TABLE relation_type_map AS
SELECT
  v1rt.id AS v1_type_id,
  v1rt.name AS v1_name,
  v4rtr.id AS v4_registry_id,
  v4rtr.domain AS v4_domain
FROM relation_type v1rt  -- 기존 테이블
JOIN relation_type_registry v4rtr ON (
  -- 기존 name → v4 (domain, key) 매핑
  -- (v4.2 E-3) 기존 'implements'는 spec↔code 관계였으므로 v4의 card_link로 migration된다 (아래 Step 2a).
  -- 여기서는 card_relation.contains로 매핑하지 않음. v1에 spec 간 관계가 있었다면 별도 처리 필요.
  (v1rt.name = 'implements' AND v4rtr.domain = 'card_relation' AND v4rtr.key = 'contains')
  OR (v1rt.name = 'imports' AND v4rtr.domain = 'code_relation' AND v4rtr.key = 'imports')
  OR (v1rt.name = 'extends' AND v4rtr.domain = 'code_relation' AND v4rtr.key = 'extends')
  OR (v1rt.name = 'calls' AND v4rtr.domain = 'code_relation' AND v4rtr.key = 'calls')
  -- 추가 기존 type이 있으면 여기에 매핑 추가
);

-- 매핑 검증: v1의 모든 relation_type이 매핑되었는지 확인
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM relation_type v1rt
    WHERE NOT EXISTS (SELECT 1 FROM relation_type_map rtm WHERE rtm.v1_type_id = v1rt.id)
  ) THEN
    RAISE EXCEPTION 'Unmapped relation types exist. Migration aborted.';
  END IF;
END $$;
```

#### Step 2: relation → card_link / card_relation / code_relation 분리

```sql
-- (a) spec/claim 관련 relation → card_link
-- v1에서 strength='manual'이고 한쪽이 spec/claim, 다른 쪽이 code인 경우
INSERT INTO card_link (
  project_id, workspace_id,
  card_identity_id, code_identity_id,
  anchor, rationale, weight, created_by, stale_status,
  created_at, updated_at
)
SELECT
  p.id,
  w.id,
  m_card.identity_id,
  m_code.identity_id,
  '{}'::jsonb,  -- anchor는 v1에 없으므로 빈 객체
  'Migrated from relation #' || r.id,
  1.0,
  'migration',  -- v4.3: migration 전용 user (seed에서 미리 생성)
  'fresh',
  r.created_at,
  r.created_at
FROM relation r
JOIN entity_to_identity_map m_card ON m_card.entity_id = r.src_entity_id
JOIN entity_to_identity_map m_code ON m_code.entity_id = r.dst_entity_id
JOIN entity e_src ON e_src.id = r.src_entity_id
JOIN entity_type et_src ON et_src.id = e_src.entity_type_id
JOIN workspace w ON w.id = e_src.workspace_id
JOIN project p ON p.id = w.project_id
WHERE et_src.name IN ('spec', 'claim')
ON CONFLICT (card_identity_id, code_identity_id) DO NOTHING;

-- (b) code↔code relation → code_relation
INSERT INTO code_relation (
  workspace_id,
  src_identity_id, dst_identity_id,
  relation_type_id, strength, source_file,
  created_at
)
SELECT
  e_src.workspace_id,
  m_src.identity_id,
  m_dst.identity_id,
  rtm.v4_registry_id,
  r.strength,
  NULL,
  r.created_at
FROM relation r
JOIN relation_type_map rtm ON rtm.v1_type_id = r.relation_type_id
  AND rtm.v4_domain = 'code_relation'
JOIN entity_to_identity_map m_src ON m_src.entity_id = r.src_entity_id
JOIN entity_to_identity_map m_dst ON m_dst.entity_id = r.dst_entity_id
JOIN entity e_src ON e_src.id = r.src_entity_id
ON CONFLICT (src_identity_id, dst_identity_id, relation_type_id) DO NOTHING;
```

> **검증**: `COUNT(relation)` == `COUNT(card_link migrated)` + `COUNT(code_relation migrated)`. 불일치 시 중단.

### 15.4 롤백 계획

각 phase를 개별 트랜잭션으로 실행. phase 간 검증 체크포인트.

### 15.5 Dual-Write / Dual-Read

`BUNNER_V4_ENABLED` feature flag로 현재 → v4 점진적 전환.

---

## 16. 구현 순서

### 16.1 단계별 작업

| 단계 | 작업 | 의존성 | 위험도 |
|------|------|--------|--------|
| **0** | Preflight: 회귀 테스트 베이스라인 확보 | 없음 | 낮 |
| **1** | v4 스키마 생성 (identity, version, lifecycle, approval_event, relation_type_registry, card_link, card_relation, code_relation, card_evidence) | 없음 | 낮 |
| **2** | Migration 스크립트 (INSERT...RETURNING + relation 분리) + 검증 | 1 | **높** |
| **3** | Repo 계층 분리 (identity-repo, version-repo, card-link-repo, card-relation-repo) | 2 | 높 |
| **3b** | Dual-read adapter | 3 | 중 |
| **4** | Card 도구 구현 (register_card, link_card, unlink_card, move_card, update_card_status, relate_cards, unrelate_cards) | 3b | 중 |
| **5** | 거버넌스 도구 (rollback_approval + payload 검증) | 4 | 중 |
| **6** | 분석 도구 (card_impact, card_dashboard, coverage_map) | 4 | 중 |
| **6b** | Agent Context 도구 (get_context, get_implementation_guide, get_subgraph) | 4 | 중 |
| **7** | Sync worker 재작성 (version append + @card 파싱 + stale detection) | 3b | **높** |
| **8** | Purge 재작성 (lifecycle FK 처리 + COALESCE identity purge) | 7 | 높 |
| **9** | Identity resolution (resolve_identity_candidates + apply_identity_rewrite) | 4 | 중 |
| **10** | 기존 18개 도구 쿼리 전환 | 3b | 높 |
| **11** | 호환성 모드 종료 + 레거시 제거 | 10 완료 + 검증 | **높** |

### 16.2 호환성 모드

`BUNNER_V4_ENABLED` feature flag로 점진적 전환. flag가 off이면 기존 도구/쿼리를 사용하고, on이면 v4 도구/쿼리로 전환한다.

---

## 17. 미래 확장 경로

### 17.1 코드 내 @card 주석 태그

`/** @card card::auth/login */` 파서 인식 → 자동 `card_link` 생성. `evidence_type: 'annotation'`.

### 17.2 Card → Code Glob Pattern (v3.1)

card.meta에 `implementsPattern: "src/auth/**"` → 자동 매칭.

### 17.3 Test Evidence 자동 수집 (v3.1)

CI 결과 연동. `evidence_type: 'test_pass'` 자동 생성.

### 17.4 AI Verification (v3.1)

LLM이 code↔card 일치 여부를 검증. `evidence_type: 'ai_verification'`.

### 17.5 Tree Snapshot / Baseline (v3.1)

특정 시점의 card tree + coverage 상태를 snapshot으로 저장. 시간대별 추이 그래프.

### 17.6 Advisory Lock (v3.1)

`pg_advisory_xact_lock(identity_id)`로 identity 단위 잠금. §9.4의 SERIALIZABLE 방어를 세밀한 잠금으로 대체하여 동시성을 개선한다.

### 17.7 `.card.md` 파서 (v3.1)

`.card.md` 파일을 sync 파서가 인식하여 card를 자동 등록.

### 17.8 approval_event Archive Policy (v3.1)

오래된 approval_event를 별도 archive 테이블로 이관하여 메인 테이블 성능을 유지한다. 이관 기준: `created_at < now() - {archiveDays} * interval '1 day'`.

### 17.9 Weighted Scoring for Identity Candidates (v3.1)

identity resolution 시 content_hash 외에 `symbolName` 유사도, `summary` 유사도 등 가중 점수를 부여하여 후보 순위를 정밀화한다.

### 17.10 Cross-project Card Sharing (v3.2)

공통 card를 여러 project에서 참조. 최소 인터페이스 설계 방향:

```typescript
// v3.2 인터페이스 초안 — v4에서는 구현하지 않으나, 스키마 확장 시 깨지지 않도록 방향을 미리 정의
interface SharedCardRef {
  /** 원본 card의 project */
  sourceProjectId: string;
  /** 원본 card identity */
  sourceCardIdentityId: number;
  /** 참조하는 project */
  targetProjectId: string;
  /** 참조 유형: 'mirror' (읽기 전용 복사) | 'alias' (원본 직접 참조) */
  refType: 'mirror' | 'alias';
}
```

> **v4 scope 제약**: `card_relation`/`card_link`는 `project_id` 단일 스코프이므로, cross-project 참조 시 별도 `shared_card_ref` 테이블이 필요하다. v4에서는 이 테이블을 생성하지 않지만, `entity_identity.project_id`를 FK로 유지하여 향후 확장 시 스키마 변경을 최소화한다.

### 17.11 Access Control / Ownership (v3.2)

card owner/reviewer 지정.

### 17.12 지식 품질 스코어링 / Decay (v3.1)

card와 link의 품질을 시간 기반으로 평가하고, 오래된/미검증 지식의 신뢰도를 자동 감소:

| 지표 | 계산 방식 | 용도 |
|------|----------|------|
| freshness | `1.0 - (now - verified_at) / decay_window` | stale link 우선순위 |
| evidence_quality | `Σ(evidence_weight × is_active)` | card 신뢰도 |
| coverage_quality | `coverage × avg(link_freshness)` | 실질적 구현 진행률 |

> 스키마 훅: `card_link.verified_at`, `card_evidence.is_active`가 이미 존재하므로 추가 컬럼 불필요. 계산은 쿼리 타임에 수행.

### 17.13 시간축 쿼리 (Temporal Query) (v3.1)

"2주 전 coverage는?", "이 card의 status 변화 추이" 같은 시간 기반 질문을 지원:

- **방법 1**: `entity_lifecycle` + `approval_event`의 `created_at`을 기반으로 특정 시점의 상태를 재구성
- **방법 2**: Tree Snapshot (§17.5)과 결합하여 시점별 스냅샷 비교
- 스키마 훅: `entity_version.created_at`, `approval_event.created_at`이 이미 타임스탬프를 보유

### 17.14 이벤트 스트림 (Webhook / Push) (v3.2)

KB 변경 사항을 외부 시스템에 push:

| 이벤트 | 대상 |
|--------|------|
| `card_link.stale_status` 변경 | IDE 알림, Slack |
| card status 전이 | 프로젝트 대시보드 |
| coverage 임계치 도달 | CI/CD 파이프라인 |

> 스키마 훅: `approval_event`가 모든 상태 변이의 SSOT이므로, approval_event INSERT 트리거로 이벤트 스트림 구현 가능.

### 17.15 Export / Import (포터빌리티) (v3.2)

프로젝트 KB를 이식 가능한 형태로 내보내기/가져오기:

```typescript
interface KBExportFormat {
  version: 'v4';
  project: { id: string; name: string };
  cards: Array<{ cardKey: string; body: string; status: CardStatus; /* ... */ }>;
  cardRelations: Array<{ src: string; dst: string; type: string }>;
  cardLinks: Array<{ cardKey: string; codeEntityKey: string; rationale: string; /* ... */ }>;
  evidence: Array<{ cardLinkKey: string; type: string; snapshot: unknown }>;
}
```

### 17.16 학습 데이터 추출 파이프라인 (v3.2)

KB에 축적된 지식(card ↔ code 매핑, evidence, approval 패턴)을 에이전트 학습 데이터로 추출:

- card body + linked code → fine-tuning 데이터셋
- approval_event 패턴 → 에이전트 의사결정 개선
- stale → fresh 전환 이력 → link 품질 예측 모델

> 스키마 훅: 모든 데이터가 PostgreSQL에 정규화되어 있으므로 SQL 기반 ETL로 추출 가능.

### 17.17 자연어 쿼리 인터페이스 (v3.2)

에이전트 또는 사용자가 자연어로 KB에 질문:

```typescript
interface NaturalLanguageQueryInput {
  projectId: string;
  question: string;  // "auth 모듈의 미구현 card는?"
}
```

> 구현 경로: pgvector 임베딩(§14.7) + LLM SQL 생성 또는 entity_version.search_tsv FTS + 후처리.

---

## 부록 A: 용어 정의

| 용어 | 정의 |
|------|------|
| **tenant** | 배포/조직 경계. 여러 project를 묶는 최상위 스코프 (§2.7) |
| **project** | card 지식의 SSOT 경계. card/card_relation/approval_event의 기본 스코프 (§2.7) |
| **workspace** | code 인덱싱 단위(= project + branch). code/code_relation의 스코프. append-only — 삭제하지 않고 archive (§2.7, §11.4) |
| **user** | 행위자 식별 테이블. `"user"` (PG 예약어). 모든 write 작업의 actor_id가 참조 (§2.7) |
| **card** | 1급 지식 객체. 요구사항·기능 명세를 표현하는 nested tree의 노드. 단일 entity_type으로 무제한 depth의 tree를 구성 |
| **entity_identity** | entity의 전 생애 불변 정체성. card_link/code_relation이 참조하는 대상 |
| **entity_version** | entity의 특정 시점 상태 (주소, 내용, 메타). 가변 |
| **entity_key** | entity_version에 저장되는 현재 주소. 형식: `{type}:{identifier}` |
| **stable_key** | card entity의 불변 식별자. `card::{path}` 형식 |
| **identity matching** | content_hash를 이용해 기존 identity에 새 version을 연결하는 과정 |
| **approval_event** | 수동/반자동 상태 전이를 기록하는 1급 이벤트. 거버넌스의 단일 진실 소스 |
| **entity_lifecycle** | identity의 생애 이벤트 로그 |
| **card_link** | card↔code 구현 관계. anchor, rationale, stale_status 포함 |
| **relation_type_registry** | 관계 타입의 (domain, key) 레지스트리. `*_relation.relation_type_id`가 참조 |
| **card_relation** | card↔card 관계(contains/depends_on/extends 등). project scope |
| **code_relation** | code↔code 정적 분석 관계(imports/extends/calls 등). workspace scope |
| **card_evidence** | card_link의 이행 증거. 다형성 (code_link, test_pass, annotation, manual_review, ai_verification) |
| **coverage** | card subtree의 구현 진행률. 재귀 가중 집계 |
| **stale link** | card body 갱신 후 재검증되지 않은 기존 link |
| **CardStatus** | card lifecycle 상태: draft, proposed, accepted, implementing, implemented, verified, deprecated |
| **CardPriority** | card 우선순위: P0(blocker), P1(critical), P2(major), P3(minor) |
| **structural versioning** | card tree 구조 변경(reparent)의 이력 관리 |
| **composite coverage** | weight 가중치를 적용한 재귀 coverage 집계 |

## 부록 B: 관련 파일 목록

| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `tooling/mcp/drizzle/schema.ts` | **재작성** | entity_identity, entity_version, entity_lifecycle, approval_event, card_link, card_relation, code_relation, card_evidence 추가. entity, relation, relation_evidence 제거 |
| `tooling/mcp/src/server.ts` | 수정 | 신규 도구 등록 |
| `tooling/mcp/src/tools/card.ts` | **신규** | register_card, link_card, unlink_card, move_card, update_card_status, relate_cards, unrelate_cards |
| `tooling/mcp/src/tools/identity.ts` | **신규** | resolve_identity_candidates, apply_identity_rewrite |
| `tooling/mcp/src/tools/governance.ts` | **신규** | rollback_approval |
| `tooling/mcp/src/tools/dashboard.ts` | **신규** | card_impact, card_dashboard, coverage_map |
| `tooling/mcp/src/repo/identity-repo.ts` | **신규** | entity_identity CRUD |
| `tooling/mcp/src/repo/version-repo.ts` | **신규** | entity_version CRUD + status 전이 |
| `tooling/mcp/src/repo/card-link-repo.ts` | **신규** | card_link CRUD + stale 관리 |
| `tooling/mcp/src/repo/card-relation-repo.ts` | **신규** | card_relation CRUD + cycle 검사 |
| `tooling/mcp/src/repo/code-relation-repo.ts` | **신규** | code_relation CRUD + orphan cleanup |
| `tooling/mcp/src/repo/card-evidence-repo.ts` | **신규** | card_evidence CRUD |
| `tooling/mcp/src/repo/approval-repo.ts` | **신규** | approval_event 기록/조회 + payload 검증 |
| `tooling/mcp/src/repo/lifecycle-repo.ts` | **신규** | entity_lifecycle 기록/조회 |
| `tooling/mcp/src/repo/tenant-repo.ts` | **신규** | tenant CRUD |
| `tooling/mcp/src/repo/project-repo.ts` | **신규** | project CRUD |
| `tooling/mcp/src/repo/workspace-repo.ts` | **신규** | workspace CRUD + archive (v4.3: 삭제 없음, archive만) |
| `tooling/mcp/src/repo/user-repo.ts` | **신규** | `"user"` CRUD (v4.3 B-1) |
| `tooling/mcp/src/tools/context.ts` | **신규** | get_context, get_implementation_guide, get_subgraph (§12.6) |
| `tooling/mcp/src/repo/entity-repo.ts` | **제거** | identity-repo + version-repo로 대체 |
| `tooling/mcp/src/repo/relation-repo.ts` | **제거** | card-link-repo + card-relation-repo + code-relation-repo로 대체 |
| `tooling/mcp/src/sync-worker.ts` | **재작성** | version append + @card 파싱 + stale detection |
| `tooling/mcp/src/kb.ts` | 수정 | SyncAction 확장, 새 repo 래퍼 |
| `tooling/mcp/src/repo/sync-event-repo.ts` | 수정 | FK 변경 |
| `tooling/mcp/src/repo/source-repo.ts` | 수정 | FK를 version 참조로 변경 |
| `tooling/mcp/src/repo/fact-repo.ts` | 수정 | FK를 version 참조로 변경 |
| `tooling/mcp/src/read-through.ts` | 수정 | `__manual__/` 예외 + version 기준 |
| `tooling/mcp/drizzle/migrations/` | **신규** | migration SQL |

## 부록 C: 테스트 매트릭스

### C.1 Identity Matching (계층 1)

| # | 시나리오 | 선행 상태 | 수행 | 기대 결과 |
|---|----------|-----------|------|-----------|
| T1-1 | 단순 파일 이동 | `a.ts`에 identity+version+card_link 존재 | `mv a.ts b.ts` → startupScan | 기존 version archived, 같은 identity에 새 version active. card_link 불변 |
| T1-2 | 이동+내용변경 | `a.ts`에 link 존재 | `mv a.ts b.ts` + 내용 수정 | hash 불일치 → 새 identity 생성. link 파손 (계층 2) |
| T1-3 | 파일 복사 (1:N) | `a.ts` 존재 | `cp a.ts b.ts` + `rm a.ts` | 1:N 자동 매칭 금지. 기존 archived, b.ts 새 identity |
| T1-4 | N:1 통합 | `a.ts`, `b.ts` 같은 hash | 둘 다 삭제 + `c.ts` 생성 | N:1 자동 매칭 금지 |
| T1-5 | Watch DELETE→CREATE | `a.ts`에 link 존재 | DELETE(a.ts) → CREATE(b.ts) | content_hash 매칭 → 같은 identity에 새 version |
| T1-6 | Watch 역순 CREATE→DELETE | `a.ts` 존재 | CREATE(b.ts) → DELETE(a.ts) | Post-DELETE merge → 자동 병합 |
| T1-7 | Symbol-level cascade | `a.ts`에 symbol 3개 + link | `mv a.ts b.ts` | module identity match → symbol들도 자동 version 추가 |

### C.2 Card 도구

| # | 시나리오 | 수행 | 기대 결과 |
|---|----------|------|-----------|
| T2-1 | root card 등록 | `register_card({projectId, cardKey: "card::auth"})` | identity 생성, version active, source `__manual__/card/card::auth` |
| T2-2 | child card 등록 | `register_card({projectId, cardKey: "card::auth/login", parentCardKey: "card::auth"})` | identity 생성, contains relation 자동 생성 |
| T2-3 | nested card 등록 | `register_card({projectId, cardKey: "card::auth/login/oauth", parentCardKey: "card::auth/login"})` | 3레벨 depth 정상 |
| T2-4 | card 갱신 | body 변경하여 재호출 | 기존 version archived, 새 version active, `card_updated` |
| T2-5 | card 동일 내용 | 같은 body로 재호출 | `unchanged` |
| T2-6 | link 생성 | `link_card({projectId, workspaceId, cardKey, codeEntityKey, rationale})` | card_link 생성, card_evidence 생성, `link_created` |
| T2-7 | link 중복 | 같은 pair 재호출 | upsert, `link_updated` |
| T2-8 | unlink | `unlink_card({projectId, workspaceId, cardKey, codeEntityKey, reason})` | card_link 삭제, `link_removed` |
| T2-9 | move_card | parent 변경 | 기존 contains 삭제, 새 contains 생성, `card_reparented` |
| T2-10 | move_card 순환 | child를 parent로 이동 시도 | 에러: "Circular reference" |

### C.3 Card Lifecycle

| # | 시나리오 | 수행 | 기대 결과 |
|---|----------|------|-----------|
| T3-1 | draft → proposed | `update_card_status` | status 변경, `card_status_changed` |
| T3-2 | 잘못된 전이 | draft → verified | 에러: "Cannot transition" |
| T3-3 | deprecated 전파 | parent deprecated | 모든 children도 deprecated. child별 개별 event 생성. card_link stale_confirmed |
| T3-4 | 상한 경고 (v4.2) | parent=accepted, child=verified 시도 | 전이 허용 + `warnings: ["Child status exceeds parent status"]` |
| T3-5 | verified evidence 미충족 (v4.2) | evidence 없는 card에 verified 시도 | 에러: "No active evidence found" |

### C.4 거버넌스

| # | 시나리오 | 수행 | 기대 결과 |
|---|----------|------|-----------|
| T4-1 | link 롤백 | link_card → rollback | card_link 삭제, `link_rollback` |
| T4-2 | status 롤백 | update_card_status → rollback | 이전 status 복원 + children 복원 |
| T4-3 | 이미 롤백된 이벤트 | 재롤백 시도 | 에러: "Already rolled back" |

### C.5 Purge

| # | 시나리오 | 수행 | 기대 결과 |
|---|----------|------|-----------|
| T5-1 | version purge | archived + TTL 경과 | version 삭제. lifecycle FK → NULL. evidence snapshot 보존 |
| T5-2 | identity purge | 모든 version 없음 + TTL | identity 삭제 → card_link/code_relation cascade |
| T5-3 | card_link 보호 | card_link 존재 + version 없음 | identity 삭제 안 됨 |
| T5-4 | lifecycle 없는 identity purge | lifecycle 기록 없음 + TTL | COALESCE fallback으로 created_at 기준 purge |

### C.6 Coverage

| # | 시나리오 | 수행 | 기대 결과 |
|---|----------|------|-----------|
| T6-1 | flat coverage | card에 child 3개, 2개 linked | 66.7% |
| T6-2 | weighted coverage | weight 0.5, 1.0, 1.0 → 2개 linked (weight 1.0) | 80% |
| T6-3 | nested coverage | 2 depth, leaf 일부 linked | 재귀 가중 집계 |
| T6-4 | tag 횡단 집계 | #auth 태그 card 5개 중 3개 linked | 60% |

### C.7 Evidence

| # | 시나리오 | 수행 | 기대 결과 |
|---|----------|------|-----------|
| T7-1 | code_link evidence | link_card 후 | evidence(type=code_link, is_active=true) |
| T7-2 | annotation evidence | @card 주석 감지 | evidence(type=annotation, is_active=true) |
| T7-3 | annotation 제거 | @card 주석 삭제 후 sync | is_active=false |
| T7-4 | evidence snapshot | version purge 후 | snapshot 보존, fact_id=NULL |

### C.8 Stale Detection

| # | 시나리오 | 수행 | 기대 결과 |
|---|----------|------|-----------|
| T8-1 | card 갱신 후 기존 link | register_card(body 변경) | stale_status = 'stale_candidate' |
| T8-2 | anchor 불일치 확인 | inconsistency_report | stale_status = 'stale_confirmed' |
| T8-3 | 재검증 | link_card 재호출 | stale_status = 'fresh', verified_at 갱신 |

### C.9 멀티 브랜치 시나리오

| # | 시나리오 | 수행 | 기대 결과 |
|---|----------|------|-----------|
| T9-1 | 같은 파일 다른 브랜치 | branch-a, branch-b에서 같은 파일 수정 | 각 workspace에 독립 version. card_link는 project scope이므로 공유 |
| T9-2 | 브랜치 전환 후 sync | branch-a → branch-b 전환 후 startupScan | branch-b의 workspace에 새 version. branch-a 데이터 불변 |
| T9-3 | 브랜치 삭제 | workspace archived (v4.3 A-4) | workspace.status='archived', code entity version archived, card_link stale_confirmed. card는 project scope이므로 불변. workspace 레코드는 삭제하지 않음 |
| T9-5 | 브랜치 재생성 (v4.3 A-3) | 삭제했던 branch-a를 다시 생성 | 새 workspace 생성 (old workspace는 archived 상태로 보존). 새 workspace는 깨끗한 상태에서 startupScan. old 데이터 혼재 없음 |
| T9-6 | 머지 후 main link (v4.3 F-1) | branch-a에서 card_link 후 main 머지 | main sync 시 @card annotation 기반 link는 자동 재생성. 수동 link는 main에서 재연결 필요 |
| T9-4 | 동일 card 다른 브랜치 link | card::auth를 branch-a의 code와 branch-b의 code에 각각 link | card_link 2건 (workspace_id 다름). card identity는 1건 |

### C.10 E2E 통합 테스트

| # | 시나리오 | 전체 흐름 | 기대 결과 |
|---|----------|-----------|-----------|
| T10-1 | Full lifecycle | `register_card` → `link_card` → 파일 이동 → `startupScan` → identity matching → `coverage_map` | coverage 유지. card_link 불변. identity matching 자동 |
| T10-2 | Stale → re-verify | `register_card` → `link_card` → `register_card`(body 변경) → stale detection → `link_card`(재호출) | stale_candidate → fresh. verified_at 갱신 |
| T10-3 | Deprecated cascade | `register_card`(parent) → `register_card`(child) → `link_card`(child) → `update_card_status`(parent=deprecated) | parent+child deprecated. card_link는 유지되나 stale 마킹 |
| T10-4 | Rollback chain | `link_card` → `rollback_approval` → `register_card`(재연결) | 원래 link 삭제 → 새 link 생성. provenance chain 완전 |
| T10-5 | Multi-project isolation | project-a에 card 등록 → project-b에서 검색 | project-b에서 검색 결과 0건. 격리 확인 |

### C.11 에이전트 워크플로우 시나리오 (v4.2 F-1)

바이브코딩에서 에이전트의 실제 사용 흐름을 검증하는 시나리오:

| # | 시나리오 | 전체 흐름 | 기대 결과 |
|---|----------|-----------|-----------|
| T11-1 | Card → 구현 | 사용자가 `register_card` → 에이전트가 `get_implementation_guide` 호출 → 코드 작성 → `link_card` 호출 | card_link 생성. coverage 반영. 에이전트가 card body/acceptance_criteria를 참고하여 구현 |
| T11-2 | 파일 열기 → context | 에이전트가 파일을 열면 `get_context({target: "src/auth.ts"})` 호출 | linkedCards, relatedCode 반환. 에이전트가 관련 card를 인지하고 코딩 |
| T11-3 | Card 수정 → stale → 재검증 | 사용자가 card body 수정 → stale detection → 에이전트가 `card_dashboard`로 stale 확인 → `link_card` 재호출 | stale_candidate → fresh. verified_at 갱신 |
| T11-4 | 리팩토링 → identity 보존 | 에이전트가 파일 이동/리네임 → startupScan → identity matching | card_link 자동 보존. 에이전트가 다음 `get_context` 호출 시 동일 card 연결 확인 |
| T11-5 | Bottom-up 구현 | 사용자가 parent card + child cards 등록 → 에이전트가 leaf부터 구현 → child verified → parent verified | 상한 경고만 반환. bottom-up 흐름 정상 동작 |
| T11-6 | Subgraph 탐색 | 에이전트가 `get_subgraph({center: "card::auth", hops: 2})` 호출 | card tree + linked code + dependencies 그래프 반환. 에이전트가 영향 범위 파악 |

## 부록 D: 현재 대비 변경 요약

| 영역 | 현재 | v4 | 변경 이유 |
|------|----|----|-----------|
| 정체성 담체 | `entity.id` | `entity_identity.id` | 스키마 수준 강제 |
| 파일 이동 처리 | entity_key rewrite | version append | 복잡도 제거 |
| grace window | 필요 | **불필요** | identity가 보호 |
| 스펙 모델 | 1 spec = 1 blob | **card nested tree** (depth 무제한) | 계층적 요구사항 관리 |
| entity_type | spec, claim | **card** (단일) | 통합 모델 |
| 관계 테이블 | relation (단일) | **card_link + card_relation + code_relation** (3종) | 성격별 분리 |
| evidence | relation_evidence (fact 참조만) | **card_evidence** (5종 다형성) | test, annotation 등 |
| card 속성 | 없음 | **status, priority, tags, weight, template, external_refs** | 분류/필터/가중치 |
| card lifecycle | 없음 | **7단계 state machine + 하위 전파 + 상한 경고(soft)** | 워크플로우 추적 |
| coverage | flat 비율 | **재귀 가중 집계 + tag 횡단 + workspace 필터** (v4.3) | 정밀한 진행률 |
| 감사 모델 | sync_event | approval_event (CHECK + payload 검증) | 거버넌스 |
| 되돌리기 | 없음 | rollback_approval | Reversibility |
| purge | 물리 삭제 | version purge (evidence 보존) → identity purge (COALESCE fallback) | 감사 보존 |
| workspace lifecycle | 없음 | **append-only + archive** (v4.3). 삭제 없음, soft delete | 브랜치 패턴 무관 무결성 |
| 사용자 식별 | 없음 | **`"user"` 테이블 + actor_id FK** (v4.3) | N명 감사 추적 |
| KB 중심 | code-centric | **card-centric** | 요구사항 중심 |
| 연결 방향 | code→spec 수동만 | + **@card 자동, glob pattern, external_refs** | 양방향 |
| 구현 전략 | big-bang | dual-read + feature flag | 점진적 전환 |
| 배포 모델 | 단일 사용자 | **N MCP : 1 DB** (v4.3) | 팀 협업 지원 |
| 도구 | 기존 18개 | 기존 18개 + **15개 신규** (register_card, link_card, unlink_card, move_card, update_card_status, relate_cards, unrelate_cards, card_impact, **card_dashboard**, coverage_map, rollback_approval, resolve/apply, **get_context, get_implementation_guide, get_subgraph**) | card 모델 + lifecycle + **context retrieval** |
| coverage 정확도 | link 존재 = covered | **evidence 기준 + stale 제외** (v4.4) | 과대평가 방지 |
| 에이전트 가이드 | 없음 | **워크플로우 A~D + AGENTS.md 연동** (v4.4) | 도구 사용 순서 명문화 |
| inconsistency 검사 | stale link, orphan | + **card_key path 불일치** (v4.4) | move_card 후 불일치 감지 |
| workspace 쿼리 안전 | 암묵적 | **archived 제외 패턴 + write 차단** (v4.4) | 운영 안전성 |
| user_id config | 권장 | **필수 (미설정 시 시작 거부)** (v4.4) | 감사 추적 보장 |
| FTS DDL | 없음 | **search_tsv TSVECTOR + GIN + 트리거** (v4.5) | 검색 도구 구현 가능 |
| source/fact DDL | §14에만 존재 | **§3.3에 정식 포함** (v4.5) | 자체 완결 |
| version project_id 정합 | 앱 보장만 | **트리거 추가** (v4.5) | identity↔version 정합 강제 |
| PK 생성 전략 | 미명시 | **ULID 권장** (v4.5) | workspace.id 충돌 방지 |
| retry 모니터링 | 없음 | **메트릭 기록** (v4.5) | advisory lock 전환 판단 |
| 문서 자체 완결성 | 이전 문서 참조 필요 | **자체 완결** (v4.6) | 이전 문서 없이 독립 이해 가능 |

---

> **문서 상태**: v4.6 (이전 문서 의존성 완전 제거 — 2026-02-11). 이전 설계 문서(v1/v2/v3)의 이슈 태그, 섹션 참조, 파일명 참조, 비교 서술을 모두 자체 완결 표현으로 교체. 이전 설계 문서 없이 본 문서만으로 전체 설계를 이해할 수 있다.
