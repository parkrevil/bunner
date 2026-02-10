# 스펙-코드 링크 유지 설계 v2

> **범위**: bunner-kb MCP 서버에 스펙(spec) 등록·링크·정체성 유지·거버넌스 기능 추가  
> **상태**: 설계 확정 (구현 전)  
> **관련 코드**: `tooling/mcp/`  
> **선행 문서**: `PLAN.md` (v1 — 코드 밀착 설계 초안, 아카이브)

---

## 1. 배경 및 문제 정의

### 1.1 현재 운영 모델

| 구분 | 설명 | 등록 방식 |
|------|------|-----------|
| **스펙(spec)** | 사용자와 에이전트가 논의하여 확정한 기능 명세 | 수동 등록 (`entity_type = 'spec'`) |
| **코드(code)** | TypeScript 소스 파일에서 추출한 모듈/심볼 | `sync` 파서가 자동 생성 (`module:`, `symbol:` 엔티티) |
| **스펙↔코드 연결** | 어떤 코드가 어떤 스펙을 구현하는지 | 수동 링크 (`relation_type = 'implements'`, `strength = 'manual'`) |

### 1.2 핵심 문제

코드 엔티티의 `entity_key`가 **파일 경로에 종속**되어 있다.

```
module:packages/core/src/app.ts
symbol:packages/core/src/app.ts#createApplication
```

파일 이동/리네임 시:
1. sync가 기존 `entity_key`의 entity를 **tombstone** 처리 (`is_deleted = true`)
2. 새 경로로 **새 entity** 생성 (새 `entity_key`, 새 `entity.id`)
3. 기존 relation은 tombstone entity의 `entity.id`를 FK로 참조 중 → **링크 파손**

### 1.3 v1의 한계 (왜 v2가 필요한가)

v1 설계(`PLAN.md`)는 `entity_key rewrite` + `grace window`로 이 문제를 해결하려 했다. 이 접근은:

- **정체성 보존이 "보정 메커니즘"에 의존**: rewrite가 실패하면(1:N, grace window 만료 등) 정체성이 깨진다. 선언이 아닌 강제 메커니즘이 필요하다.
- **규칙 복잡도 증가**: grace window edge case 7종, source unique constraint 충돌, pending_delete 자료구조 등 부수 복잡도가 높다.
- **거버넌스 부재**: 승인/롤백이 1급 이벤트가 아니라 도구 호출 부산물로 처리된다.
- **계약 이력 없음**: spec body 변경 시 upsert만 하고 버전 이력이 없다.

### 1.4 설계 목표 (v2)

- 파일 이동(내용 동일) 시 링크가 **자동으로 유지**되어야 한다
- 파일 분리/통합/심볼 리네임 시 링크 **후보를 제시**하고 **인간이 승인**해야 한다
- 수동 링크는 **절대 자동 삭제되지 않아야** 한다
- 링크에는 **"왜 연결했는지"(rationale)**가 항상 남아야 한다
- 모든 상태 전이는 **승인 이벤트**로 추적 가능해야 한다 (Auditability)
- 오탐은 **안전하게 되돌릴 수 있어야** 한다 (Reversibility)
- 자동화와 인간 책임 경계가 **명확**해야 한다 (Governance)
- 리팩터링 규모가 커져도 규칙 복잡도가 **선형 이하**여야 한다 (Evolution cost)

---

## 2. 설계 원칙

### 2.1 Contract-first

스펙은 단순 문서가 아니라 **계약 객체(Contract)**이다. 계약은 stable ID를 갖고, 개정(version)만 증가한다. 질문의 방향은 "이 코드가 어디 있나?"가 아니라 **"이 계약이 어떤 증거로 충족되나?"**이다.

### 2.2 Evidence-typed

코드는 계약의 **증거(evidence)**일 뿐이다. 코드 엔티티가 이동/리네임되어도 계약 자체는 불변이다. 링크는 `code ↔ spec`이 아니라 **evidence → contract claim** 구조로 발전할 수 있어야 한다.

### 2.3 Human-approved Truth

시스템의 진실은 추론이 아니라 **승인 로그**이다.

- **자동**: 결정론적 케이스만 (동일 content_hash, 1:1 매칭)
- **반자동**: 후보와 근거만 제시
- **수동확정**: 최종 링크/정체성 확정은 승인 이벤트 필요

이렇게 해야 오탐 책임을 모델이 아니라 **프로세스**로 관리할 수 있다.

### 2.4 평가 기준

| 기준 | 정의 | v2 목표 |
|------|------|---------|
| **Auditability** | 왜 이 링크가 생겼는지 재현 가능한가? | approval_event + evidence + anchor로 완전 재현 |
| **Reversibility** | 오탐을 안전하게 되돌릴 수 있는가? | compensating approval_event로 롤백 |
| **Governance** | 자동화와 인간 책임 경계가 명확한가? | 승인 이벤트가 상태 전이의 단일 진실 소스 |
| **Evolution cost** | 리팩터링 규모가 커져도 규칙 복잡도가 선형 이하인가? | identity+version 분리로 rewrite 규칙 자체 제거 |

### 2.5 범용화 원칙 (Portability)

bunner-kb는 언어/프로젝트/환경에 무관하게 **바이브코딩 RAG 서버**로 활용할 수 있어야 한다. 이를 위해 코어와 파서의 경계를 명확히 유지한다.

| 원칙 | 실천 |
|------|------|
| **코어와 파서를 섞지 않는다** | identity/version/approval/카드 모델 로직에 특정 언어 파서 코드를 넣지 않는다 |
| **entity_key 형식을 코어에서 가정하지 않는다** | 코어는 entity_key를 opaque string으로 취급. `module:` prefix 파싱은 파서 레이어에서만 수행 |
| **파서 인터페이스를 확정한다** | `KBParser` 인터페이스를 명시적으로 정의. 파서 플러그인 교체로 다른 언어 지원 |
| **config를 한 곳에 모은다** | 파일 확장자, hash 단위, @spec 패턴 등을 config 파일로 외부화 |

### 2.6 KB 범위 정책 (Scope Boundary)

KB에 등록하는 지식과 문서로 관리하는 지식의 경계를 명확히 한다.

**판단 기준**: "이 지식이 바뀌면 **특정 코드를 수정해야 하는가?**"

| 지식 유형 | 코드와 결속력 | 관리 위치 | 이유 |
|----------|-------------|----------|------|
| **스펙/카드** | 🔴 강함 — 직접 구현 대상 | **KB** (entity) | 코드와 1:1 추적. 변경 시 양방향 영향 |
| 프로젝트 철학/비전 | ⚪ 없음 | **문서** | 코드와 무관. 사람이 읽는 것 |
| 아키텍처 결정 (ADR) | 🟡 약함 | **문서** | 참고 사항. 인과관계 아님 |
| 스타일 가이드 | 🟡 약함 | **문서 + 린터** | 린터가 강제. 코드와 relation 추적 불필요 |
| 에이전트 규칙 | ⚪ 없음 | **문서** (AGENTS.md) | 프롬프트 주입용 |
| 용어집/온보딩 | ⚪ 없음 | **문서** | 사람/에이전트 참고용 |

> **스펙↔코드는 계약 관계(이행 의무)이므로 추적할 가치가 있다. 규칙↔코드는 참고 관계(권장)이므로 KB에 넣으면 관리 지옥이 된다.** 규칙은 파일(AGENTS.md, .cursor/rules/) + 린터로 관리한다.

---

## 3. 정체성(Identity) 모델

### 3.1 v1과의 핵심 차이

| 관점 | v1 | v2 |
|------|----|----|
| 정체성 담체 | `entity.id` (serial PK) | `entity_identity.id` (stable, 전용 테이블) |
| 주소(address) | `entity.entity_key` (rewrite로 갱신) | `entity_version.entity_key` (새 version row 추가) |
| 파일 이동 시 | entity_key rewrite (UPDATE) | 새 entity_version 추가 (INSERT). identity 불변 |
| relation FK 대상 | `entity.id` | `entity_identity.id` |
| rewrite 필요 | 필요 (v1 §4 전체) | **불필요** |
| grace window | 필요 (v1 §4.5) | **불필요** |

### 3.2 핵심 원칙

> **`entity_identity.id`가 진짜 정체성이다. 이 ID는 entity의 전 생애에 걸쳐 불변이다.**
>
> `entity_key`는 특정 시점의 주소(version)일 뿐이며, 파일 이동/리네임 시 새 version이 추가된다.
> relation은 `entity_identity.id`를 FK로 참조하므로, **어떤 경로 변경에도 relation은 깨지지 않는다.**

이것은 "선언"이 아니라 **스키마 수준의 강제 메커니즘**이다:
- relation FK가 `entity_identity.id`를 참조하므로, identity가 존재하는 한 relation은 유효하다
- entity_key가 바뀌면 새 version row가 추가될 뿐, identity row는 변경되지 않는다
- 따라서 "정체성 보존을 위한 보정 로직"(rewrite, grace window)이 구조적으로 불필요하다

### 3.3 계층별 정체성 정의

| 레벨 | Identity (불변) | Address (가변) | 매칭 신호 |
|------|-----------------|----------------|-----------|
| **Module** | `entity_identity.id` | `module:{file_path}` → `entity_version` | `content_hash` (SHA-256) |
| **Symbol** | `entity_identity.id` | `symbol:{file_path}#{symbol_name}` → `entity_version` | 부모 module의 identity + `symbol_name` |
| **Spec** | `entity_identity.id` | `spec::{spec_name}` → `entity_version` | 사용자 지정 (불변) |
| **Claim** | `entity_identity.id` | `claim::{spec_name}/{claim_name}` → `entity_version` | 사용자 지정 (불변). 상위 spec에 `contains` relation |

### 3.4 정체성 유지의 의미

"파일 `a.ts`가 `b.ts`로 이동"되었을 때:

- **v1**: `module:a.ts`의 `entity_key`를 `module:b.ts`로 UPDATE → entity.id 유지 (rewrite 성공 시)
- **v2**: `entity_identity`는 그대로. 기존 `entity_version`(key=`module:a.ts`)은 `status='archived'`로 전이. 새 `entity_version`(key=`module:b.ts`)이 `status='active'`로 추가. relation FK는 identity를 참조하므로 **무조건 유지**.

### 3.5 Identity + Version 스키마 상세

#### `entity_identity` (정체성 — 불변)

```sql
CREATE TABLE entity_identity (
  id            SERIAL PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspace(id),
  entity_type_id SMALLINT NOT NULL REFERENCES entity_type(id),
  stable_key    TEXT,          -- optional: user-assigned stable name (e.g. spec key)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- UNIQUE(workspace_id, id) 불필요: id가 이미 PK이므로 생략
);

-- partial unique index: stable_key가 있는 경우만 (spec entity)
CREATE UNIQUE INDEX idx_identity_stable_key
  ON entity_identity(workspace_id, stable_key)
  WHERE stable_key IS NOT NULL;
```

| 컬럼 | 설명 |
|------|------|
| `id` | 전 생애 불변 ID. relation이 참조하는 대상 |
| `workspace_id` | 소속 workspace |
| `entity_type_id` | entity 타입 (module, symbol, spec 등) |
| `stable_key` | spec의 경우 `spec::name`을 저장. code entity는 NULL. 선택적 보조 식별자. partial unique index로 보호 |
| `created_at` | identity 최초 생성 시각 |

#### `entity_version` (버전 — 가변 주소/상태)

```sql
CREATE TABLE entity_version (
  id            SERIAL PRIMARY KEY,
  identity_id   INTEGER NOT NULL REFERENCES entity_identity(id) ON DELETE CASCADE,
  workspace_id  TEXT NOT NULL REFERENCES workspace(id),
  entity_key    TEXT NOT NULL,              -- current address: "module:path" or "symbol:path#name"
  summary       TEXT,
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_hash  TEXT,                       -- SHA-256 of source content at this version
  status        TEXT NOT NULL DEFAULT 'active',  -- active / archived / superseded
  version_num   INTEGER NOT NULL DEFAULT 1,
  last_seen_run INTEGER REFERENCES sync_run(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- active version만 유일성 보장. archived는 중복 허용 (파일 왕복 이동 대응)
CREATE UNIQUE INDEX version_active_unique
  ON entity_version(workspace_id, entity_key)
  WHERE status = 'active';
```

| 컬럼 | 설명 |
|------|------|
| `identity_id` | 소속 identity FK |
| `entity_key` | 이 시점의 주소. `module:packages/core/src/app.ts` |
| `summary` | 엔티티 요약 |
| `meta` | 추가 메타데이터 (JSONB) |
| `content_hash` | 이 version 시점의 파일 content hash |
| `status` | `'active'` = 현재 살아있는 version, `'archived'` = 경로 변경으로 비활성, `'superseded'` = 미래 확장용 예약 상태 (v2 미사용. identity merge나 entity 대체 시나리오에서 사용 예정) |
| `version_num` | 동일 identity 내 순번 (monotonic increment) |
| `last_seen_run` | 마지막으로 확인된 sync run |

#### `entity_lifecycle` (생애 이벤트 로그)

```sql
CREATE TABLE entity_lifecycle (
  id            SERIAL PRIMARY KEY,
  identity_id   INTEGER NOT NULL REFERENCES entity_identity(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL
    CHECK (event_type IN ('created', 'updated', 'renamed', 'split', 'merged', 'superseded', 'archived', 'restored')),
    -- v2 사용 이벤트: created, updated, renamed, merged, superseded, archived
    -- 예약 이벤트: split, restored (미래 확장용)
  from_version_id INTEGER REFERENCES entity_version(id),
  to_version_id   INTEGER REFERENCES entity_version(id),
  related_identity_id INTEGER REFERENCES entity_identity(id),  -- for split/merge: the other identity
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

| 컬럼 | 설명 |
|------|------|
| `event_type` | 생애 이벤트 종류 |
| `from_version_id` | 이전 version (rename 시 옛 version) |
| `to_version_id` | 새 version (rename 시 새 version) |
| `related_identity_id` | split/merge 시 관련 identity |
| `meta` | 이벤트 세부 정보 (이유, content_hash 등) |

### 3.6 Identity 조회 전략

`entity_identity`의 `stable_key`는 spec/claim entity만 값이 있고, code entity는 `NULL`이다. 따라서 identity를 조회하는 표준 전략이 필요하다.

#### 조회 우선순위 (모든 도구에 적용)

```
1. stable_key   — NOT NULL인 경우 (spec entity). WHERE stable_key = :key
2. entity_key   — active version의 entity_key로 조회. 가장 빈번한 조회 경로.
                  JOIN entity_version ON identity_id = ei.id
                  WHERE entity_key = :key AND status = 'active'
3. identity.id  — 직접 ID 지정 (apply_identity_rewrite 등 내부 도구용)
4. content_hash — identity matching용. active 또는 archived version의 hash로 조회
```

#### 표준 identity 조회 함수 (구현 가이드)

```typescript
type IdentityLookup =
  | { by: 'stableKey'; stableKey: string; workspaceId: string }
  | { by: 'entityKey'; entityKey: string; workspaceId: string }
  | { by: 'identityId'; identityId: number }
  | { by: 'contentHash'; contentHash: string; workspaceId: string; entityTypeId?: number };

// resolveIdentity(lookup: IdentityLookup): Promise<EntityIdentity | null>
```

**규칙**:
- `search` 도구: 사용자 입력은 `entity_key` 기반으로 간주 → 우선순위 2번 경로
- `describe`, `facts`, `relations` 등: `entityKey` 파라미터를 받으면 → 우선순위 2번 경로로 identity 확인 후 진행
- `link_spec`: `specKey` 파라미터 → 우선순위 1번 경로 (`stable_key`)
- 내부 sync 로직: `content_hash` → 우선순위 4번 경로

> **nullable unique 처리**: `stable_key`에 대한 unique index는 `WHERE stable_key IS NOT NULL` partial unique index로 구현한다. SQL 표준에서 NULL은 unique 제약에서 제외되므로, 다수의 NULL 값이 허용된다.

### 3.7 기존 테이블과의 관계 변경

#### `relation` FK 변경

```sql
-- v1 (현재)
src_entity_id INTEGER REFERENCES entity(id) ON DELETE CASCADE
dst_entity_id INTEGER REFERENCES entity(id) ON DELETE CASCADE

-- v2
src_identity_id INTEGER REFERENCES entity_identity(id) ON DELETE CASCADE
dst_identity_id INTEGER REFERENCES entity_identity(id) ON DELETE CASCADE
```

relation이 identity를 참조하므로, version이 추가/archived 되어도 relation은 불변이다.

#### `source` FK 변경

```sql
-- v1 (현재)
entity_id INTEGER REFERENCES entity(id) ON DELETE CASCADE

-- v2
version_id INTEGER REFERENCES entity_version(id) ON DELETE CASCADE
```

source는 특정 version(특정 시점의 파일 경로)에 연결된다.

#### `fact` FK 변경

```sql
-- v1 (현재)
entity_id INTEGER REFERENCES entity(id) ON DELETE CASCADE

-- v2
version_id INTEGER REFERENCES entity_version(id) ON DELETE CASCADE
```

fact는 특정 version에서 파싱된 결과이므로, version에 연결한다.

#### `relation_evidence` — 구조 변경 (evidence 보존 + 버전 추적)

```sql
relation_id   INTEGER REFERENCES relation(id) ON DELETE CASCADE
fact_id       INTEGER REFERENCES fact(id) ON DELETE SET NULL  -- version purge 시 fact 사라져도 evidence 행 보존
version_id    INTEGER REFERENCES entity_version(id) ON DELETE SET NULL  -- 어느 version에서 생성된 evidence인지 추적
is_active     BOOLEAN NOT NULL DEFAULT true  -- 현재 유효 evidence인지 여부
evidence_snapshot JSONB  -- fact 삭제 시에도 참조 가능한 스냅샷 (fact 생성 시점에 캡처)
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
```

**변경 사유 및 설계 원칙:**

1. **Provenance 보존**: `fact_id`가 `ON DELETE SET NULL`이므로, version purge로 fact가 cascade 삭제되어도 relation_evidence 행 자체는 유지된다. `evidence_snapshot`에 fact 내용이 남아 있어 "왜 연결됐는지"를 재현할 수 있다.

2. **현재/과거 구분**: `version_id`는 해당 evidence가 어떤 version의 fact에서 비롯됐는지 기록한다. `is_active`는 해당 evidence가 현재 유효한지 명시한다:
   - identity에 새 version이 추가되고 파서가 해당 relation을 재확인하면 → 새 evidence(`is_active=true`) 추가, 이전 version의 evidence는 `is_active=false`로 전환
   - manual link의 evidence는 사용자가 명시적으로 변경하기 전까지 `is_active=true` 유지

3. **evidence_snapshot 필수 필드**:
   ```json
   {
     "factKey": "manual_link:spec::di-container→symbol:...#create",
     "factPayload": { /* fact.payload at capture time */ },
     "entityKey": "symbol:packages/core/src/app.ts#createApplication",
     "contentHash": "sha256:..."
   }
   ```

4. **조회 규칙**:
   - `evidence` 도구 (기본): `WHERE is_active = true` — 현재 유효 evidence만 반환
   - `evidence` 도구 (`includeHistory=true`): 모든 evidence 반환, `is_active` 상태 표시
   - 감사 시: `fact_id IS NULL`이면 `evidence_snapshot`을 참조 (fact가 purge된 이력 데이터)

#### `sync_event` FK 변경

```sql
-- v1 (현재)
entity_id INTEGER REFERENCES entity(id) ON DELETE CASCADE

-- v2
identity_id INTEGER REFERENCES entity_identity(id) ON DELETE CASCADE
version_id  INTEGER REFERENCES entity_version(id)   -- nullable, specific version if applicable
```

### 3.8 v1 `entity` 테이블의 처분

v2에서 `entity` 테이블은 `entity_identity` + `entity_version`으로 **분리 대체**된다. migration 완료 후 `entity` 테이블은 제거한다 (§15 Migration Path 참조).

---

## 4. 거버넌스 모델 (Approval Event)

### 4.1 핵심 원칙

> **시스템의 진실은 추론이 아니라 승인 로그다.**

모든 수동/반자동 상태 전이(링크 생성, 링크 재연결, 링크 삭제, identity merge)는 `approval_event`를 통해서만 수행된다. 도구 호출은 approval_event를 **생성**하고, 상태 변경은 approval_event **핸들러**가 수행한다.

### 4.2 `approval_event` 스키마

```sql
CREATE TABLE approval_event (
  id              SERIAL PRIMARY KEY,
  workspace_id    TEXT NOT NULL REFERENCES workspace(id),
  event_type      TEXT NOT NULL
    CHECK (event_type IN (
      'link_created', 'link_updated', 'link_removed',
      'identity_rewritten', 'identity_merged',
      'link_rollback', 'spec_registered', 'spec_updated',
      'spec_relation_created', 'spec_relation_updated'
    )),
  actor           TEXT NOT NULL DEFAULT 'agent'
    CHECK (actor IN ('agent', 'user', 'system')),
  target_relation_id  INTEGER REFERENCES relation(id) ON DELETE SET NULL,
  target_identity_id  INTEGER REFERENCES entity_identity(id) ON DELETE SET NULL,
  payload         JSONB NOT NULL,  -- event-specific data (REQUIRED snapshot, no default). See §4.3 for per-type requirements
  rationale       TEXT,            -- why this action was taken
  parent_event_id INTEGER REFERENCES approval_event(id),  -- for rollback: points to the event being undone
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

> **CHECK 제약**: `event_type`과 `actor`에 CHECK 제약을 걸어 오타를 DB 레벨에서 차단한다. 새 이벤트 타입 추가 시 `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT ...` migration이 필요하지만, 이벤트 타입은 드물게 추가되므로 수용 가능하다.

| 컬럼 | 설명 |
|------|------|
| `event_type` | 승인 행위의 종류 |
| `actor` | 행위 주체. MCP 호출이면 `'agent'`, 명시적 사용자 확인이면 `'user'`, 자동 프로세스면 `'system'` |
| `target_relation_id` | 이 이벤트가 영향을 준 relation (있으면) |
| `target_identity_id` | 이 이벤트가 영향을 준 identity (있으면) |
| `payload` | 이벤트별 상세 데이터 (아래 §4.3 참조) |
| `rationale` | 이 행위의 근거 |
| `parent_event_id` | 롤백 시, 되돌리는 대상 이벤트 |

### 4.3 이벤트 타입별 Payload (필수 스냅샷 규약)

> **불변 규칙**: `payload`는 **자기 완결적(self-contained)**이어야 한다. `target_relation_id`와 `target_identity_id`는 `ON DELETE SET NULL`이므로, 대상이 삭제되어도 payload만으로 감사/롤백이 가능해야 한다. 아래 `[필수]` 필드가 없으면 이벤트 생성을 거부한다.

#### `link_created`

```json
{
  "relationId": 123,                     // [필수] 생성된 relation id
  "codeIdentityId": 42,                  // [필수]
  "codeEntityKey": "symbol:...#create",  // [필수] 생성 시점의 entity_key
  "codeVersionId": 88,                   // [필수] 생성 시점의 active version
  "specIdentityId": 7,                   // [필수]
  "specKey": "spec::di-container",       // [필수]
  "specVersionId": 14,                   // [필수] 생성 시점의 spec version
  "specContentHash": "sha256:abc...",    // [필수] 생성 시점의 spec content hash
  "anchor": { /* LinkAnchor */ },        // [필수] 전체 앵커 스냅샷
  "rationale": "...",                    // [필수] rationale 복사 (relation 삭제돼도 남음)
  "strengthType": "manual"               // [필수]
}
```

#### `link_updated`

```json
{
  "relationId": 123,                     // [필수]
  "before": {                            // [필수] 변경 전 상태 스냅샷
    "rationale": "old rationale",
    "anchor": { /* old LinkAnchor */ },
    "meta": { /* old relation.meta */ }
  },
  "after": {                             // [필수] 변경 후 상태
    "rationale": "new rationale",
    "anchor": { /* new LinkAnchor */ },
    "meta": { /* new relation.meta */ }
  }
}
```

#### `link_removed`

```json
{
  "relationId": 123,                     // [필수]
  "removedRelation": {                   // [필수] 삭제 직전의 전체 relation 스냅샷
    "srcIdentityId": 42,
    "dstIdentityId": 7,
    "relationTypeId": 3,
    "strengthTypeId": 2,
    "meta": { /* full meta */ }
  },
  "reason": "user_request"               // [필수] "user_request" | "superseded" | "rollback"
}
```

#### `identity_rewritten`

```json
{
  "relationId": 123,                     // [필수]
  "oldIdentityId": 42,                   // [필수]
  "oldEntityKey": "symbol:old#foo",      // [필수]
  "newIdentityId": 55,                   // [필수]
  "newEntityKey": "symbol:new#foo",      // [필수]
  "matchReason": "FTS symbolName match", // [필수]
  "relationBefore": {                    // [필수] 변경 전 relation 스냅샷
    "srcIdentityId": 42,
    "meta": { /* full meta */ }
  }
}
```

#### `link_rollback`

```json
{
  "undoneEventId": 456,                  // [필수] 되돌리는 대상 이벤트 id
  "undoneEventType": "link_created",     // [필수] 대상 이벤트 타입
  "undoneEventPayload": { /* ... */ },   // [필수] 대상 이벤트의 payload 전체 복사
  "compensatingAction": "relation_deleted",  // [필수] 수행한 보상 행위
  "restoredState": { /* ... */ }         // [선택] 복원된 상태 (가능한 경우)
}
```

#### `spec_registered` / `spec_updated`

```json
{
  "specKey": "spec::di-container",       // [필수]
  "identityId": 7,                       // [필수]
  "versionId": 14,                       // [필수]
  "versionNum": 2,                       // [필수]
  "contentHash": "sha256:...",           // [필수]
  "previousVersionId": 13,              // [필수 for spec_updated] 이전 version
  "previousContentHash": "sha256:..."   // [필수 for spec_updated]
}
```

#### `identity_merged`

```json
{
  "survivorIdentityId": 42,             // [필수] 병합 후 생존한 identity
  "mergedIdentityId": 55,               // [필수] 흡수된 identity
  "mergedEntityKey": "module:old.ts",    // [필수] 흡수된 identity의 마지막 entity_key
  "survivorEntityKey": "module:new.ts",  // [필수] 생존 identity의 현재 entity_key
  "mergeReason": "content_hash_match",   // [필수] "content_hash_match" | "user_approved"
  "migratedRelations": [123, 456],       // [필수] 이관된 relation id 목록
  "migratedVersions": [78, 90]           // [필수] 이관된 version id 목록
}
```

#### `spec_relation_created` / `spec_relation_updated`

```json
{
  "relationId": 200,                     // [필수] 생성/갱신된 relation id
  "srcKey": "spec::billing",             // [필수]
  "srcIdentityId": 10,                   // [필수]
  "dstKey": "spec::auth-flow",           // [필수]
  "dstIdentityId": 11,                   // [필수]
  "relationType": "depends_on",          // [필수] "depends_on" | "extends"
  "strengthType": "manual",              // [필수]
  "rationale": "결제에 인증 선행 필요",    // [필수]
  "previousMeta": { /* ... */ }          // [필수 for spec_relation_updated] 갱신 전 meta 스냅샷
}
```



### 4.4 도구-이벤트 매핑

| 도구 호출 | 생성되는 approval_event |
|-----------|------------------------|
| `link_spec` (신규) | `link_created` |
| `link_spec` (기존 갱신) | `link_updated` |
| `register_spec` (신규) | `spec_registered` |
| `register_spec` (갱신) | `spec_updated` |
| `apply_identity_rewrite` | `identity_rewritten` |
| `rollback_approval` (신규 도구) | `link_rollback` |
| `relate_specs` (신규) | `spec_relation_created` |
| `relate_specs` (기존 갱신) | `spec_relation_updated` |
| identity merge (시스템 자동) | `identity_merged` |

### 4.5 Reversibility (되돌리기)

모든 승인 이벤트는 되돌릴 수 있다.

**`rollback_approval` 도구**:

```typescript
type RollbackApprovalInput = {
  /** 되돌릴 approval_event의 id */
  approvalEventId: number;
  /** 되돌리는 이유 */
  reason: string;
};
```

**동작**:
1. 대상 `approval_event`를 조회
2. 해당 이벤트의 `event_type`에 따라 compensating action 수행:

   | event_type | compensating action |
   |-----------|-------------------|
   | `link_created` | relation 삭제 (또는 strength를 'inferred'로 격하) |
   | `link_updated` | relation.meta를 `payload.previousMeta`로 복원 |
   | `identity_rewritten` | relation의 src_identity_id를 원래 값으로 복원 |
   | `identity_merged` | version/relation을 원래 identity로 이관 원복 + 분기 identity 복원 |
   | `spec_registered` | version 삭제 + identity 삭제 (하위 claim relation도 cascade) |
   | `spec_updated` | 이전 version을 `active`로 복원, 현재 version 삭제 (`payload.previousVersionId` 참조) |
   | `spec_relation_created` | 해당 relation 삭제 |
   | `spec_relation_updated` | relation.meta를 `payload.previousMeta`로 복원 |
   | `link_rollback` | 롤백의 롤백: 원래 이벤트의 상태를 재적용 (이중 롤백) |

   > **주의**: `identity_merged`의 롤백은 merge 이후에 생성된 다른 이벤트가 있으면 거부한다 (인과 순서 보호).

   > **`link_removed` 생성 경로**: `link_removed`는 독립 도구가 아니라, `rollback_approval`로 `link_created` 이벤트를 롤백할 때 compensating action으로 relation이 삭제되는 흐름이다. 명시적인 `unlink_spec` 도구는 제공하지 않으며, 모든 link 삭제는 `rollback_approval`을 통해 거버넌스 추적이 보장된다.

3. `link_rollback` 이벤트 생성 (`parent_event_id` = 대상 이벤트)
4. 결과 반환

**제약**: 이미 롤백된 이벤트는 재롤백 불가. 롤백의 롤백이 필요하면 새로운 정방향 이벤트를 생성한다.

### 4.6 Provenance Chain (출처 추적)

특정 relation에 대해 "왜 이 링크가 존재하는가?"를 재현하려면:

```sql
SELECT ae.*
FROM approval_event ae
WHERE ae.target_relation_id = {relation_id}
ORDER BY ae.created_at ASC;
```

이 쿼리 하나로 해당 relation의 전체 이력(생성 → 수정 → 재연결 → 롤백 등)을 시간순으로 조회할 수 있다.

---

## 5. 계약 모델 (Contract Versioning)

### 5.1 Spec Version 관리

spec body가 변경될 때, 단순 upsert가 아니라 **버전 이력**을 남긴다.

**구현**: `entity_version` 테이블의 일반 메커니즘을 활용한다.

1. `register_spec` 호출 시 body의 `content_hash`를 계산
2. 현재 active version의 `content_hash`와 비교
3. 다르면:
   - 현재 version을 `status='archived'`로 전이
   - 새 version 생성 (`version_num` increment, `status='active'`)
   - `entity_lifecycle`에 `event_type='updated'` 기록
   - `approval_event`에 `spec_updated` 기록
4. 같으면: 변경 없음 (idempotent)

### 5.2 링크 시점 재현

`link_spec` 호출 시, `approval_event.payload`에 **그 시점의 spec version_id**를 기록한다:

```json
{
  "specVersionId": 14,
  "specContentHash": "sha256:abc..."
}
```

이를 통해 "이 링크가 만들어진 시점의 spec 내용이 뭐였는지" 재현 가능하다.

### 5.3 하이브리드 카드 모델 (Claim as Card)

스펙을 하나의 큰 blob으로 관리하지 않고, **작은 카드(claim) 단위**로 분해하여 등록한다. 각 카드는 독립적인 추적 단위이며, 코드 link의 실제 대상이다.

#### 개념 모델

```
spec::di-container                    ← 상위 스펙 (entity_type: 'spec')
│   summary: "DI 컨테이너"
│   body: "총괄 설명 + 배경"
│
├── claim::di-container/singleton     ← 카드 (entity_type: 'claim')
│     summary: "싱글톤 스코프 지원"
│     body: "요구사항 + 검증 기준(BDD)"
│     ─[implements]← symbol:...#SingletonScope
│
├── claim::di-container/transient     ← 카드
│     ─[implements]← symbol:...#TransientScope
│
└── claim::di-container/scope         ← 카드 (미연결 = 미구현)
```

#### 핵심 규칙

- **spec** = 상위 컨테이너. 배경/목적/범위를 기술. 코드 link는 카드에만 걸기를 **권장** (spec에 직접 link 시 경고)
- **claim** = 카드. 하나의 요구사항 단위. 코드 link의 실제 대상
- spec ←[contains]→ claim 관계로 소속 자동 표현
- **진행률 = 카드 커버리지**: 10개 카드 중 7개 linked = 70%

#### 시드 추가

```sql
INSERT INTO entity_type (name) VALUES ('claim');
INSERT INTO relation_type (name) VALUES ('contains');
INSERT INTO relation_type (name) VALUES ('depends_on');  -- spec↔spec 의존
INSERT INTO relation_type (name) VALUES ('extends');      -- spec↔spec 확장
```

#### 카드 키 형식

```
claim::{상위spec명}/{카드명}

예: claim::di-container/singleton
    claim::auth-flow/token-refresh
    claim::error-handling/retry-policy
```

검증 정규식: `/^claim::[a-z0-9][a-z0-9-]*[a-z0-9]\/[a-z0-9][a-z0-9-]*[a-z0-9]$/`

#### 카드 body 권장 형식 (BDD 하이브리드)

강제가 아닌 **권장 컨벤션**. 자유 마크다운도 허용된다.

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

#### 워크플로우 예시

```
1️⃣  사용자 + 에이전트 논의: "DI 컨테이너를 만들자"

2️⃣  상위 스펙 등록
    register_spec({ specKey: "spec::di-container", summary: "DI 컨테이너", body: "총괄 설명" })

3️⃣  카드 등록 (작은 단위로 나열)
    register_spec({ specKey: "claim::di-container/singleton",
                    parentSpecKey: "spec::di-container",
                    summary: "싱글톤 스코프 지원", body: "## 요구사항 ..." })
    register_spec({ specKey: "claim::di-container/transient", ... })
    register_spec({ specKey: "claim::di-container/scope", ... })

4️⃣  코드 구현 → 카드 단위 링크
    link_spec({ codeEntityKey: "symbol:...#SingletonScope",
                specKey: "claim::di-container/singleton",
                rationale: "이 클래스가 싱글톤 스코프를 구현" })

5️⃣  커버리지 확인
    coverage_map({ specKey: "spec::di-container" })
    →  spec::di-container         전체 커버리지: 2/3 (66.7%)
       ├── claim::.../singleton   ✅ linked → SingletonScope
       ├── claim::.../transient   ✅ linked → TransientScope
       └── claim::.../scope       ❌ 미연결
```

#### Claim 확장 경로

| 단계 | claim 세분화 | 구현 |
|------|-------------|------|
| v2 (현재) | **카드 = 수동 claim** | `register_spec`으로 카드 단위 등록. `contains` relation 자동 생성 |
| v3+ | 보조 자동 제안 | LLM이 spec body에서 claim 후보를 추출하고, 사용자가 승인 |

#### spec↔spec 관계

스펙 간 의존/확장 관계를 표현할 수 있다.

```
relate_specs({
  srcKey: "spec::billing",
  dstKey: "spec::auth-flow",
  relationType: "depends_on",
  rationale: "결제 처리에 인증이 선행되어야 함"
})
```


> **strength**: `relate_specs`로 생성되는 relation의 `strength_type`은 항상 `'manual'`이다. 사용자가 명시적으로 생성하는 관계이므로 자동 삭제 대상이 아니다.

`dependency_graph`에서 spec 노드 간 관계도 표시. `impact_analysis`에서 spec 변경 시 의존 spec까지 영향도 표시.

---

## 6. 계층적 방어 전략

### 6.1 개요

```
┌─────────────────────────────────────────────────┐
│  계층 1: content_hash 기반 identity matching     │ ← 자동 (결정론적)
│  대상: 파일 이동 (내용 동일)                       │
├─────────────────────────────────────────────────┤
│  계층 2: resolve_identity_candidates             │ ← 반자동 (인간 승인)
│  대상: 파일 분리/통합, 심볼 리네임                   │
├─────────────────────────────────────────────────┤
│  계층 3: register_spec / link_spec               │ ← 수동 (논의 기반)
│  대상: 새 스펙 등록, 새 링크 생성                    │
└─────────────────────────────────────────────────┘
```

**자동 적용 기준**: 결정론적 신호(content_hash 1:1 매칭)만 자동. 그 외는 전부 인간 승인.

### 6.2 v1과의 핵심 차이

| 관점 | v1 | v2 |
|------|----|----|
| 계층 1 메커니즘 | entity_key rewrite (UPDATE) | version append (INSERT) + identity matching |
| grace window | 필요 | **불필요** (identity가 relation을 보호) |
| 계층 2 상태 전이 | 도구 호출이 직접 변경 | approval_event 생성 → 핸들러가 변경 |
| 되돌리기 | 없음 | rollback_approval |

### 6.3 계층 1: content_hash 기반 Identity Matching

#### 동작 원리

v1과 같은 content_hash 기반 매칭을 사용하되, **메커니즘이 다르다**.

**startupScan 시**:

1. `scanFiles()` 결과와 DB의 active version을 교차 비교
2. "DB에 있지만 파일시스템에 없는" active version → `disappearedVersions`
3. "파일시스템에 있지만 DB에 없는" 파일 → `newFiles`
4. 두 집합에서 **content_hash가 동일한 1:1 쌍**을 찾는다

**매칭 성공 시**:
- 기존 version을 `status='archived'`로 전이
- 같은 `identity_id`로 새 version 추가 (`entity_key=new_path`, `status='active'`)
- `entity_lifecycle`에 `event_type='renamed'` 기록
- `sync_event`에 `action='renamed'` 기록
- **relation은 identity를 참조하므로 변경 없음**

**매칭 실패 시** (1:N, N:1, hash 불일치):
- 기존 version을 `status='archived'`로 전이
- 새 identity + 새 version 생성 (새 파일)
- manual link가 있었다면 → `resolve_identity_candidates`로 사후 복구

#### Watch 트리거에서의 처리

v2에서는 grace window가 **불필요**하다.

| 이벤트 | 처리 |
|--------|------|
| DELETE(a.ts) | 해당 version을 `status='archived'`로 전이. identity는 유지. relation은 identity를 참조하므로 **안 깨짐** |
| CREATE(b.ts) | content_hash로 archived version 검색. 매칭 성공 → 같은 identity에 새 version 추가. 매칭 실패 → 새 identity 생성 |

grace window가 불필요한 이유: DELETE 이벤트가 먼저 와도 identity는 살아있고, relation도 살아있다. 이후 CREATE 이벤트에서 content_hash 매칭으로 같은 identity에 연결하면 된다. "시간차"가 문제가 되지 않는다.

#### Watch 역순 (CREATE→DELETE) 방어: Identity 분기 자동 병합

파일 시스템 이벤트 순서가 `CREATE(b.ts)` → `DELETE(a.ts)`로 역전될 수 있다. 이 경우:
1. `CREATE(b.ts)`: DB에 `a.ts`의 active version이 아직 있으므로 content_hash 매칭에서 "기존 archived version"을 못 찾음 → **새 identity 생성됨**
2. `DELETE(a.ts)`: 기존 version을 `archived`로 전이

결과: 같은 content_hash를 가진 두 identity가 존재 (하나는 `a.ts`의 archived version, 하나는 `b.ts`의 active version). Relation이 깨지지는 않지만, **논리적 중복 identity**가 발생한다.

**방어 메커니즘: Post-DELETE Identity Merge Check**

`DELETE` 이벤트 처리 후, 추가 단계를 수행한다:

```
DELETE(a.ts) 처리 완료 후:
1. archived된 version의 content_hash를 추출
2. 같은 workspace + 같은 entity_type에서 해당 content_hash를 가진
   다른 identity의 active version이 있는지 검색
3. 매칭 발견 시 (= 역순으로 생성된 분기 identity):
   a. 기존(a.ts) identity에 새(b.ts) version을 이관:
      UPDATE entity_version SET identity_id = {old_identity_id}
      WHERE identity_id = {new_identity_id}
   b. 분기된 identity에 달린 relation이 있으면 old_identity로 이관
   c. 빈 identity 삭제
   d. entity_lifecycle에 'merged' 이벤트 기록
      (related_identity_id = 삭제된 분기 identity)
   e. approval_event에 'identity_merged' 이벤트 기록:
      - target_identity_id: old_identity_id (병합 대상)
      - actor: 'system'
      - payload: { mergedIdentityId: new_identity_id, contentHash, trigger: 'post_delete_merge' }
4. 매칭 미발견 → 정상 (다른 파일). 아무 것도 하지 않음
```

**설계 원칙**:
- 이 병합은 **content_hash 1:1 매칭**이 확실한 경우에만 수행 (결정론적)
- 1:N, N:1 매칭은 수행하지 않음 (반자동 계층으로 위임)
- 병합 시 sync_event에 `action='merged'` 기록

**startupScan 보완**: startupScan 시에도 동일한 중복 identity 탐지를 수행한다. Watch 역순으로 생긴 미병합 identity가 있다면 이 시점에 정리된다.

---

## 7. 계층 3: 수동 도구

### 7.1 도구: `register_spec`

스펙 entity를 KB에 수동 등록한다.

#### 입력 스키마

```typescript
type RegisterSpecInput = {
  /** 스펙/카드 키. 형식: "spec::{name}" 또는 "claim::{spec_name}/{card_name}" */
  specKey: string;
  /** 스펙/카드 요약 (1~2줄) */
  summary: string;
  /** 스펙/카드 본문 (마크다운) */
  body: string;
  /** 카드(claim) 등록 시 필수. 상위 spec 키. 예: "spec::di-container" */
  parentSpecKey?: string;
  /** 추가 메타데이터 */
  meta?: Record<string, unknown>;
};
```

#### 동작 절차

**단일 트랜잭션**으로:

1. **Identity 생성/조회**
   - `entity_identity`에서 `stable_key = specKey` 조회
   - 없으면 새 identity 생성:
     - `specKey`가 `spec::` prefix → `entity_type = 'spec'`
     - `specKey`가 `claim::` prefix → `entity_type = 'claim'`
   - **claim인 경우**: `parentSpecKey` 필수 검증. 없으면 에러: "claim requires parentSpecKey"
   - **spec인 경우**: `parentSpecKey` 있으면 에러: "spec cannot have a parent"

2. **Version 생성/갱신**
   - `content_hash = SHA-256(body)` 계산
   - 현재 active version의 `content_hash`와 비교
   - 다르면: 현재 version → `status='archived'`, 새 version 생성 (`version_num++`)
   - 같으면: summary/meta만 갱신 (idempotent)

3. **Source 생성/갱신**
   ```
   kind:          "spec"
   file_path:     "__manual__/spec/{specKey}" (가상 경로)
   content_hash:  SHA-256(body)
   version_id:    새 version의 id
   ```

4. **Fact 생성**
   ```
   fact_type:     "spec_body"
   fact_key:      "body:{specKey}"
   payload_text:  body (FTS 인덱싱 대상)
   payload_json:  { format: "markdown", version: version_num }
   content_hash:  SHA-256(body)
   version_id:    새 version의 id
   ```

5. **Approval Event 기록**
   - `event_type: 'spec_registered'` 또는 `'spec_updated'`
   - `target_identity_id: identity.id`

6. **Entity Lifecycle 기록**
   - 신규: `event_type: 'created'`
   - 갱신: `event_type: 'updated'`, `from_version_id`, `to_version_id`

7. **Contains Relation 자동 생성** (claim인 경우만)
   - `parentSpecKey`로 parent spec identity 조회
   - 없으면 에러: "Parent spec not found: {parentSpecKey}"
   - `contains` relation 생성:
     ```
     src_identity_id: parent spec의 identity_id
     dst_identity_id: claim의 identity_id
     relation_type:   "contains"
     strength:        "manual"
     meta: { createdBy: 'register_spec', autoGenerated: true }
     ```
   - 이미 존재하면 skip (idempotent)

#### 출력 스키마

```typescript
type RegisterSpecResult = {
  specKey: string;
  identityId: number;
  versionId: number;
  versionNum: number;
  action: 'created' | 'updated' | 'unchanged';
};
```

#### 스펙/카드 키 규칙

- **spec 형식**: `spec::{name}` (콜론 두 개)
- **claim 형식**: `claim::{spec_name}/{card_name}` (콜론 두 개 + 슬래시)
- `name`/`card_name`은 kebab-case: `/^[a-z0-9][a-z0-9-]*[a-z0-9]$/` (2자 이상)
- 한번 등록된 key는 변경 불가. 변경이 필요하면 별도 도구로만 허용
- 본문 변경은 `register_spec` 재호출로 처리 (version append)

### 7.2 도구: `link_spec`

스펙과 코드 entity 사이에 `implements` 관계를 수동으로 생성한다.

#### 입력 스키마

```typescript
type LinkSpecInput = {
  /** 코드 entity key. 예: "symbol:packages/core/src/app.ts#createApplication" */
  codeEntityKey: string;
  /** 스펙/카드 entity key. 예: "claim::di-container/singleton" (권장) 또는 "spec::di-container" */
  specKey: string;
  /** 왜 이 코드가 이 스펙/카드를 구현하는지에 대한 근거 (필수) */
  rationale: string;
};
```

#### 동작 절차

**단일 트랜잭션**으로:

1. **코드 entity 존재 확인**
   - `entity_version`에서 `entity_key = codeEntityKey AND status = 'active'` 조회
   - 없으면: **에러 반환** + `search` 도구로 후보 추천
   - 있으면: `identity_id` 획득

2. **스펙/카드 entity 존재 확인**
   - `entity_identity`에서 `stable_key = specKey AND entity_type IN ('spec', 'claim')` 조회
   - 없으면: 에러 반환 ("먼저 register_spec으로 등록하세요")
   - **spec에 직접 link 시 경고**: `entity_type = 'spec'`이고 하위 claim이 존재하면 경고 반환: "이 spec에 카드가 있습니다. 카드 단위로 link하는 것을 권장합니다" (link은 생성)

2b. **스펙 active version 정보 수집**
   - spec identity의 active version 조회: `entity_version WHERE identity_id = spec.id AND status = 'active'`
   - `specVersionId`, `specVersionNum`, `specContentHash` 획득
   - active version 없으면: 에러 반환 ("All versions are archived for spec: {specKey}")

3. **앵커 정보 수집**

   코드 entity의 fact를 조회하여 앵커를 구성한다:

   ```typescript
   type LinkAnchor = {
     entityKey: string;
     symbolName: string | null;
     filePath: string;
     entityType: string;
     signatureText: string | null;
     symbolKind: string | null;
     versionId: number;
     contentHash: string | null;
   };
   ```

4. **Relation 생성**
   ```
   src_identity_id:   코드 entity의 identity_id
   dst_identity_id:   스펙 entity의 identity_id
   relation_type:     "implements"
   strength:          "manual"
   meta: {
     anchor: <LinkAnchor>,
     rationale: rationale,
     linkedAt: <ISO 8601>,
     linkedBy: "link_spec"
   }
   ```

5. **Rationale Fact 생성** (evidence용)
   ```
   version_id:    코드 entity의 active version id
   fact_type:     "manual_link"
   fact_key:      "manual_link:{specKey}"
   payload_text:  rationale
   payload_json:  { specKey, linkedAt, specVersionId }
   ```

6. **Evidence 연결**
   - `manual_link` fact를 `relation_evidence`에 연결

7. **Approval Event 기록**
   - `event_type: 'link_created'` 또는 `'link_updated'`
   - `target_relation_id`, `target_identity_id: code identity`
   - `payload`: spec version id, anchor 포함
   - `rationale`: 입력의 rationale

#### 출력 스키마

```typescript
type LinkSpecResult = {
  relationId: number;
  codeIdentityId: number;
  specIdentityId: number;
  approvalEventId: number;
  action: 'created' | 'updated';
};
```

### 7.3 relation.meta에 저장되는 앵커의 역할

앵커(`LinkAnchor`)는 두 가지 목적으로 사용된다:

1. **계층 1 이후 잔여 검증**: identity matching이 정상 수행되었는지 확인할 때 앵커의 `symbolName`과 실제 entity를 대조
2. **계층 2 (resolve_identity_candidates)의 검색 근거**: archived version의 fact에 접근하지 않고도, relation.meta만으로 후보 검색 가능

**핵심**: 앵커는 **링크 생성 시점에 한 번만 기록**된다. version이 archived/삭제되어도 앵커 정보는 relation.meta에 보존된다.

### 7.4 도구: `relate_specs`

스펙/카드 간의 `depends_on` 또는 `extends` 관계를 수동으로 생성한다.

#### 입력 스키마

```typescript
type RelateSpecsInput = {
  /** 소스 스펙/카드 키. 예: "spec::billing" 또는 "claim::billing/payment" */
  srcKey: string;
  /** 대상 스펙/카드 키. 예: "spec::auth" 또는 "claim::auth/login" */
  dstKey: string;
  /** 관계 유형: "depends_on" | "extends" */
  relationType: 'depends_on' | 'extends';
  /** 관계 설정 이유 (필수) */
  rationale: string;
};
```

#### 동작 절차

**단일 트랜잭션**으로:

1. **입력 검증**
   - `relationType`이 `'depends_on'` 또는 `'extends'`가 아니면: 에러 "relationType must be 'depends_on' or 'extends'"
   - `srcKey`와 `dstKey`가 동일하면: 에러 "Self-reference not allowed"

2. **소스 entity 존재 확인**
   - `entity_identity`에서 `stable_key = srcKey AND entity_type IN ('spec', 'claim')` 조회
   - 없으면: 에러 "Source spec not found: {srcKey}. 먼저 register_spec으로 등록하세요"
   - `srcIdentityId` 획득

3. **대상 entity 존재 확인**
   - `entity_identity`에서 `stable_key = dstKey AND entity_type IN ('spec', 'claim')` 조회
   - 없으면: 에러 "Destination spec not found: {dstKey}. 먼저 register_spec으로 등록하세요"
   - `dstIdentityId` 획득

4. **순환 의존 검사** (`depends_on` 전용)
   - `dstIdentityId` → `srcIdentityId` 방향으로 기존 `depends_on` relation 체인을 BFS 탐색
   - 탐색 중 `srcIdentityId`에 도달하면: 에러 "Circular dependency detected: {cycle_path}"
   - 탐색 깊이 제한: 최대 50 (무한 루프 방어)
   - `extends`는 순환 검사 생략 (위임 관계는 순환 허용)

5. **기존 relation 확인 (upsert)**
   - 동일 `src_identity_id + dst_identity_id + relation_type` 조합이 이미 존재하면:
     - `meta` 갱신 (rationale, updatedAt)
     - approval_event `spec_relation_updated` 생성 (payload에 `previousMeta` 포함)
   - 없으면: 새 relation 생성 → 6단계

6. **Relation 생성**
   ```
   src_identity_id:   srcIdentityId
   dst_identity_id:   dstIdentityId
   relation_type:     relationType ("depends_on" | "extends")
   strength:          "manual"
   meta: {
     rationale: rationale,
     createdBy: "relate_specs",
     createdAt: <ISO 8601>
   }
   ```

7. **Approval Event 기록**
   - `event_type: 'spec_relation_created'` (신규) 또는 `'spec_relation_updated'` (갱신)
   - `target_relation_id`: 생성/갱신된 relation의 id
   - `target_identity_id`: srcIdentityId
   - `payload`: { srcKey, dstKey, relationType, rationale, dstIdentityId }

8. **Entity Lifecycle 기록**
   - srcIdentity에 `event_type: 'updated'` 기록 (meta: { action: 'relate_specs', dstKey })

#### 출력 스키마

```typescript
type RelateSpecsResult = {
  relationId: number;
  srcIdentityId: number;
  dstIdentityId: number;
  relationType: 'depends_on' | 'extends';
  approvalEventId: number;
  action: 'created' | 'updated';
};
```

### 7.5 도구: `spec_impact`

특정 스펙/카드 변경 시 영향받는 코드·스펙·카드 목록을 재귀적으로 탐색한다.

#### 입력 스키마

```typescript
type SpecImpactInput = {
  /** 분석 대상 스펙/카드 키 */
  specKey: string;
  /** 탐색 깊이 제한 (기본값: 3, 최대: 10) */
  depth?: number;
  /** 포함할 관계 유형 (기본값: 모두) */
  relationTypes?: ('implements' | 'depends_on' | 'extends' | 'contains')[];
};
```

#### 동작 절차

1. **대상 entity 확인**
   - `entity_identity`에서 `stable_key = specKey` 조회
   - 없으면: 에러 "Spec not found: {specKey}"
   - `targetIdentityId` 획득

2. **BFS 재귀 탐색**
   - 시작 노드: `targetIdentityId`
   - 탐색 방향: 해당 identity가 `dst_identity_id`인 relation을 찾음 (역방향 = "나를 참조하는 것")
   - 각 단계에서:
     a. `relation` 테이블에서 `dst_identity_id = currentId` 조회
     b. `relationTypes` 필터 적용
     c. `src_identity_id`를 다음 탐색 노드에 추가
   - 방문 노드 추적 (중복 방지)
   - 깊이 제한 도달 시 탐색 중단 + `truncated: true` 표시

3. **결과 분류**
   - 탐색된 entity를 `entity_type`으로 분류:
     - `module`/`symbol` → `impactedCode[]`
     - `spec` → `impactedSpecs[]`
     - `claim` → `impactedClaims[]`

4. **각 항목에 경로 정보 포함**
   - `path`: 시작 노드에서 해당 노드까지의 relation chain

#### 출력 스키마

```typescript
type SpecImpactResult = {
  specKey: string;
  depth: number;
  truncated: boolean;
  impactedCode: Array<{
    entityKey: string;
    identityId: number;
    relationType: string;
    path: string[];   // e.g. ["spec::auth", "claim::auth/login", "symbol:...#LoginService"]
  }>;
  impactedSpecs: Array<{
    specKey: string;
    identityId: number;
    relationType: string;
    path: string[];
  }>;
  impactedClaims: Array<{
    claimKey: string;
    identityId: number;
    relationType: string;
    parentSpecKey: string;
    path: string[];
  }>;
  summary: {
    totalImpacted: number;
    codeCount: number;
    specCount: number;
    claimCount: number;
  };
};
```

### 7.6 도구: `kb_status`

KB의 전체 또는 특정 스펙 범위의 건강 상태 대시보드를 반환한다.

#### 입력 스키마

```typescript
type KBStatusInput = {
  /** 특정 스펙 범위로 한정 (선택). 생략 시 전체 KB */
  specKey?: string;
};
```

#### 동작 절차

1. **범위 결정**
   - `specKey` 제공 시: 해당 spec + 하위 claim만 대상
   - 미제공 시: 전체 workspace 대상

2. **스펙/카드 집계**
   ```sql
   -- 전체 모드
   SELECT entity_type, COUNT(*) FROM entity_identity ei
   JOIN entity_version ev ON ev.identity_id = ei.id AND ev.status = 'active'
   WHERE ei.entity_type_id IN (spec_type_id, claim_type_id)
   GROUP BY entity_type;
   ```
   - `specKey` 지정 시: 해당 spec identity + `contains` relation으로 연결된 claim identity만 집계

3. **커버리지 계산**
   - `implements` relation이 있는 claim 수 / 전체 claim 수 × 100
   - spec 단위: 하위 claim 기준으로 재귀 집계

4. **링크 상태 집계**
   - `brokenLinks`: active version이 없는 identity에 `strength='manual'` relation이 있는 경우
   - `staleLinks`: `inconsistency_report`의 `stale_link_after_spec_update` 검사 결과
   - `totalLinks`: `strength='manual'` relation 총 수

5. **최근 활동**
   - 최근 7일 내 `approval_event` 수
   - 최근 `sync_run` 정보

#### 출력 스키마

```typescript
type KBStatusResult = {
  scope: 'global' | string;  // 'global' 또는 specKey
  specs: {
    total: number;
    withClaims: number;   // claim이 1개 이상인 spec 수
  };
  claims: {
    total: number;
    linked: number;       // implements relation이 있는 claim 수
    unlinked: number;
  };
  coverage: {
    percent: number;      // linked / total × 100 (소수점 1자리)
    bySpec: Array<{       // specKey 모드에서만 포함
      specKey: string;
      totalClaims: number;
      linkedClaims: number;
      coveragePercent: number;
    }>;
  };
  links: {
    total: number;
    broken: number;
    stale: number;
    healthy: number;      // total - broken - stale
  };
  recentActivity: {
    approvalEventsLast7d: number;
    lastSyncRun: string | null;  // ISO 8601
  };
};
```

---

## 8. 계층 2: Identity Resolution (인간 승인 기반)

### 8.1 대상 케이스

계층 1(content_hash identity matching)이 커버하지 못하는 경우:

| 케이스 | 왜 자동 실패하는가 |
|--------|-------------------|
| 파일 이동 + 내용 변경 | content_hash 불일치 |
| 파일 분리 (1 → N) | 1:N 매칭으로 자동 금지 |
| 파일 통합 (N → 1) | N:1 매칭으로 자동 금지 |
| 심볼 리네임 (파일 내) | entity_key의 `#` 이후 부분 변경. 별도 identity 생성됨 |

### 8.2 도구: `resolve_identity_candidates`

깨진 링크(relation이 참조하는 identity에 active version이 없는 경우)를 감지하고, **후보 entity 목록을 반환**한다. 자동 적용 없음.

#### 입력 스키마

```typescript
type ResolveIdentityCandidatesInput = {
  specKey?: string;
  maxCandidates?: number;  // default: 5
};
```

#### 동작 절차

1. `relation`에서 `strength = 'manual' AND relation_type = 'implements'`인 관계를 조회
2. 각 관계의 `src_identity_id`가 가리키는 identity에 `status='active'`인 version이 없으면 → **깨진 링크**
3. 깨진 링크의 `relation.meta.anchor`를 기반으로 후보 검색:
   - `meta.anchor.symbolName`으로 **기존 FTS 인프라** 활용: `fact.payload_tsv @@ plainto_tsquery(symbolName)` + `ts_rank_cd`로 관련도 정렬
   - `entity_type` 필터 (같은 타입만)
   - `status = 'active'`인 version이 있는 identity만
4. 결과를 반환 (자동 적용 없음)

#### 출력 스키마

```typescript
type CandidateScore = {
  /** 최종 합산 점수 (0.0 ~ 1.0). 내림차순 정렬 기준 */
  total: number;
  /** 구성요소별 점수 (각 0.0 ~ 1.0) */
  components: {
    /** symbolName 일치도 (exact=1.0, prefix=0.7, fuzzy=0.3~0.6) */
    symbolNameMatch: number;
    /** entityType 일치 (same=1.0, different=0.0) */
    entityTypeMatch: number;
    /** content 유사도 (FTS ts_rank_cd 정규화) */
    contentSimilarity: number;
    /** 파일 경로 근접도 (같은 디렉토리=1.0, 같은 패키지=0.5, 다른 패키지=0.1) */
    pathProximity: number;
  };
};

type ResolveIdentityCandidatesResult = {
  brokenLinks: Array<{
    relationId: number;
    specKey: string;
    originalEntityKey: string;  // from anchor
    anchor: LinkAnchor;
    candidates: Array<{
      identityId: number;
      entityKey: string;       // current active version's key
      entityType: string;
      summary: string | null;
      matchReason: string;
      score: CandidateScore;   // 구성요소별 점수 포함
    }>;
  }>;
  totalBroken: number;
};
```

> **점수 규칙**: `total`은 구성요소의 가중 합산이다. 가중치는 운영 경험에 따라 조정하되, 초기값은 `symbolNameMatch: 0.4, entityTypeMatch: 0.2, contentSimilarity: 0.25, pathProximity: 0.15`로 시작한다. 가중치 변경은 코드 변경 없이 config로 조정 가능하게 한다.

### 8.3 도구: `apply_identity_rewrite`

사용자가 `resolve_identity_candidates`의 결과를 검토하고, 승인한 매칭을 적용한다.

#### 입력 스키마

```typescript
type ApplyIdentityRewriteInput = {
  rewrites: Array<{
    relationId: number;
    newIdentityId: number;  // v2: identity id를 직접 지정
  }>;
};
```

#### 동작 절차

각 rewrite 항목에 대해 **단일 트랜잭션**으로:

1. `newIdentityId`로 identity 조회 → active version 존재 확인
2. relation의 `src_identity_id`를 `newIdentityId`로 UPDATE
3. `relation.meta`에 마이그레이션 기록 추가:
   ```json
   {
     "migratedFrom": { "identityId": 42, "entityKey": "symbol:old_path#foo" },
     "migratedAt": "2026-02-10T...",
     "migratedBy": "apply_identity_rewrite"
   }
   ```
4. **Approval Event 기록**: `event_type: 'identity_rewritten'`
5. **Evidence 재연결** (append-only 정책):
   - 기존 evidence 유지
   - 새 identity의 active version의 관련 fact를 evidence에 추가
   - `ON CONFLICT DO NOTHING`
6. **Entity Lifecycle 기록**: 옛 identity에 `event_type: 'superseded'`, 새 identity에 `event_type: 'merged'` (해당 relation 기준)

#### 충돌 처리

relation unique constraint: `(src_identity_id, dst_identity_id, relation_type_id, strength_type_id)`

이미 존재하면:
- 기존 relation의 `meta`를 병합 (rationale 보존)
- 중복 relation 미생성
- 옛 relation의 `meta`에 `{ supersededBy: newRelationId }` 표시
- approval_event에 충돌 사실 기록

#### 출력 스키마

```typescript
type ApplyIdentityRewriteResult = {
  applied: number;
  skipped: number;
  details: Array<{
    relationId: number;
    approvalEventId: number;
    status: 'applied' | 'skipped_already_exists' | 'skipped_identity_not_found';
    newIdentityId?: number;
  }>;
};
```

---

## 9. Sync Worker 변경

### 9.1 Core Loop 변경

v1의 sync core loop은 entity_key rewrite 중심이었다. v2에서는 **version append** 중심이다.

#### `startupScan()` 흐름

```
scanFiles()
  → DB의 active version과 교차 비교
  → disappearedVersions (DB에 있지만 파일시스템에 없는 active version)
  → newFiles (파일시스템에 있지만 DB에 active version이 없는 파일)
  → content_hash 1:1 매칭
    → 매칭 성공: 기존 version archived, 같은 identity에 새 version active
    → 매칭 실패: 기존 version archived, 새 identity + 새 version 생성
  → 변경/신규 파일 enqueue (파싱 대상)
```

#### `processFile()` (watch/개별 파일)

```
파일 내용 파싱
  → content_hash 계산
  → DB에서 동일 entity_key의 active version 검색
    → 있으면: version의 fact/relation을 upsert (기존과 동일)
    → 없으면:
      → content_hash로 archived version 검색 (identity matching)
        → 매칭 성공: 같은 identity에 새 version 생성
        → 매칭 실패: 새 identity + 새 version 생성
```

#### `handleDeletedFile()`

```
해당 파일의 active version을 status='archived'로 전이
entity_lifecycle에 event_type='archived' 기록
```

**grace window가 불필요한 이유**: archived version의 identity는 살아있고, relation은 identity를 참조한다. 이후 CREATE 이벤트에서 content_hash 매칭이 성공하면 같은 identity에 새 version이 추가된다.

### 9.2 Orphan Cleanup

#### Fact Orphan Cleanup

기존 `deleteOrphanFacts`와 동일하되, version 기준:
- 파서가 현재 파싱에서 생성한 fact를 `retainedFacts` 집합으로 추적
- 해당 version의 fact 중 `retainedFacts`에 없는 것을 삭제

#### Relation Orphan Cleanup

`deleteOrphanRelations` 추가. **삭제 범위는 identity 전체가 아니라, 현재 파싱 파일이 담당하는 relation namespace로 한정한다.**

```
scope = "이번 sync에서 파싱한 파일(entity_key)이 source로 생성한 relation"
```

동작 절차:
1. 파서가 현재 파싱에서 생성/확인한 relation을 `retainedRelations` 집합으로 추적
2. **범위 한정**: 삭제 후보는 다음 조건을 **모두** 만족하는 relation만:
   - `src_identity_id`가 현재 파싱 대상 identity와 같음
   - relation이 **현재 파싱된 version의 entity_key에서 유래**한 것 (relation.meta.sourceFile == 현재 파싱 파일 경로)
   - `retainedRelations`에 포함되지 않음
   - `strength != 'manual'`
3. **`strength = 'manual'`인 relation은 절대 삭제하지 않음**
4. 다른 version(같은 identity의 과거 경로 등)에서 생성된 relation은 이 cleanup에서 건드리지 않음

**설계 근거**: identity는 여러 version(= 여러 파일 경로)을 가질 수 있다. 파일 `b.ts`를 파싱할 때, 과거 경로 `a.ts`에서 생성된 relation을 삭제하면 오탐이 된다. 따라서 cleanup 범위는 반드시 "현재 파싱 파일이 책임지는 relation"으로 좁혀야 한다.

> **구현 힌트**: `relation.meta`에 `sourceFile` (또는 `sourceVersionId`)을 기록하여 어떤 파일/version에서 생성된 relation인지 추적한다. 이 필드는 자동 생성 relation에만 적용되며, manual relation에는 불필요하다.

### 9.3 `__manual__/` 경로 정합성 정책

`__manual__/` prefix는 파일시스템에 실제 파일이 존재하지 않는 **가상 경로**이다.

#### 필터링 레이어 및 우선순위

`__manual__/` 경로의 차단은 **최하위 레이어(가장 이른 시점)**에서 수행하여 상위 레이어에 영향이 전파되지 않도록 한다.

```
[L1] Watcher (fs.watch callback)
  → __manual__/ 경로의 파일시스템 이벤트가 올 수 없음 (가상 경로이므로)
  → 만약 도달하면: early return, 로그 경고

[L2] Sync Queue (addToQueue / processQueue)
  → entity_key가 __manual__/로 시작하는 항목: enqueue 거부
  → 이미 큐에 있는 경우: dequeue 시 skip + 로그 경고

[L3] Sync Worker (processFile)
  → entity_key 체크: __manual__/ prefix → early return
  → 이 레이어는 L2의 방어가 실패했을 때의 fallback

[L4] startupScan (scanFiles → disappearedVersions)
  → entity_version.entity_key가 __manual__/로 시작하면: disappearedVersions에서 제외
  → archived 후보에서도 제외

[L5] Read-Through Stale 검증 (isStale 함수)
  → source.file_path가 __manual__/로 시작하면: always return false (fresh)
```

| 레이어 | 지점 | 처리 | 우선순위 |
|--------|------|------|----------|
| L1 | Watcher | 불가능/early return | 1 (최우선) |
| L2 | Sync Queue | enqueue 거부 | 2 |
| L3 | Sync Worker | early return (fallback) | 3 |
| L4 | startupScan | archived 대상 제외 | 4 |
| L5 | Read-Through | always fresh | 5 |

> **구현 힌트**: `isManualPath(path: string): boolean` 유틸 함수를 한 곳에 정의하고, 모든 레이어에서 재사용한다.

### 9.4 `sync_event.action` 확장

| 기존 값 | 새로 추가 |
|---------|-----------|
| `created`, `updated`, `deleted`, `restored` | **`renamed`**, **`archived`**, **`merged`** |

`SyncAction` 타입을 **한 곳에서만 정의**한다:

```typescript
// sync-event-repo.ts (단일 정의)
export type SyncAction = 'created' | 'updated' | 'deleted' | 'restored' | 'renamed' | 'archived' | 'merged';
```

`kb.ts`에서는 re-export:
```typescript
export type { SyncAction } from './repo/sync-event-repo.js';
```

---

## 10. Purge/Archive 모델

### 10.1 v1과의 차이

| 관점 | v1 | v2 |
|------|----|----|
| purge 대상 | `is_deleted = true`인 entity | `status = 'archived'`인 version (identity와 분리) |
| purge 결과 | entity 물리 삭제 → relation cascade 소실 | version 물리 삭제. identity와 relation은 유지 |
| manual link 보호 | 복잡한 NOT EXISTS 조건 | **불필요** (identity가 존재하는 한 relation 유지) |

### 10.2 Version Purge

```sql
-- Step 1: evidence snapshot 보존 (fact 삭제 전에 수행)
UPDATE relation_evidence re
SET evidence_snapshot = jsonb_build_object(
      'factKey', f.fact_key,
      'factPayload', f.payload,
      'entityKey', ev.entity_key,
      'contentHash', ev.content_hash
    ),
    is_active = false
FROM fact f
JOIN entity_version ev ON ev.id = f.version_id
WHERE re.fact_id = f.id
  AND ev.status = 'archived'
  AND ev.created_at < now() - {olderThanDays} * interval '1 day'
  AND re.evidence_snapshot IS NULL;  -- 아직 snapshot 안 된 것만

-- Step 2: archived version 삭제
DELETE FROM entity_version
WHERE status = 'archived'
  AND created_at < now() - {olderThanDays} * interval '1 day';
```

archived version이 삭제되어도:
- `entity_identity`는 유지 → relation 유지
- 해당 version에 연결된 fact/source는 FK cascade로 삭제됨 (이력 데이터 정리)
- **relation_evidence는 보존됨**: fact_id는 SET NULL이 되지만, evidence_snapshot에 내용이 남아 감사 가능
- 다른 version(active)이 있으면 해당 identity는 여전히 "살아있음"

### 10.3 Identity Purge

모든 version이 purge되어 "version이 하나도 없는 identity"가 된 경우.

**Purge 기준**: `entity_identity.created_at`이 아니라 **마지막 active version을 상실한 시점**을 사용한다. 이는 `entity_lifecycle` 테이블에서 해당 identity의 마지막 이벤트 시각으로 판단한다.

```sql
DELETE FROM entity_identity ei
WHERE NOT EXISTS (
  SELECT 1 FROM entity_version ev
  WHERE ev.identity_id = ei.id
)
AND (
  -- lifecycle 기록이 있으면: 마지막 이벤트가 olderThanDays 이전
  SELECT MAX(el.created_at) FROM entity_lifecycle el
  WHERE el.identity_id = ei.id
) < now() - {olderThanDays} * interval '1 day'
```

> **fallback**: lifecycle 기록이 없는 identity (migration 직후 등)는 `ei.created_at`을 사용한다.

이 때 identity가 삭제되면 relation도 FK cascade로 삭제된다.

**보호 조건**: `strength = 'manual'`인 relation이 참여하는 identity는 purge하지 않는다:

```sql
AND NOT EXISTS (
  SELECT 1 FROM relation r
  JOIN strength_type st ON st.id = r.strength_type_id
  WHERE (r.src_identity_id = ei.id OR r.dst_identity_id = ei.id)
    AND st.name = 'manual'
)
```

### 10.4 보호 해제 경로

v1과 동일한 원칙:

| 해제 조건 | 설명 |
|-----------|------|
| `apply_identity_rewrite`로 relation 이전 | 옛 identity에 manual relation이 없어지면 purge 가능 |
| `rollback_approval`로 `link_created` 이벤트 롤백 → relation 삭제 | 보호 해제 |
| `superseded` relation의 strength 격하 | `'inferred'`로 변경 시 보호 해제 |

TTL 자동 해제는 도입하지 않는다.

---

## 11. 기존 도구 호환성 및 영향도

### 11.1 쿼리 변경 원칙

기존 도구들이 `entity.id`를 사용하던 곳을 `entity_identity.id` + `entity_version`으로 변경해야 한다.

**공통 패턴**: "active version 기준 조회"

```sql
-- v1
SELECT e.* FROM entity e WHERE e.entity_key = 'module:...'

-- v2
SELECT ev.*, ei.id as identity_id
FROM entity_version ev
JOIN entity_identity ei ON ei.id = ev.identity_id
WHERE ev.entity_key = 'module:...'
  AND ev.status = 'active'
```

### 11.2 도구별 영향도

| 도구 | 영향 수준 | 변경 내용 |
|------|-----------|-----------|
| `search` | 중 | entity_version 조회로 변경 |
| `describe` | 중 | identity + active version JOIN |
| `facts` | 중 | version 기준 fact 조회 |
| `relations` | 중 | identity 기준 relation 조회 |
| `impact_analysis` | 중 | relation FK가 identity 참조로 변경 |
| `dependency_graph` | 중 | 동일 |
| `trace_chain` | 중 | 동일 |
| `coverage_map` | 중 | relation + identity JOIN |
| `inconsistency_report` | 중 | "active version 없는 identity" 검사 추가 |
| `evidence` | **중** | relation_evidence 구조 변경 (version_id, is_active, evidence_snapshot 추가). 기본 조회는 `is_active=true` 필터, `includeHistory` 옵션 추가 |
| `bulk_describe` | 중 | describe와 동일 |
| `bulk_facts` | 중 | facts와 동일 |
| `recent_changes` | 중 | sync_event가 identity_id를 참조 |
| `changelog` | 중 | 동일 |
| `find_orphans` | 중 | "version 없는 identity" 패턴 추가 |
| `verify_integrity` | 중 | 새 테이블 간 FK 정합성 검사 추가 |
| `sync` | 높음 | core loop 재작성 (§9 참조) |
| `purge_tombstones` | 높음 | version purge + identity purge 이중 구조 (§10 참조) |
| **`relate_specs`** | **신규** | spec↔spec / claim↔claim 간 `depends_on`, `extends` relation 생성 도구 (§5.3) |
| **`spec_impact`** | **신규** | 특정 spec/claim 변경 시 영향받는 코드·spec·claim 목록을 반환하는 분석 도구 |
| **`kb_status`** | **신규** | KB 전체 대시보드: spec 수, claim 수, 링크 수, 커버리지 비율, stale link 수 등 요약 |

### 11.3 `coverage_map` 상세

**기본 쿼리** (spec 직접 링크):

```sql
-- v2
SELECT ... FROM relation r
JOIN entity_identity ei ON ei.id = r.src_identity_id
JOIN entity_version ev ON ev.identity_id = ei.id AND ev.status = 'active'
WHERE r.dst_identity_id = {spec_identity_id}
  AND rt.name = 'implements'
```

**재귀 claim 집계** (카드 모델 지원):

spec이 하위 claim을 가질 경우, `contains` relation을 따라 재귀적으로 claim을 수집한 뒤 각 claim에 대한 implements 링크를 집계한다.

```sql
-- claim 재귀 수집 (spec → claim hierarchy)
WITH RECURSIVE claim_tree AS (
  -- base: 직접 하위 claim
  SELECT r.dst_identity_id AS claim_id
  FROM relation r
  JOIN relation_type rt ON rt.id = r.relation_type_id
  WHERE r.src_identity_id = {spec_identity_id}
    AND rt.name = 'contains'
  UNION ALL
  -- recursive: claim의 하위 claim (중첩 claim 지원)
  SELECT r.dst_identity_id
  FROM relation r
  JOIN relation_type rt ON rt.id = r.relation_type_id
  JOIN claim_tree ct ON ct.claim_id = r.src_identity_id
  WHERE rt.name = 'contains'
)
SELECT
  ct.claim_id,
  ev.entity_key AS claim_key,
  COUNT(impl.id) AS linked_code_count
FROM claim_tree ct
JOIN entity_version ev ON ev.identity_id = ct.claim_id AND ev.status = 'active'
LEFT JOIN relation impl ON impl.dst_identity_id = ct.claim_id
  AND impl.relation_type_id = (SELECT id FROM relation_type WHERE name = 'implements')
GROUP BY ct.claim_id, ev.entity_key;
```

**집계 규칙**:
- `linked_code_count = 0`인 claim → **미커버**
- spec 커버리지 = (코드 링크 1건 이상인 claim 수) / (전체 claim 수) × 100%
- claim이 없는 spec → spec 직접 링크 기준으로 covered/uncovered 판정

### 11.4 `inconsistency_report` 추가 검사 항목

| 검사 | 설명 |
|------|------|
| `identity_no_active_version` | active version이 없는 identity (모두 archived) |
| `orphan_version` | identity가 없는 version (FK 무결성 위반) |
| `manual_relation_archived_identity` | manual relation이 참조하는 identity에 active version이 없음 → 깨진 링크 후보 |
| `stale_link_after_spec_update` | spec body가 갱신(version_num 증가)된 후 기존 claim 링크가 아직 구 버전 기준 → 재검토 필요 |
| `claim_without_parent` | `entity_type = 'claim'`이지만 `contains` relation의 대상(dst)이 아닌 고아 claim |
| `spec_with_claims_direct_link` | claim이 있는 spec에 직접 `implements` 링크 존재 → claim 레벨로 분해 권장 |

---

## 12. 에러 및 예외 처리

### 12.1 `register_spec` 에러

**입력 검증**:
| 검증 | 규칙 | 에러 메시지 |
|------|------|-------------|
| `specKey` prefix | `specKey.startsWith('spec::')` 또는 `specKey.startsWith('claim::')` | "specKey must start with 'spec::' or 'claim::'" |
| `specKey` name (spec) | `/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(name)` (2자 이상) | "specKey name must be kebab-case" |
| `specKey` name (claim) | `/^[a-z0-9][a-z0-9-]*[a-z0-9]\/[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(name)` (각 부분 2자 이상, `-`로 끝나지 않음) | "claim key must be 'claim::{spec}/{card}' format" |
| `parentSpecKey` (claim) | claim 인 경우 필수, `spec::` prefix | "parentSpecKey is required for claim entities" |
| `parentSpecKey` (spec) | spec 인 경우 제공하면 에러 | "parentSpecKey is not allowed for spec entities" |
| `summary` 길이 | `1 ≤ length ≤ 500` | "summary must be 1-500 characters" |
| `body` 길이 | `1 ≤ length ≤ 50000` | "body must be 1-50000 characters" |

**런타임 에러**:
| 상황 | 처리 |
|------|------|
| DB 트랜잭션 실패 | 에러 전파. 부분 커밋 없음 (단일 트랜잭션) |

### 12.2 `link_spec` 에러

**입력 검증**:
| 검증 | 규칙 | 에러 메시지 |
|------|------|-------------|
| `codeEntityKey` prefix | `module:` 또는 `symbol:` 시작 | "codeEntityKey must start with 'module:' or 'symbol:'" |
| `specKey` prefix | `spec::` 또는 `claim::` 시작 (권장: `claim::`) | "specKey must start with 'spec::' or 'claim::'" |
| `rationale` 길이 | `1 ≤ length ≤ 5000` | "rationale must be 1-5000 characters" |

**런타임 에러**:
| 상황 | 처리 |
|------|------|
| `codeEntityKey`에 해당하는 active version 없음 | 에러 반환 + search로 유사 entity 추천 |
| `specKey`에 해당하는 spec/claim identity 없음 | 에러 반환: "Spec/Claim not found. Use register_spec first." |
| `codeEntityKey`의 모든 version이 archived | 에러 반환: "All versions are archived. Run sync first or check the entity key." |
| 이미 동일 링크가 존재 | upsert: meta 갱신. approval_event `'link_updated'` |
| `spec::` 대상이 claim을 보유한 spec | **경고** 반환: "This spec has N claims. Consider linking to a specific claim instead." (link은 생성됨) |

### 12.3 `resolve_identity_candidates` 에러

| 상황 | 처리 |
|------|------|
| 깨진 링크가 없음 | `{ brokenLinks: [], totalBroken: 0 }` 반환 |
| 특정 `specKey`에 해당하는 spec이 없음 | 에러 반환: "Spec not found: {specKey}" |

### 12.4 `apply_identity_rewrite` 에러

**입력 검증**:
| 검증 | 규칙 | 에러 메시지 |
|------|------|-------------|
| `rewrites` 배열 | `minItems: 1` | MCP SDK 레벨 거부 |
| `newIdentityId` | 양의 정수 | "newIdentityId must be a positive integer" |
| `relationId` | 양의 정수 | "relationId must be a positive integer" |

**런타임 에러**:
| 상황 | 처리 |
|------|------|
| `newIdentityId`에 active version 없음 | skip, `'skipped_identity_not_found'` |
| `relationId` 유효하지 않음 | skip, `'skipped_relation_not_found'` |
| unique constraint 충돌 | meta 병합, 옛 relation에 `supersededBy` |

### 12.5 `rollback_approval` 에러

| 상황 | 처리 |
|------|------|
| `approvalEventId` 유효하지 않음 | 에러 반환: "Approval event not found" |
| 이미 롤백된 이벤트 | 에러 반환: "Event already rolled back" |
| 대상 relation/identity가 이미 삭제됨 | skip + 경고 반환 |

### 12.6 content_hash identity matching 에러

| 상황 | 처리 |
|------|------|
| 1:N 매칭 | 자동 매칭 금지. 각각 새 identity 생성 |
| N:1 매칭 | 자동 매칭 금지. 새 identity 생성 |
| 매칭 트랜잭션 실패 | archived + 새 identity 생성 fallback |

### 12.7 `relate_specs` 에러

**입력 검증**:
| 검증 | 규칙 | 에러 메시지 |
|------|------|-------------|
| `srcKey` prefix | `spec::` 또는 `claim::` | "srcKey must start with 'spec::' or 'claim::'" |
| `dstKey` prefix | `spec::` 또는 `claim::` | "dstKey must start with 'spec::' or 'claim::'" |
| `relationType` | `'depends_on'` 또는 `'extends'` | "relationType must be 'depends_on' or 'extends'" |
| 순환 검사 | srcKey → dstKey 경로에 역방향 관계 존재 시 | "Circular dependency detected: {path}" |

**런타임 에러**:
| 상황 | 처리 |
|------|------|
| src 또는 dst identity 없음 | 에러 반환: "Entity not found: {key}" |
| 동일 relation 이미 존재 | upsert: meta 갱신. approval_event `'spec_relation_updated'` |
| 자기 자신에게 링크 | 에러 반환: "Cannot relate entity to itself" |

### 12.8 `spec_impact` 에러

| 상황 | 처리 |
|------|------|
| 대상 spec/claim identity 없음 | 에러 반환: "Entity not found: {key}" |
| 대상이 spec/claim이 아님 | 에러 반환: "spec_impact only supports spec/claim entities" |
| 영향 범위 없음 | `{ impactedCode: [], impactedSpecs: [], impactedClaims: [], totalImpact: 0 }` 반환 |

### 12.9 `kb_status` 에러

| 상황 | 처리 |
|------|------|
| workspace 없음 | 에러 반환: "No workspace found. Run sync first." |
| DB 연결 실패 | 에러 전파 + 연결 상태 정보 포함 |

---

## 13. MCP 도구 등록

`server.ts`의 `TOOL_DEFINITIONS`에 다음 8개 도구를 추가한다:

### 13.1 `register_spec`

```typescript
{
  name: 'register_spec',
  description: 'Register or update a spec/claim entity in the KB. Stores a feature specification (spec) or an atomic requirement card (claim). If the key already exists, updates the body/summary (creates a new version). For claims, parentSpecKey is required.',
  inputSchema: {
    type: 'object',
    properties: {
      specKey: { type: 'string', minLength: 1, description: 'Spec key: "spec::{name}" or Claim key: "claim::{spec_name}/{claim_name}". Example: "spec::di-container" or "claim::di-container/constructor-injection"' },
      summary: { type: 'string', minLength: 1, description: 'Spec/Claim summary (1-2 lines)' },
      body: { type: 'string', minLength: 1, description: 'Spec/Claim body (markdown). For claims, BDD format recommended (Given/When/Then)' },
      meta: { type: 'object', description: 'Additional metadata (optional)' },
      parentSpecKey: { type: 'string', description: 'Required for claim entities. The parent spec key ("spec::{name}"). Auto-creates contains relation.' },
    },
    required: ['specKey', 'summary', 'body'],
    additionalProperties: false,
  },
}
```

### 13.2 `link_spec`

```typescript
{
  name: 'link_spec',
  description: 'Create a manual implements relation between a code entity and a spec/claim. Accepts both spec:: and claim:: keys (claim:: recommended for fine-grained tracking). Records rationale as relation_evidence. All state changes are tracked via approval_event.',
  inputSchema: {
    type: 'object',
    properties: {
      codeEntityKey: { type: 'string', minLength: 1, description: 'Code entity key. Example: "symbol:packages/core/src/app.ts#createApplication"' },
      specKey: { type: 'string', minLength: 1, description: 'Spec or Claim entity key. Example: "claim::di-container/constructor-injection" (recommended) or "spec::di-container"' },
      rationale: { type: 'string', minLength: 1, description: 'Why this code implements this spec/claim' },
    },
    required: ['codeEntityKey', 'specKey', 'rationale'],
    additionalProperties: false,
  },
}
```

### 13.3 `resolve_identity_candidates`

```typescript
{
  name: 'resolve_identity_candidates',
  description: 'Detect broken spec-code links (code identity has no active version) and return candidate replacements. Does not auto-apply. Use apply_identity_rewrite to apply approved matches.',
  inputSchema: {
    type: 'object',
    properties: {
      specKey: { type: 'string', description: 'Check a specific spec only. Omit to scan all broken links.' },
      maxCandidates: { type: 'integer', minimum: 1, maximum: 20, default: 5, description: 'Max candidates per broken link' },
    },
    additionalProperties: false,
  },
}
```

### 13.4 `apply_identity_rewrite`

```typescript
{
  name: 'apply_identity_rewrite',
  description: 'Apply approved identity matches from resolve_identity_candidates. Relinks the relation to a new identity. Creates an approval_event for auditability and reversibility.',
  inputSchema: {
    type: 'object',
    properties: {
      rewrites: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            relationId: { type: 'integer', description: 'Broken relation id' },
            newIdentityId: { type: 'integer', description: 'New identity id to link to' },
          },
          required: ['relationId', 'newIdentityId'],
        },
        minItems: 1,
        description: 'Approved matches to apply',
      },
    },
    required: ['rewrites'],
    additionalProperties: false,
  },
}
```

### 13.5 `rollback_approval`

```typescript
{
  name: 'rollback_approval',
  description: 'Undo a previous approval event (link creation, identity rewrite, etc). Creates a compensating event and restores the prior state. The rollback itself is recorded as an approval_event.',
  inputSchema: {
    type: 'object',
    properties: {
      approvalEventId: { type: 'integer', description: 'ID of the approval_event to undo' },
      reason: { type: 'string', minLength: 1, description: 'Why this action is being rolled back' },
    },
    required: ['approvalEventId', 'reason'],
    additionalProperties: false,
  },
}
```

### 13.6 `relate_specs`

```typescript
{
  name: 'relate_specs',
  description: 'Create a relation between two spec/claim entities. Supports depends_on and extends relation types. Used to model spec-to-spec and claim-to-claim dependencies.',
  inputSchema: {
    type: 'object',
    properties: {
      srcKey: { type: 'string', minLength: 1, description: 'Source spec/claim key. Example: "spec::auth" or "claim::auth/jwt-validation"' },
      dstKey: { type: 'string', minLength: 1, description: 'Destination spec/claim key. Example: "spec::crypto" or "claim::crypto/hashing"' },
      relationType: { type: 'string', enum: ['depends_on', 'extends'], description: 'Relation type between specs/claims' },
      rationale: { type: 'string', minLength: 1, description: 'Why this dependency exists' },
    },
    required: ['srcKey', 'dstKey', 'relationType', 'rationale'],
    additionalProperties: false,
  },
}
```

### 13.7 `spec_impact`

```typescript
{
  name: 'spec_impact',
  description: 'Analyze the impact of changing a specific spec or claim. Returns all code entities, specs, and claims that would be affected. Traverses implements, depends_on, extends, and contains relations.',
  inputSchema: {
    type: 'object',
    properties: {
      specKey: { type: 'string', minLength: 1, description: 'Spec or Claim key to analyze impact for' },
      depth: { type: 'integer', minimum: 1, maximum: 10, default: 3, description: 'Max traversal depth for transitive dependencies' },
    },
    required: ['specKey'],
    additionalProperties: false,
  },
}
```

### 13.8 `kb_status`

```typescript
{
  name: 'kb_status',
  description: 'Get a high-level dashboard of the Knowledge Base. Returns counts of specs, claims, links, coverage percentage, stale links, and recent activity summary.',
  inputSchema: {
    type: 'object',
    properties: {
      workspaceId: { type: 'string', description: 'Workspace to check. Omit for default workspace.' },
      specKey: { type: 'string', description: 'Optional spec key to filter coverage for a specific spec and its claims.' },
    },
    additionalProperties: false,
  },
}
```

---

## 14. 스키마 변경 상세

### 14.1 신규 테이블

| 테이블 | 용도 |
|--------|------|
| `entity_identity` | 불변 정체성 (§3.5) |
| `entity_version` | 가변 주소/상태 (§3.5) |
| `entity_lifecycle` | 생애 이벤트 로그 (§3.5) |
| `approval_event` | 거버넌스 이벤트 (§4.2) |

**Seed 데이터 (카드 모델 지원)**:

```sql
-- entity_type 시드: claim 타입 추가
INSERT INTO entity_type (name) VALUES ('claim')
  ON CONFLICT (name) DO NOTHING;

-- relation_type 시드: 카드 모델 관계 추가
INSERT INTO relation_type (name) VALUES ('contains'), ('depends_on'), ('extends')
  ON CONFLICT (name) DO NOTHING;
```

> **주의**: `entity_type`의 `spec`, `module`, `symbol`과 `relation_type`의 `implements`는 v1에서 이미 seed된 상태.

### 14.2 변경 테이블

| 테이블 | 변경 내용 |
|--------|-----------|
| `relation` | `src_entity_id` → `src_identity_id`, `dst_entity_id` → `dst_identity_id` (FK 대상 변경) |
| `source` | `entity_id` → `version_id` (FK 대상 변경) |
| `fact` | `entity_id` → `version_id` (FK 대상 변경) |
| `relation_evidence` | `fact_id` ON DELETE SET NULL, `version_id`/`is_active`/`evidence_snapshot`/`created_at` 추가 (§3.7) |
| `sync_event` | `entity_id` → `identity_id` + `version_id` (nullable) |

### 14.3 제거 테이블

| 테이블 | 시점 |
|--------|------|
| `entity` | migration 완료 후 제거 |

### 14.4 Drizzle Schema (v2)

> **CHECK 제약 방침**: `entity_lifecycle.event_type`, `entity_version.status`, `approval_event.event_type/actor`의 CHECK 제약은 Drizzle ORM이 아닌 **migration SQL에서 직접 선언**한다. Drizzle의 `.check()` API는 런타임 검증이 아닌 스키마 생성용이므로, 안정성을 위해 raw SQL migration에서 `ALTER TABLE ... ADD CONSTRAINT ...`로 추가한다. §14.4의 Drizzle 코드는 CHECK를 생략하되, 실제 DB에는 §3.5, §4.2의 DDL 기준으로 CHECK가 존재해야 한다.


```typescript
// entity_identity
export const entityIdentity = pgTable('entity_identity', {
  id: serial('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspace.id),
  entityTypeId: smallint('entity_type_id').notNull().references(() => entityType.id),
  stableKey: text('stable_key'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // partial unique index: stable_key가 있는 경우만 (spec entity). NULL은 unique에서 제외됨
  uniqueIndex('identity_workspace_stable')
    .on(t.workspaceId, t.stableKey)
    .where(sql`stable_key IS NOT NULL`),
]);

// entity_version
export const entityVersion = pgTable('entity_version', {
  id: serial('id').primaryKey(),
  identityId: integer('identity_id').notNull().references(() => entityIdentity.id, { onDelete: 'cascade' }),
  workspaceId: text('workspace_id').notNull().references(() => workspace.id),
  entityKey: text('entity_key').notNull(),
  summary: text('summary'),
  meta: jsonb('meta').notNull().default(sql`'{}'::jsonb`),
  contentHash: text('content_hash'),
  status: text('status').notNull().default('active'),
  versionNum: integer('version_num').notNull().default(1),
  lastSeenRun: integer('last_seen_run').references(() => syncRun.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // ❗ partial unique index: active version만 workspace+entity_key 유니크 보장
  // 이유: a.ts→b.ts→a.ts 이동 시 archived version도 동일 key를 가질 수 있음
  uniqueIndex('version_active_unique')
    .on(t.workspaceId, t.entityKey)
    .where(sql`status = 'active'`),
  index('version_identity_idx').on(t.identityId),
  index('version_content_hash_idx').on(t.contentHash),
  index('version_identity_status_idx').on(t.identityId, t.status),  // identity별 active version 조회 최적화
]);

// entity_lifecycle
export const entityLifecycle = pgTable('entity_lifecycle', {
  id: serial('id').primaryKey(),
  identityId: integer('identity_id').notNull().references(() => entityIdentity.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  fromVersionId: integer('from_version_id').references(() => entityVersion.id),
  toVersionId: integer('to_version_id').references(() => entityVersion.id),
  relatedIdentityId: integer('related_identity_id').references(() => entityIdentity.id),
  meta: jsonb('meta').notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// approval_event
export const approvalEvent = pgTable('approval_event', {
  id: serial('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspace.id),
  eventType: text('event_type').notNull(),
  actor: text('actor').notNull().default('agent'),
  targetRelationId: integer('target_relation_id').references(() => relation.id, { onDelete: 'set null' }),
  targetIdentityId: integer('target_identity_id').references(() => entityIdentity.id, { onDelete: 'set null' }),
  payload: jsonb('payload').notNull(),  // NO DEFAULT — must be explicitly provided with required snapshot fields
  rationale: text('rationale'),
  parentEventId: integer('parent_event_id').references(() => approvalEvent.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('approval_target_relation_idx').on(t.targetRelationId),   // relation별 거버넌스 이력 조회
  index('approval_target_identity_idx').on(t.targetIdentityId),  // identity별 거버넌스 이력 조회
]);

// relation (v2 — FK changed)
export const relation = pgTable('relation', {
  id: serial('id').primaryKey(),
  srcIdentityId: integer('src_identity_id').notNull().references(() => entityIdentity.id, { onDelete: 'cascade' }),
  dstIdentityId: integer('dst_identity_id').notNull().references(() => entityIdentity.id, { onDelete: 'cascade' }),
  relationTypeId: smallint('relation_type_id').notNull().references(() => relationType.id),
  strengthTypeId: smallint('strength_type_id').notNull().references(() => strengthType.id),
  meta: jsonb('meta').notNull().default(sql`'{}'::jsonb`),
}, (t) => [
  unique('relation_unique').on(t.srcIdentityId, t.dstIdentityId, t.relationTypeId, t.strengthTypeId),
  index('relation_type_dst_idx').on(t.relationTypeId, t.dstIdentityId),  // coverage_map 재귀 쿼리 최적화
]);

// relation_evidence (v2 — 구조 변경)
export const relationEvidence = pgTable('relation_evidence', {
  id: serial('id').primaryKey(),
  relationId: integer('relation_id').notNull().references(() => relation.id, { onDelete: 'cascade' }),
  factId: integer('fact_id').references(() => fact.id, { onDelete: 'set null' }),  // nullable: fact purge 시 SET NULL
  versionId: integer('version_id').references(() => entityVersion.id, { onDelete: 'set null' }),  // evidence 출처 version
  isActive: boolean('is_active').notNull().default(true),
  evidenceSnapshot: jsonb('evidence_snapshot'),  // fact 삭제 시에도 참조 가능한 스냅샷
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('re_relation_active_idx').on(t.relationId, t.isActive),
]);
```

---

## 15. Migration Path (v1 → v2)

### 15.1 전략: Parallel Run

1. **Phase 1**: 신규 테이블 생성 (entity_identity, entity_version, entity_lifecycle, approval_event)
2. **Phase 2**: 기존 entity 데이터를 새 테이블로 복사
3. **Phase 3**: FK 참조를 새 테이블로 전환
4. **Phase 4**: 기존 entity 테이블 제거

### 15.2 Phase 2 상세: 데이터 매핑

v1에서 entity와 identity는 **정확히 1:1**이다 (v1의 entity_key는 workspace 내 unique). 이 불변 조건을 이용하여, 임시 매핑 테이블을 거쳐 안전하게 매핑한다.

```sql
-- ===== Step 0: 임시 매핑 테이블 생성 =====
-- entity.id → entity_identity.id 1:1 매핑을 보장하는 핵심 테이블
CREATE TEMP TABLE entity_to_identity_map (
  entity_id     INTEGER PRIMARY KEY,   -- v1 entity.id
  identity_id   INTEGER NOT NULL,      -- v2 entity_identity.id
  entity_key    TEXT NOT NULL,
  workspace_id  TEXT NOT NULL
);

-- ===== Step 1: entity → entity_identity (1:1) =====
-- 각 entity에 대해 정확히 하나의 identity를 생성한다.
INSERT INTO entity_identity (workspace_id, entity_type_id, stable_key, created_at)
SELECT e.workspace_id, e.entity_type_id,
       CASE WHEN et.name = 'spec' THEN e.entity_key ELSE NULL END,
       e.created_at
FROM entity e
JOIN entity_type et ON et.id = e.entity_type_id
ORDER BY e.id;  -- deterministic order for SERIAL id assignment

-- ===== Step 1b: 매핑 테이블 채우기 =====
-- entity와 identity를 row_number 기반으로 1:1 매핑한다.
-- 둘 다 같은 ORDER BY e.id로 생성되었으므로 순서가 일치한다.
WITH ranked_entity AS (
  SELECT id AS entity_id, entity_key, workspace_id,
         ROW_NUMBER() OVER (ORDER BY id) AS rn
  FROM entity
),
ranked_identity AS (
  SELECT id AS identity_id,
         ROW_NUMBER() OVER (ORDER BY id) AS rn
  FROM entity_identity
  WHERE id >= {migration_start_id}  -- migration 시작 시 기록한 SERIAL 시작값
)
INSERT INTO entity_to_identity_map (entity_id, identity_id, entity_key, workspace_id)
SELECT re.entity_id, ri.identity_id, re.entity_key, re.workspace_id
FROM ranked_entity re
JOIN ranked_identity ri ON ri.rn = re.rn;

-- ===== Step 1c: 매핑 검증 =====
-- entity 수와 identity 수가 일치해야 한다
DO $$
DECLARE
  v_entity_count INTEGER;
  v_identity_count INTEGER;
  v_map_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_entity_count FROM entity;
  SELECT COUNT(*) INTO v_identity_count FROM entity_identity WHERE id >= {migration_start_id};
  SELECT COUNT(*) INTO v_map_count FROM entity_to_identity_map;
  IF v_entity_count != v_identity_count OR v_entity_count != v_map_count THEN
    RAISE EXCEPTION 'Migration count mismatch: entity=%, identity=%, map=%',
      v_entity_count, v_identity_count, v_map_count;
  END IF;
END $$;

-- ===== Step 2: entity → entity_version =====
INSERT INTO entity_version (
  identity_id, workspace_id, entity_key, summary, meta,
  content_hash, status, version_num, last_seen_run, created_at
)
SELECT
  m.identity_id,
  e.workspace_id,
  e.entity_key,
  e.summary,
  e.meta,
  s.content_hash,
  CASE WHEN e.is_deleted THEN 'archived' ELSE 'active' END,
  1,
  e.last_seen_run,
  e.created_at
FROM entity e
JOIN entity_to_identity_map m ON m.entity_id = e.id
LEFT JOIN LATERAL (
  SELECT s2.content_hash FROM source s2
  WHERE s2.entity_id = e.id
  ORDER BY s2.id LIMIT 1
) s ON true;
```

> **불변 규칙**: entity와 identity는 migration 시 **정확히 1:1**이다. Step 1c의 검증이 실패하면 migration을 중단한다. 다대다나 누락은 허용하지 않는다.

### 15.3 Phase 3 상세: FK 전환

```sql
-- relation: entity_id → identity_id
ALTER TABLE relation ADD COLUMN src_identity_id INTEGER;
ALTER TABLE relation ADD COLUMN dst_identity_id INTEGER;
UPDATE relation r SET
  src_identity_id = m.identity_id
FROM entity_to_identity_map m WHERE m.entity_id = r.src_entity_id;
-- ... (dst도 동일)
-- 이후 old column drop, new column NOT NULL 추가, FK 추가

-- source: entity_id → version_id
-- fact: entity_id → version_id
-- sync_event: entity_id → identity_id + version_id
-- (각각 동일 패턴)
```

### 15.4 롤백 계획

migration은 각 phase를 개별 트랜잭션으로 실행하며, phase 2~3 사이에 **검증 체크포인트**를 둔다:
- entity 수 == identity 수 (1:1)
- relation FK 유효성
- source/fact FK 유효성

검증 실패 시 해당 phase를 롤백하고 v1 상태로 복귀.

### 15.5 Dual-Write 전략 (source/fact FK 전환)

`source`와 `fact` 테이블의 FK가 `entity_id` → `version_id`로 변경되어야 하지만, 단계적 전환이 필요하다.

| 단계 | source/fact FK | 설명 |
|------|---------------|------|
| **Step 1~3** | `entity_id`만 사용 | v1 호환. version_id 컬럼은 nullable로 추가만 |
| **Step 3b~7** | `entity_id` + `version_id` 양쪽 기록 (dual-write) | 새 레코드는 두 FK 모두 기록. 기존 레코드는 migration 스크립트로 backfill |
| **Step 8** | `version_id`만 사용 | entity_id 컬럼 DROP. 레거시 제거 |

**Dual-Write 규칙**:
- 쓰기: 항상 `version_id`를 우선 설정. `entity_id`는 호환성을 위해 매핑 테이블에서 조회하여 설정
- 읽기: `version_id`가 NOT NULL이면 `version_id` 사용, NULL이면 `entity_id` → 매핑 테이블 → `version_id` 변환
- Step 8 전환 직전: `version_id IS NULL` 레코드가 0건인지 검증

### 15.6 relation_evidence 3단계 전환

`relation_evidence`의 PK가 `(relation_id, fact_id)` 복합키 → `serial id` 단독 PK로 변경되어야 한다.

| 단계 | PK | 추가 컬럼 | 설명 |
|------|-----|----------|------|
| **Phase 2-A** (Step 1) | 기존 복합 PK 유지 | `version_id`, `is_active`, `evidence_snapshot`, `created_at` nullable 추가 | 스키마 확장만. 기존 코드 영향 없음 |
| **Phase 2-B** (Step 4~7) | 기존 복합 PK 유지 | 새 도구들은 새 컬럼을 적극 사용 | 새로 생성되는 evidence는 모든 컬럼 채움 |
| **Phase 2-C** (Step 8) | `id serial PK` 전환 | `fact_id` nullable로 변경 | PK 변경 migration. 기존 레코드에 id 부여 후 복합 PK DROP |

**Phase 2-C 실행 절차**:
```sql
-- 1. serial id 컬럼 추가
ALTER TABLE relation_evidence ADD COLUMN id SERIAL;
-- 2. 기존 레코드에 id 부여 (이미 SERIAL이므로 자동)
-- 3. 복합 PK 삭제
ALTER TABLE relation_evidence DROP CONSTRAINT relation_evidence_pkey;
-- 4. 새 PK 설정
ALTER TABLE relation_evidence ADD PRIMARY KEY (id);
-- 5. fact_id nullable 변경 (이미 SET NULL FK이므로 호환)
ALTER TABLE relation_evidence ALTER COLUMN fact_id DROP NOT NULL;
-- 6. 인덱스 추가
CREATE INDEX re_relation_active_idx ON relation_evidence (relation_id, is_active);
```

---

## 16. 구현 순서

### 16.1 단계별 작업

> **§18과의 관계**: §16.1은 논리적 의존성 그래프이고, §18.2는 실제 실행 순서(Runbook)이다. 구현 시 **§18.2의 Step 순서를 따르되**, 각 Step 내부의 세부 작업은 §16.1의 의존성을 참고한다.


| 단계 | 작업 | 의존성 | 위험도 |
|------|------|--------|--------|
| **1** | 신규 테이블 스키마 생성 (entity_identity, entity_version, entity_lifecycle, approval_event) | 없음 | 낮 |
| **2** | Migration 스크립트 작성 + 테스트 (entity → identity+version, 매핑 테이블 포함) | 단계 1 | **높** |
| **3** | 기존 repo 계층 변경 (entity-repo → identity-repo + version-repo) | 단계 2 | 높 |
| **3b** | **호환성 모드 진입**: dual-read adapter 구현 | 단계 3 | 중 |
| **4** | `register_spec` 구현 (spec + claim, identity+version 기반) | 단계 3b | 중 |
| **4b** | `link_spec` 구현 (identity 기반 relation, claim:: 키 지원) | 단계 4 | 중 |
| **4c** | `relate_specs` 구현 (spec↔spec, claim↔claim depends_on/extends) | 단계 4 | 중 |
| **5** | `approval_event` 기록 로직 통합 | 단계 4b | 중 |
| **6** | `rollback_approval` 구현 | 단계 5 | 중 |
| **6b** | `spec_impact` + `kb_status` 구현 (영향도 분석 + KB 대시보드) | 단계 4c | 중 |
| **7** | Sync worker 재작성 (version append 중심) | 단계 3b | **높** |
| **8** | Purge 모델 재작성 (version purge + identity purge, evidence 보존 포함) | 단계 7 | 높 |
| **9** | `resolve_identity_candidates` 구현 (구성요소 점수 포함) | 단계 4b | 중 |
| **10** | `apply_identity_rewrite` 구현 | 단계 9 | 중 |
| **11** | 기존 18개 도구 쿼리 변경 (dual-read adapter 사용) | 단계 3b | 높 |
| **12** | `__manual__/` 경로 정합성 정책 | 단계 4, 7 | 낮 |
| **13** | Orphan cleanup (fact + relation, 파일 단위 scope) | 단계 7 | 중 |
| **14** | **호환성 모드 종료**: 기존 entity 테이블 제거, dual-read adapter 제거 | 단계 11 전체 완료 + 검증 후 | **높** |

### 16.2 호환성 모드 (Compatibility Mode)

단계 3b~15 사이에 **dual-read 기간**을 운영한다. 이 기간 동안 기존 entity 테이블과 새 identity/version 테이블이 병존한다.

#### Dual-Read Adapter

```typescript
// dual-read-adapter.ts
// Feature flag로 제어: BUNNER_V2_ENABLED=true|false

export function resolveEntity(key: string, workspaceId: string) {
  if (isV2Enabled()) {
    // v2 경로: entity_version(active) → entity_identity
    return resolveViaIdentityModel(key, workspaceId);
  } else {
    // v1 경로: entity(entity_key)
    return resolveViaLegacyEntity(key, workspaceId);
  }
}
```

**운영 규칙**:
1. **단계 3b**: adapter 구현. 기본값 `V2_ENABLED=false` (v1 경로)
2. **단계 4~10**: 각 도구를 v2로 전환할 때마다 해당 도구에서 v2 경로 활성화
3. **단계 11**: 모든 18개 도구를 v2로 전환. `V2_ENABLED=true`가 기본값이 됨
4. **단계 14**: v1 경로와 기존 entity 테이블을 제거. adapter도 제거

**이점**:
- 부분 배포 가능: 도구별로 점진적 전환
- 즉시 롤백: feature flag를 끄면 v1으로 복귀
- 검증 가능: v1과 v2 결과를 동시에 비교 (shadow mode)

---

## 17. 미래 확장 경로

### 17.1 코드 내 @spec 주석 태그

`/** @spec spec::di-container */` 같은 태그를 파서가 인식하여 자동으로 `implements` relation을 생성하는 방식. `approval_event`에 `actor='system'`으로 기록.

### 17.2 가중치 기반 스코어링

`resolve_identity_candidates`에서 후보를 **점수 기반으로 정렬**. 운영 데이터가 충분히 쌓이면 도입 검토.

### 17.3 Claim 세분화

§5.3에서 정의한 v2+/v3+ 경로. spec을 atomic claim으로 분해하여 fine-grained coverage 추적.

### 17.4 Stale Link Detection (v2.1)

**문제**: spec이 업데이트되면 기존 코드 link의 앵커(`rationale`, `anchor`)가 무효화될 수 있다.

**해결 경로**:

1. `spec_updated` 이벤트 발생 시 해당 spec의 모든 outbound/inbound link를 재검증 큐에 등록
2. `inconsistency_report`에 `stale_link_after_spec_update` 검사 항목 추가
3. 검사 로직:
   - link 생성 시점의 `entity_version.version_num` vs 현재 spec의 `version_num` 비교
   - 차이 ≥ 1이면 `stale_candidate`로 마킹
   - `relation.meta.anchor`가 현재 spec 본문에서 매칭되지 않으면 `stale_confirmed`
4. 결과는 `inconsistency_report` 응답의 `staleLinks[]` 배열로 반환
5. 자동 삭제 없음 — 사용자에게 보고만. `link_spec`으로 재연결은 수동

**트리거 조건**: `sync` 이벤트 중 spec entity의 `content_hash` 변경 감지 시

### 17.5 approval_event Archive Policy (v2.1)

**문제**: approval_event 테이블이 무한 성장하면 쿼리 성능 저하.

**해결 경로**:

1. **TTL**: 90일 이상 경과한 이벤트를 `approval_event_archive`로 이동
2. **아카이브 테이블**: `approval_event_archive` — 동일 스키마, 별도 테이블
3. **제외 조건**: 최근 30일 내 child rollback이 있는 이벤트는 아카이브 제외
4. **실행**: `purge_tombstones`와 동일 패턴의 관리 도구 또는 cron job
5. **쿼리 전략**: 현재 데이터는 `approval_event`, 이력 조회는 `UNION ALL` 또는 뷰

```sql
-- 아카이브 이동 (예시)
WITH candidates AS (
  SELECT id FROM approval_event
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND id NOT IN (
      SELECT DISTINCT parent_event_id FROM approval_event
      WHERE event_type = 'link_rollback' AND created_at > NOW() - INTERVAL '30 days'
    )
)
INSERT INTO approval_event_archive SELECT * FROM approval_event WHERE id IN (SELECT id FROM candidates);
DELETE FROM approval_event WHERE id IN (SELECT id FROM candidates);
```

### 17.6 Advisory Lock (v2.1)

**문제**: 동시 sync 또는 수동 도구 호출이 같은 identity를 동시에 변경하면 race condition 발생 가능.

**해결 경로**:

1. **PostgreSQL Advisory Lock**: `pg_advisory_xact_lock(identity_id)` — 트랜잭션 범위 잠금
2. **적용 대상**: `register_spec`, `link_spec`, `apply_identity_rewrite` — identity 변경이 있는 도구
3. **래퍼 함수**:

```typescript
async function withIdentityLock<T>(
  tx: Transaction,
  identityId: number,
  fn: () => Promise<T>
): Promise<T> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${identityId})`);
  return fn();
}
```

4. **sync worker**: 파일 단위로 직렬 처리하므로 기본적으로 충돌 없음. 수동 도구와의 충돌만 방어
5. **성능 영향**: advisory lock은 row lock보다 가벼움. 트랜잭션 종료 시 자동 해제

---

### 17.7 `.spec.md` 파서 (v2.1+)

**목표**: `.spec.md` 파일을 sync 파서가 인식하여 spec/claim entity를 자동 등록하고 `contains` 관계를 자동 생성.

> §17.1의 "코드 내 `@spec` 주석 태그"와는 별개 기능이다. §17.1은 코드 → spec 방향의 자동 link이고, 본 항목은 spec 파일 → KB 자동 등록이다.

**설계 필요 항목** (구현 전 확정 필수):
1. `.spec.md` 파일 형식 정의 (frontmatter YAML? heading 기반?)
2. claim 추출 규칙 (heading level? marker comment?)
3. 기존 `register_spec` 수동 등록과의 충돌 해결 (우선순위, merge 정책)
4. approval_event 기록 시 `actor='system'` 사용

**배치 시점**: Step 7 이후 또는 별도 이터레이션. 설계 확정 전까지 Step 7 범위에서 제외.

---


## 부록 A: 용어 정의

| 용어 | 정의 |
|------|------|
| **entity_identity** | entity의 전 생애 불변 정체성. relation이 참조하는 대상 |
| **entity_version** | entity의 특정 시점 상태 (주소, 내용, 메타). 가변 |
| **entity_key** | entity_version에 저장되는 현재 주소. 형식: `{type}:{identifier}` |
| **identity matching** | content_hash를 이용해 기존 identity에 새 version을 연결하는 과정 |
| **approval_event** | 수동/반자동 상태 전이를 기록하는 1급 이벤트. 거버넌스의 단일 진실 소스 |
| **entity_lifecycle** | identity의 생애 이벤트 (created, renamed, split, merged 등) 로그 |
| **archived** | entity_version의 상태. 파일 이동/삭제로 비활성화되었지만 identity는 유지 |
| **superseded** | entity_version 또는 relation이 다른 것으로 대체된 상태 |
| **앵커(anchor)** | 링크 생성 시 relation.meta에 저장하는 식별 정보 |
| **rationale** | 링크의 근거. "왜 이 코드가 이 스펙을 구현하는가" |
| **contract** | 스펙을 계약 객체로 바라보는 관점. stable ID + versioning |
| **claim (카드)** | 계약의 개별 요구사항 카드. `claim::{spec}/{name}` 형식. 코드 link의 실제 대상 단위 |
| **contains** | spec → claim 소속 관계. `register_spec`에서 `parentSpecKey` 지정 시 자동 생성 |
| **evidence** | 계약 충족을 입증하는 코드/fact. relation_evidence로 연결 |
| **provenance** | approval_event 체인을 통한 출처 추적 |
| **stale link** | spec/claim body가 갱신된 후 아직 재검증되지 않은 기존 링크 |
| **coverage** | spec의 하위 claim 중 코드 link가 있는 비율. 카드 모델의 진행률 지표 |

## 부록 B: 관련 파일 목록

| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `tooling/mcp/drizzle/schema.ts` | **재작성** | entity_identity, entity_version, entity_lifecycle, approval_event 추가. entity 제거. relation/source/fact FK 변경 |
| `tooling/mcp/src/server.ts` | 수정 | 8개 도구 등록 (TOOL_DEFINITIONS, handleToolCall) |
| `tooling/mcp/src/tools/spec.ts` | **신규** | register_spec, link_spec, relate_specs 구현 |
| `tooling/mcp/src/tools/identity.ts` | **신규** | resolve_identity_candidates, apply_identity_rewrite 구현 |
| `tooling/mcp/src/tools/governance.ts` | **신규** | rollback_approval 구현 |
| `tooling/mcp/src/tools/dashboard.ts` | **신규** | spec_impact, kb_status 구현 |
| `tooling/mcp/src/repo/identity-repo.ts` | **신규** | entity_identity CRUD |
| `tooling/mcp/src/repo/version-repo.ts` | **신규** | entity_version CRUD + status 전이 |
| `tooling/mcp/src/repo/approval-repo.ts` | **신규** | approval_event 기록/조회 |
| `tooling/mcp/src/repo/lifecycle-repo.ts` | **신규** | entity_lifecycle 기록/조회 |
| `tooling/mcp/src/repo/entity-repo.ts` | **제거** | identity-repo + version-repo로 대체 |
| `tooling/mcp/src/sync-worker.ts` | **재작성** | version append 중심 core loop |
| `tooling/mcp/src/kb.ts` | 수정 | SyncAction 확장, 새 repo 래퍼 |
| `tooling/mcp/src/repo/sync-event-repo.ts` | 수정 | SyncAction 단일 정의, FK 변경 |
| `tooling/mcp/src/repo/relation-repo.ts` | 수정 | FK를 identity 참조로 변경, deleteOrphanRelations 추가 |
| `tooling/mcp/src/repo/source-repo.ts` | 수정 | FK를 version 참조로 변경 |
| `tooling/mcp/src/repo/fact-repo.ts` | 수정 | FK를 version 참조로 변경 |
| `tooling/mcp/src/read-through.ts` | 수정 | `__manual__/` prefix 예외 + version 기준 조회 |
| `tooling/mcp/src/analysis.ts` | 수정 | 기존 도구 쿼리를 identity+version JOIN으로 변경 |
| `tooling/mcp/drizzle/migrations/` | **신규** | v1→v2 migration SQL |

## 부록 C: 테스트 매트릭스

### C.1 Identity Matching (계층 1)

| # | 시나리오 | 선행 상태 | 수행 | 기대 결과 |
|---|----------|-----------|------|-----------|
| T1-1 | **단순 파일 이동** | `a.ts`에 identity+version+link 존재 | `mv a.ts b.ts` → startupScan | 기존 version archived, 같은 identity에 새 version(key=`module:b.ts`) active. relation 불변. lifecycle `'renamed'` |
| T1-2 | **이동+내용변경** | `a.ts`에 link 존재 | `mv a.ts b.ts` + 내용 수정 → startupScan | hash 불일치 → 기존 version archived, 새 identity+version 생성. link 파손 (계층 2) |
| T1-3 | **파일 복사 (1:N)** | `a.ts` 존재 | `cp a.ts b.ts` + `rm a.ts` → startupScan | 동일 hash 2개 → 1:N 자동 매칭 금지. 기존 archived, b.ts 새 identity |
| T1-4 | **N:1 통합** | `a.ts`, `b.ts` 같은 hash | 둘 다 삭제 + `c.ts` 생성 → startupScan | N:1 자동 매칭 금지. 둘 다 archived, c.ts 새 identity |
| T1-5 | **Watch DELETE → CREATE** | `a.ts`에 link 존재 | DELETE(a.ts) → CREATE(b.ts), hash 동일 | DELETE: version archived, identity+relation 유지. CREATE: content_hash 매칭 → 같은 identity에 새 version |
| T1-6 | **Watch 역순 CREATE → DELETE** | `a.ts` 존재 | CREATE(b.ts) → DELETE(a.ts), hash 동일 | CREATE: 새 identity+version. DELETE: a.ts version archived. Post-DELETE merge check(§6.3)로 content_hash 1:1 매칭 → 자동 병합. entity_lifecycle 'merged' 기록. approval_event 'identity_merged'(actor='system') 기록 |

### C.2 수동 도구

| # | 시나리오 | 수행 | 기대 결과 |
|---|----------|------|-----------|
| T2-1 | **spec 등록** | `register_spec({specKey: "spec::auth", ...})` | identity 생성, version(active) 생성, source `__manual__/spec/spec::auth`, fact `spec_body`, approval_event `spec_registered` |
| T2-2 | **spec 갱신** | body 변경하여 재호출 | 기존 version archived, 새 version(version_num=2) active. approval_event `spec_updated` |
| T2-3 | **spec 동일 내용 재호출** | 같은 body로 재호출 | `action: 'unchanged'`. version 변경 없음 |
| T2-4 | **link 생성** | `link_spec(...)` | relation 생성 (identity 기준), evidence 연결, anchor in meta, approval_event `link_created` |
| T2-5 | **link 중복** | 같은 pair로 재호출 | upsert: meta 갱신, approval_event `link_updated` |
| T2-6 | **archived entity에 link** | 모든 version이 archived | 에러: "All versions are archived" |
| T2-7 | **잘못된 specKey** | `register_spec({specKey: "auth"})` | 에러: "specKey must start with 'spec::'" |

### C.3 거버넌스

| # | 시나리오 | 수행 | 기대 결과 |
|---|----------|------|-----------|
| T3-1 | **link 생성 후 롤백** | link_spec → rollback_approval | relation 삭제/strength 격하, approval_event `link_rollback` with parent_event_id |
| T3-2 | **identity rewrite 후 롤백** | apply_identity_rewrite → rollback_approval | relation의 src_identity_id 원복, approval_event `link_rollback` |
| T3-3 | **이미 롤백된 이벤트 재롤백** | T3-1 후 같은 event 롤백 시도 | 에러: "Event already rolled back" |
| T3-4 | **provenance 조회** | 특정 relation에 대해 approval_event 이력 조회 | 시간순으로 모든 이벤트 반환 |

### C.4 Purge/Archive

| # | 시나리오 | 수행 | 기대 결과 |
|---|----------|------|-----------|
| T4-1 | **archived version purge** | version archived + TTL 경과 | version 삭제, fact/source cascade 삭제. identity 유지 (다른 active version 있으면) |
| T4-2 | **identity purge (all versions gone)** | 모든 version purge 후 + TTL 경과 | identity 삭제 → relation cascade 삭제 |
| T4-3 | **manual link 보호** | identity에 manual relation 참여 + 모든 version purge | identity 삭제 안 됨 (보호) |
| T4-4 | **rewrite로 보호 해제** | T4-3에서 apply_identity_rewrite로 relation 이전 | 옛 identity에 manual relation 없음 → purge 가능 |

### C.5 __manual__/ 경로 보호

| # | 시나리오 | 수행 | 기대 결과 |
|---|----------|------|-----------|
| T5-1 | **startupScan 시 제외** | spec entity source `__manual__/` | startupScan → archived 대상에서 제외 |
| T5-2 | **read-through 시 제외** | `__manual__/` source stale 체크 | 항상 fresh |
| T5-3 | **watch에 진입** | `__manual__/` path가 processFile 도달 | early return |

### C.6 Identity Resolution (계층 2)

| # | 시나리오 | 수행 | 기대 결과 |
|---|----------|------|-----------|
| T6-1 | **깨진 링크 감지** | identity에 active version 없음, manual link 존재 | resolve_identity_candidates → brokenLinks 1건 |
| T6-2 | **깨진 링크 없음** | 모든 manual link healthy | `{ brokenLinks: [], totalBroken: 0 }` |
| T6-3 | **rewrite 적용** | 후보 선택 → apply_identity_rewrite | relation.src_identity_id 변경, approval_event `identity_rewritten`, evidence 추가 |
| T6-4 | **rewrite 충돌** | 동일 unique constraint | meta 병합, supersededBy 표시, approval_event에 충돌 기록 |
| T6-5 | **relation orphan cleanup** | sync 후 파서가 새 relation 생성 | 옛 relation (strength='inferred') 삭제, manual 보존 |

### C.7 카드 모델 (하이브리드)

| # | 시나리오 | 수행 | 기대 결과 |
|---|----------|------|-----------|
| T7-1 | **claim 등록** | `register_spec({specKey: "claim::auth/login", parentSpecKey: "spec::auth", ...})` | identity(type='claim') 생성, version active, contains relation 자동 생성, approval_event `spec_registered` |
| T7-2 | **claim 등록 — parent 없이** | `register_spec({specKey: "claim::auth/login", ...})` (parentSpecKey 생략) | 에러: "claim requires parentSpecKey" |
| T7-3 | **spec에 parent 지정** | `register_spec({specKey: "spec::auth", parentSpecKey: "spec::core"})` | 에러: "spec cannot have a parent" |
| T7-4 | **claim에 link** | `link_spec({specKey: "claim::auth/login", ...})` | 정상 link 생성, approval_event `link_created` |
| T7-5 | **하위 claim 있는 spec에 직접 link** | spec에 claim 3개 있는 상태에서 `link_spec({specKey: "spec::auth", ...})` | 경고 반환 ("카드 단위 link 권장") + link는 생성 |
| T7-6 | **coverage_map 재귀 집계** | spec에 claim 3개, 2개 linked | `{ totalClaims: 3, linkedClaims: 2, coveragePercent: 66.7 }` |
| T7-7 | **claim 갱신** | claim body 변경하여 재호출 | 기존 version archived, 새 version(version_num=2), approval_event `spec_updated` |

### C.8 spec↔spec 관계

| # | 시나리오 | 수행 | 기대 결과 |
|---|----------|------|-----------|
| T8-1 | **depends_on 생성** | `relate_specs({srcKey: "spec::billing", dstKey: "spec::auth", relationType: "depends_on", rationale: "결제에 인증 선행 필요"})` | relation 생성 (depends_on), approval_event `spec_relation_created` |
| T8-2 | **순환 의존 감지** | A→B→C→A depends_on | 에러: "Circular dependency detected" |
| T8-3 | **extends 생성** | `relate_specs({..., relationType: "extends", ...})` | relation 생성 (extends) |
| T8-4 | **잘못된 relationType** | `relate_specs({..., relationType: "implements", ...})` | 에러: "relationType must be 'depends_on' or 'extends'" |

### C.9 대시보드 / 영향도

| # | 시나리오 | 수행 | 기대 결과 |
|---|----------|------|-----------|
| T9-1 | **kb_status 전체** | `kb_status()` | specs/claims 수, 커버리지 %, brokenLinks 수, staleLinks 수 반환 |
| T9-2 | **kb_status 특정 spec** | `kb_status({specKey: "spec::auth"})` | 해당 spec + 하위 claim의 커버리지만 반환 |
| T9-3 | **spec_impact 조회** | `spec_impact({specKey: "claim::auth/login"})` | claim에 연결된 코드 목록 + depends_on/extends 따른 간접 영향 spec/claim |
| T9-4 | **stale link 탐지** | spec body 갱신 후 기존 link 존재 | `inconsistency_report`에 `stale_link_after_spec_update` 항목 포함 |

## 부록 D: v1 대비 변경 요약

| 영역 | v1 | v2 | 변경 이유 |
|------|----|----|-----------|
| 정체성 담체 | `entity.id` | `entity_identity.id` | 스키마 수준 강제 메커니즘 |
| 파일 이동 처리 | entity_key rewrite (UPDATE) | version append (INSERT) | rewrite/grace window 복잡도 제거 |
| relation FK | `entity.id` | `entity_identity.id` | identity 불변으로 relation 무조건 유지 |
| grace window | 필요 (pending_delete, edge case 7종) | **불필요** (+ POST-DELETE merge check) | identity가 relation 보호. 역순 이벤트는 자동 병합 |
| 감사 모델 | sync_event + relation.meta JSONB | approval_event 1급 테이블 (CHECK 제약 + 필수 payload snapshot) | 쿼리 가능한 거버넌스 |
| 되돌리기 | 없음 | rollback_approval (ON DELETE SET NULL FK) | Reversibility 확보 |
| spec 버전 관리 | upsert (이력 없음) | entity_version (version_num) | 링크 시점 재현 |
| 상태 관리 | is_deleted boolean | entity_version.status enum | 다단계 상태 전이 |
| purge | 물리 삭제 + 복잡한 보호 조건 | version purge (evidence snapshot 보존) → identity purge (lifecycle 기반, 2단계) | 보호 조건 단순화 + 감사 보존 |
| relation_evidence | relation_id + fact_id (cascade) | + version_id, is_active, evidence_snapshot (fact_id SET NULL) | Provenance 보존 + 현재/과거 구분 |
| orphan cleanup | identity 전체 범위 | 파싱 파일 단위 scope (relation.meta.sourceFile) | 오탐 방지 |
| identity 조회 | entity_key 단일 경로 | 4단계 우선순위 (stable_key → entity_key → id → content_hash) | NULL stable_key 대응 |
| 구현 전략 | big-bang | dual-read adapter + feature flag (호환성 모드) | 점진적 전환, 즉시 롤백 가능 |
| 스펙 모델 | 1 spec = 1 blob | 하이브리드 카드 모델 (spec → claim 계층, BDD 검증 기준 권장) | 카드 단위 추적, 진행률 가시성 |
| 신규 도구 | 4개 | 8개 (+rollback_approval, relate_specs, spec_impact, kb_status) | 카드 모델 + 거버넌스 + 대시보드 |

---

## 18. 작업 순서 (Implementation Runbook)

> 목표: v1→v2 전환을 “병렬 운영 + 즉시 롤백 가능”하게 수행하면서, 링크 파손 방지/감사/되돌리기(거버넌스)를 스키마로 강제한다.

### 18.1 공통 운영 규칙 (모든 단계 적용)

- 모든 단계는 **작게 쪼개서** 머지 가능해야 한다 (단계별 CI 통과)
- “자동”은 **content_hash 1:1** 결정론만 허용, 그 외는 승인 이벤트 기반 수동/반자동
- `strength='manual'` relation은 **절대 자동 삭제 금지**
- 각 단계 완료 시점마다 `verify_integrity`/`inconsistency_report`를 강화해 “깨진 상태”를 조기 탐지한다
- Dual-read 기간에는 **feature flag로 즉시 롤백** 가능해야 한다 (`BUNNER_V2_ENABLED`)

### 18.2 단계별 실행 순서 (권장)

#### Step 0 — Preflight (변경 전 안전장치)

- [ ] 현재 스키마/레포/도구 호출 흐름을 기준으로 **회귀 테스트 베이스라인** 확보
- [ ] “dual-read adapter”가 들어갈 **단일 진입점**(resolve 계열)을 확정

#### Step 1 — v2 스키마 추가 (병렬 운영 기반)

- [ ] 신규 테이블 생성: `entity_identity`, `entity_version`, `entity_lifecycle`, `approval_event`
- [ ] 변경 테이블 컬럼/인덱스 추가(병행): `relation`(identity FK), `source`/`fact`(version FK), `sync_event`(identity_id+version_id), `relation_evidence` 구조 확장
- [ ] 무결성 제약(UNIQUE/INDEX/CHECK) 반영

**완료 조건**

- [ ] 기존 v1 기능이 깨지지 않음(아직 v1 경로 사용)
- [ ] 마이그레이션 없이도 서버 기동/기본 쿼리 가능

#### Step 2 — Migration 스크립트(TDD) + 검증 체크포인트

- [ ] v1 `entity` → v2 `entity_identity`(1:1) + `entity_version`(version_num=1) 매핑 스크립트 작성
- [ ] 임시 매핑 테이블 + count mismatch 검사(Step 1c) 포함
- [ ] FK 전환 스크립트(Phase 3)까지 포함하되, **phase별 트랜잭션**으로 롤백 가능하게 구성

**테스트(부록 C 기반)**

- [ ] 마이그레이션 전/후 엔티티 수/매핑 수 불일치 시 즉시 실패
- [ ] relation/source/fact/sync_event FK 유효성 검증

#### Step 3 — Repo 계층 분리 + Dual-Read Adapter 도입 (호환성 모드 시작)

- [ ] `entity-repo`를 `identity-repo`/`version-repo`로 분리(추상화 레벨 고정)
- [ ] dual-read adapter 추가: `BUNNER_V2_ENABLED=false` 기본
- [ ] v1 경로 결과와 v2 경로 결과를 비교 가능한 “shadow read” 옵션(로그) 제공(선택)

**완료 조건**

- [ ] 동일 입력에 대해 v1/v2가 (가능한 범위에서) 동일 결과를 반환
- [ ] `BUNNER_V2_ENABLED` 토글로 즉시 복귀 가능

#### Step 4 — MCP 신규 도구 8종 구현(카드 모델 포함)

**① 핵심 도구 (5종)**

1) [ ] `register_spec` (spec + claim 등록, parentSpecKey로 contains 관계 자동 생성, `__manual__/` source, approval_event)
2) [ ] `link_spec` (manual implements, `claim::` 키 권장, anchor + rationale evidence + approval_event)
3) [ ] `rollback_approval` (보상 이벤트 + parent_event_id 체인)
4) [ ] `resolve_identity_candidates` (깨진 링크 탐지 + 후보 스코어링, 자동 적용 금지)
5) [ ] `apply_identity_rewrite` (승인된 relink + approval_event + evidence append-only)

**② 카드 모델 / 분석 도구 (3종)**

6) [ ] `relate_specs` (spec↔spec, claim↔claim 간 `depends_on`/`extends` relation, 순환 검사)
7) [ ] `spec_impact` (spec/claim 변경 시 영향받는 코드·spec·claim 목록, 재귀 탐색)
8) [ ] `kb_status` (KB 대시보드: spec/claim 수, 링크 수, 커버리지 %, stale link 수)

**테스트(부록 C: T2/T3/T6/T7/T8/T9)**

- [ ] T2-1~T2-7 (spec/claim 등록 · 링크), T3-1~T3-4 (거버넌스), T6-1~T6-5 (identity resolution)
- [ ] T7 (카드 모델), T8 (spec↔spec 관계), T9 (대시보드/영향도)

#### Step 5 — Sync Worker v2 core loop 재작성 (version append 중심)

- [ ] `startupScan()` 교차 비교 + content_hash 1:1 매칭 → rename 처리(archived+new active version)
- [ ] `processFile()`에서 entity_key active miss 시 archived hash 매칭 → identity 연결/신규 생성
- [ ] `handleDeletedFile()`은 version archived 처리(그레이스 윈도우 금지)
- [ ] Watch 역순(CREATE→DELETE) 방어: Post-DELETE merge check(결정론 케이스만)
- [ ] `isManualPath()` 유틸 구현 + 5개 레이어 필터링(§9.3: L1~L5) 적용

**테스트(부록 C: T1-1~T1-6 + T5)**

- [ ] 파일 이동/삭제/생성 이벤트 조합에서 relation 유지(깨짐은 계층 2로 위임)
- [ ] `__manual__/` 경로 보호 검증 (T5-1~T5-3)

#### Step 6 — Cleanup/Purge 재작성 (증거 보존)

- [ ] Orphan fact cleanup: version 단위
- [ ] Orphan relation cleanup: “현재 파싱 파일 scope”로 제한 + manual 제외
- [ ] Version purge: evidence_snapshot 선캡처 → archived version 삭제
- [ ] Identity purge: “버전 없음 + TTL + manual relation 미참여” 조건
- [ ] **Stale link detection**: `inconsistency_report`에 `stale_link_after_spec_update` 검사 항목 추가 (v2 범위)
  - > **범위 구분**: 검사 항목 추가 및 보고는 v2 범위. 재검증 큐 등록 및 자동 트리거(§17.4)는 v2.1로 이관.

**테스트(부록 C: T4, T9)**

- [ ] evidence_snapshot 보존 + fact_id SET NULL 동작 검증
- [ ] stale link 감지: spec 업데이트 후 link의 `version_num` 차이 + anchor 매칭 실패 검증

#### Step 7 — 기존 도구(18개) 쿼리 전환 (active version 기준)

- [ ] `search/describe/facts/relations/...`를 identity+active version JOIN 기반으로 전환
- [ ] `evidence`는 `is_active=true` 기본 + `includeHistory` 옵션
- [ ] `inconsistency_report`에 “active version 없는 identity / manual_relation_archived_identity” 추가
- [ ] `inconsistency_report`에 `stale_link_after_spec_update` 검사 항목 추가 (§17.4)

#### Step 8 — 호환성 모드 종료(빅 스위치) + 레거시 제거

- [ ] `BUNNER_V2_ENABLED=true` 기본 전환
- [ ] shadow 비교 기간 운영 후, legacy `entity` 테이블 제거 + v1 경로 제거 + adapter 제거
- [ ] 마이그레이션 롤백이 어려운 시점이므로, 전환 직전/직후 검증 체크포인트 필수
- [ ] **Dual-Write 종료**: source/fact의 `entity_id` 칼럼 DROP (§15.5 Phase 3)
- [ ] **relation_evidence PK 전환**: 복합 PK → serial id PK (§15.6 Phase 2-C)
- [ ] 최종 도구 수 확인: 기존 18개 + 신규 8개 = **총 26개 도구**
