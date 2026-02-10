# Card-centric Knowledge Base 설계 v3

> **범위**: bunner-kb MCP 서버를 Card-centric 아키텍처로 전환  
> **상태**: 설계 초안 (검토 중)  
> **관련 코드**: `tooling/mcp/`  
> **선행 문서**: `PLAN.md` (v1 — 아카이브), `PLAN-v2.md` (v2 — identity/version 분리 설계)

---

## 1. 배경 및 동기

### 1.1 현재 운영 모델 (v1)

| 구분 | 설명 | 등록 방식 |
|------|------|-----------|
| **스펙(spec)** | 사용자와 에이전트가 논의하여 확정한 기능 명세 | 수동 등록 (`entity_type = 'spec'`) |
| **코드(code)** | TypeScript 소스 파일에서 추출한 모듈/심볼 | `sync` 파서가 자동 생성 (`module:`, `symbol:` 엔티티) |
| **스펙↔코드 연결** | 어떤 코드가 어떤 스펙을 구현하는지 | 수동 링크 (`relation_type = 'implements'`, `strength = 'manual'`) |

### 1.2 v1의 핵심 문제

코드 엔티티의 `entity_key`가 **파일 경로에 종속**되어 있다. 파일 이동/리네임 시 `entity.id`가 바뀌어 **링크가 파손**된다.

v1 설계(`PLAN.md`)의 `entity_key rewrite` + `grace window` 접근은:
- 정체성 보존이 "보정 메커니즘"에 의존 (선언이 아닌 패치)
- grace window edge case 7종, pending_delete 등 부수 복잡도
- 거버넌스 부재, 계약 이력 없음

### 1.3 v2의 한계 (왜 v3가 필요한가)

v2(`PLAN-v2.md`)는 identity/version 분리로 v1의 근본 문제를 해결했다. 그러나:

| 한계 | 설명 |
|------|------|
| **Code-centric** | KB의 중심이 코드이고 spec은 보조적 위치. "이 코드의 구조는?"이 핵심 질문 |
| **Spec/Claim 이원 구조** | `spec`과 `claim` 두 entity_type을 분리 관리. claim 중첩 불가 (depth=1 고정) |
| **Flat coverage** | `linked_claims / total_claims` 단순 비율. 가중치, 우선순위 없음 |
| **단일 relation 테이블** | code↔code 정적 분석과 card↔code 수동 link가 같은 테이블에 혼재 |
| **Evidence 단일 유형** | fact 참조만 가능. test, annotation, review 등 다형성 부재 |
| **Card 속성 부재** | status, priority, tags, weight 없음. 분류/필터링 수단 부족 |
| **설계 버그 29건** | v2 리뷰에서 식별된 DDL 버그, SQL 오류, 명세 누락 등 |

### 1.4 v3 설계 목표

v2의 identity/version 분리 + 3-tier defense + approval_event 거버넌스를 **계승**하되:

1. **Card-centric KB**: 중심축을 code → card로 이동. Card = 1급 지식 객체
2. **Unified card model**: spec/claim 이원 구조 폐지 → card nested tree 단일 모델
3. **연결 모델 분리**: card_link / card_relation / code_relation 3종 분리
4. **Evidence 다형성**: code_link, test_pass, annotation, manual_review, ai_verification
5. **Card lifecycle**: draft → accepted → implementing → verified → deprecated + 하위 전파
6. **Composite coverage**: 재귀 가중 집계 + tag 횡단 집계
7. **Card 속성 확장**: status, priority, tags, weight, template_type, external_refs
8. **v2 이슈 29건 전부 반영**

---

## 2. 설계 원칙

### 2.1 Card-first

> KB의 중심축은 card이다. 코드는 card를 구현하는 증거(evidence)이다.

핵심 질문의 전환:
- v1/v2: "이 코드의 구조는?"
- **v3: "이 요구사항의 구현 상태는?"**

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

시스템의 진실은 추론이 아니라 **승인 로그**이다. (v2에서 계승)

- **자동**: 결정론적 케이스만 (동일 content_hash, 1:1 매칭)
- **반자동**: 후보와 근거만 제시
- **수동확정**: 최종 링크/정체성 확정은 승인 이벤트 필요

### 2.4 평가 기준

| 기준 | 정의 | v3 목표 |
|------|------|---------|
| **Auditability** | 왜 이 링크가 생겼는지 재현 가능한가? | approval_event + evidence + anchor로 완전 재현 |
| **Reversibility** | 오탐을 안전하게 되돌릴 수 있는가? | compensating approval_event로 롤백 |
| **Governance** | 자동화와 인간 책임 경계가 명확한가? | card lifecycle + 승인 이벤트가 단일 진실 소스 |
| **Evolution cost** | 규모가 커져도 규칙 복잡도가 선형 이하인가? | identity+version + nested card tree |
| **Discoverability** | 원하는 정보를 쉽게 찾을 수 있는가? | tag + priority + status 필터링 |

### 2.5 범용화 원칙 (Portability)

v2에서 계승. bunner-kb는 언어/프로젝트/환경에 무관한 **바이브코딩 RAG 서버**.

| 원칙 | 실천 |
|------|------|
| 코어와 파서를 섞지 않는다 | identity/version/card/approval 로직에 특정 언어 파서 코드를 넣지 않는다 |
| entity_key 형식을 코어에서 가정하지 않는다 | 코어는 entity_key를 opaque string으로 취급 |
| 파서 인터페이스를 확정한다 | `KBParser` 인터페이스를 명시적으로 정의 |
| config를 한 곳에 모은다 | 파일 확장자, hash 단위, @card 패턴 등을 config 파일로 외부화 |

#### KBParser 인터페이스 (v2 D-4 반영)

```typescript
interface KBParser {
  /** 지원하는 파일 확장자 */
  extensions: string[];
  /** 파일을 파싱하여 entity/fact/relation을 추출 */
  parseFile(filePath: string, content: string): ParseResult;
  /** content_hash 계산 (v2 B-3 반영: 정규화 규칙 명시) */
  computeHash(content: string): string;
}

interface ParseResult {
  entities: ParsedEntity[];
  facts: ParsedFact[];
  relations: ParsedRelation[];
}
```

> **content_hash 계산 규칙** (v2 B-3 반영): UTF-8 정규화 후 SHA-256. BOM 제거, trailing whitespace 제거, LF 정규화 후 해싱. `computeHash` 구현에 명시.

### 2.6 KB 범위 정책 (Scope Boundary)

v2에서 계승. 판단 기준: "이 지식이 바뀌면 **특정 코드를 수정해야 하는가?**"

| 지식 유형 | 코드와 결속력 | 관리 위치 |
|----------|-------------|----------|
| **Card (요구사항)** | 🔴 강함 | **KB** (entity) |
| 프로젝트 철학/비전 | ⚪ 없음 | **문서** |
| 아키텍처 결정 (ADR) | 🟡 약함 | **문서** |
| 스타일 가이드 | 🟡 약함 | **문서 + 린터** |
| 에이전트 규칙 | ⚪ 없음 | **문서** (AGENTS.md) |

---

## 3. 정체성(Identity) 모델

> v2에서 전면 계승. identity/version 분리는 v3에서도 동일하게 적용.

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
| **Card** | `entity_identity.id` | `card::{path}` → `entity_version` | 사용자 지정 `stable_key` (불변) |

> **v2와의 차이**: `spec`과 `claim` 두 타입이 `card` 하나로 통합됨. `spec::` / `claim::` prefix 대신 `card::` 단일 prefix.

### 3.3 Identity + Version 스키마

#### `entity_identity` (정체성 — 불변)

```sql
CREATE TABLE entity_identity (
  id            SERIAL PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspace(id),
  entity_type_id SMALLINT NOT NULL REFERENCES entity_type(id),
  stable_key    TEXT,          -- card entity만 값이 있음. code entity는 NULL
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- partial unique index: stable_key가 있는 경우만 (card entity)
CREATE UNIQUE INDEX idx_identity_stable_key
  ON entity_identity(workspace_id, stable_key)
  WHERE stable_key IS NOT NULL;
```

> **stable_key 불변성** (v2 C-3 반영): `stable_key`는 한번 설정되면 변경 불가. DB 트리거로 강제:
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
  workspace_id  TEXT NOT NULL REFERENCES workspace(id),
  entity_key    TEXT NOT NULL,
  summary       TEXT,
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_hash  TEXT,
  status        TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'superseded')),
  version_num   INTEGER NOT NULL DEFAULT 1,
  last_seen_run INTEGER REFERENCES sync_run(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX version_active_unique
  ON entity_version(workspace_id, entity_key)
  WHERE status = 'active';
```

| 컬럼 | 설명 |
|------|------|
| `status` | `'active'` = 현재 유효, `'archived'` = 경로 변경으로 비활성, `'superseded'` = identity merge/대체 시 사용 |

> **`superseded` 전이 조건** (v2 D-8 반영): `apply_identity_rewrite`로 relation이 다른 identity로 이전될 때, 원래 identity의 version을 `superseded`로 전이. 전이 조건: "해당 identity의 모든 manual relation이 다른 identity로 이전 완료된 경우".

#### `entity_lifecycle` (생애 이벤트 로그)

```sql
CREATE TABLE entity_lifecycle (
  id            SERIAL PRIMARY KEY,
  identity_id   INTEGER NOT NULL REFERENCES entity_identity(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL
    CHECK (event_type IN ('created', 'updated', 'renamed', 'split', 'merged',
                          'superseded', 'archived', 'restored',
                          'status_changed', 'reparented')),
    -- v3 추가: status_changed (card lifecycle), reparented (card 이동)
  from_version_id INTEGER REFERENCES entity_version(id) ON DELETE SET NULL,
  to_version_id   INTEGER REFERENCES entity_version(id) ON DELETE SET NULL,
  related_identity_id INTEGER REFERENCES entity_identity(id),
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

> **v2 이슈 #27 반영**: `from_version_id`와 `to_version_id`에 `ON DELETE SET NULL` 추가. version purge 시 FK 위반 방지.

### 3.4 Identity 조회 전략

v2에서 계승. 4단계 우선순위:

```
1. stable_key   — NOT NULL인 경우 (card entity). WHERE stable_key = :key
2. entity_key   — active version의 entity_key로 조회 (가장 빈번)
3. identity.id  — 직접 ID 지정 (내부 도구용)
4. content_hash — identity matching용
```

```typescript
type IdentityLookup =
  | { by: 'stableKey'; stableKey: string; workspaceId: string }
  | { by: 'entityKey'; entityKey: string; workspaceId: string }
  | { by: 'identityId'; identityId: number }
  | { by: 'contentHash'; contentHash: string; workspaceId: string; entityTypeId?: number };
```

---

## 4. Card 모델 (Unified Nested Card)

### 4.1 핵심 전환: spec/claim → card

v2의 spec/claim 이원 구조를 **card 단일 모델**로 통합한다.

| | v2 | v3 |
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

### 4.3 Card 속성 확장

card entity는 `entity_version.meta` JSONB에 다음 속성을 저장한다:

```typescript
interface CardMeta {
  /** Card body (markdown) */
  body: string;

  /** Card lifecycle status */
  status: CardStatus;

  /** Priority level */
  priority: CardPriority | null;

  /** Free-form tags for cross-tree grouping */
  tags: string[];

  /** Coverage weight (0.0 ~ 1.0). default: 1.0 */
  weight: number;

  /** Card template type */
  templateType: CardTemplateType | null;

  /** External references (Jira, GitHub issue, Figma, etc.) */
  externalRefs: ExternalRef[];

  /** Acceptance criteria (structured BDD format) */
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

> **status, priority, tags, weight를 JSONB가 아닌 전용 컬럼으로 분리하는 방안 검토 필요** — 쿼리 성능과 인덱싱 고려. §15에서 최종 결정.

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
| `verified` | 검증 완료 | implemented에서 전이 (evidence 충분) |
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
| → `deprecated` | 모든 child도 `deprecated` | **강제 전파** (재귀) |
| → `draft` (롤백) | 영향 없음 | child 상태 유지 |
| 기타 전이 | **상한 제약**: child 상태는 parent 이하만 가능 | 예: parent가 `accepted`면 child는 `verified` 불가 |

> **상한 제약 순서**: `draft < proposed < accepted < implementing < implemented < verified`

#### approval_event 연동

모든 상태 전이는 `approval_event`를 생성한다:
- `event_type: 'card_status_changed'`
- `payload: { cardKey, fromStatus, toStatus, propagatedChildren: [...] }`

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

> **v3 scope**: `entity_lifecycle`에 `reparented` 이벤트로 기록. 전체 tree snapshot은 v3.1.

---

## 5. 연결 모델 (Connection Model)

### 5.1 3종 분리

v2에서는 모든 관계가 `relation` 단일 테이블. v3에서는 성격에 따라 3종으로 분리.

| 테이블 | 대상 | 고유 속성 | 생성 방식 |
|--------|------|----------|----------|
| **`card_link`** | card ↔ code | anchor, rationale, stale_status, verified_at | 수동 / @card 자동 |
| **`card_relation`** | card ↔ card | contains, depends_on, extends, cycle 검사 | 수동 |
| **`code_relation`** | code ↔ code | import, extends, calls | 파서 자동 |

#### 분리 이유

- **card_link**에만 필요한 속성: `anchor`, `rationale`, `stale_status`, `verified_at`, `evidence[]`
- **code_relation**에는 불필요한 거버넌스 (approval_event, 수동 삭제 금지 등)
- 쿼리 단순화: `SELECT * FROM card_link WHERE stale_status = 'stale'`

### 5.2 `card_link` (card ↔ code)

```sql
CREATE TABLE card_link (
  id              SERIAL PRIMARY KEY,
  card_identity_id  INTEGER NOT NULL REFERENCES entity_identity(id) ON DELETE CASCADE,
  code_identity_id  INTEGER NOT NULL REFERENCES entity_identity(id) ON DELETE CASCADE,
  anchor          JSONB NOT NULL,          -- LinkAnchor snapshot
  rationale       TEXT NOT NULL,
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
CREATE INDEX card_link_card_idx ON card_link(card_identity_id);
CREATE INDEX card_link_code_idx ON card_link(code_identity_id);
```

| 컬럼 | 설명 |
|------|------|
| `card_identity_id` | card의 identity (FK) |
| `code_identity_id` | code entity의 identity (FK) |
| `anchor` | 링크 생성 시점의 코드 식별 정보 (`LinkAnchor`) |
| `rationale` | 왜 이 코드가 이 card를 구현하는지 |
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
  src_identity_id INTEGER NOT NULL REFERENCES entity_identity(id) ON DELETE CASCADE,
  dst_identity_id INTEGER NOT NULL REFERENCES entity_identity(id) ON DELETE CASCADE,
  relation_type   TEXT NOT NULL
    CHECK (relation_type IN ('contains', 'depends_on', 'extends')),
  meta            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(src_identity_id, dst_identity_id, relation_type)
);

CREATE INDEX card_rel_src_idx ON card_relation(src_identity_id, relation_type);
CREATE INDEX card_rel_dst_idx ON card_relation(dst_identity_id, relation_type);
```

| relation_type | 방향 | 의미 | cycle 허용 |
|---------------|------|------|-----------|
| `contains` | parent → child | 소속. nested tree의 edge | ❌ (tree) |
| `depends_on` | A → B | A는 B에 의존 | ❌ (DAG) |
| `extends` | A → B | A는 B를 확장 | ✅ (위임은 순환 허용) |

### 5.4 `code_relation` (code ↔ code)

```sql
CREATE TABLE code_relation (
  id              SERIAL PRIMARY KEY,
  src_identity_id INTEGER NOT NULL REFERENCES entity_identity(id) ON DELETE CASCADE,
  dst_identity_id INTEGER NOT NULL REFERENCES entity_identity(id) ON DELETE CASCADE,
  relation_type   TEXT NOT NULL
    CHECK (relation_type IN ('imports', 'extends', 'implements_interface', 'calls', 'uses')),
  strength        TEXT NOT NULL DEFAULT 'inferred'
    CHECK (strength IN ('inferred', 'manual')),
  source_file     TEXT,           -- 어떤 파일 파싱에서 생성되었는지
  meta            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(src_identity_id, dst_identity_id, relation_type)
);
```

> **v2의 `relation` 테이블**: v3에서는 `card_link` + `card_relation` + `code_relation`으로 분리. migration 시 relation_type에 따라 분배.

### 5.5 연결 방향 확장

| 방향 | 방식 | 설명 |
|------|------|------|
| code → card | `link_card` 수동 | 사용자/에이전트가 명시적으로 연결 |
| code → card | `@card` 주석 자동 | 파서가 `/** @card card::auth/login */` 인식 → 자동 link |
| card → code | glob pattern (v3.1) | card.meta에 `implementsPattern: "src/auth/**"` → 자동 매칭 |
| card → external | external_refs | Jira, GitHub issue, Figma URL |

---

## 6. Evidence 모델

### 6.1 다형성 Evidence

v2의 `relation_evidence`를 v3에서는 `card_evidence`로 확장. card_link에 연결.

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

### 6.2 Evidence Type별 수집 경로

| Type | 수집 경로 | is_active 전환 |
|------|----------|---------------|
| `code_link` | `link_card` 도구 호출 시 자동 생성 | 새 version 파싱 시 재확인 → 갱신 |
| `test_pass` | CI 결과 연동 (v3.1) | 테스트 실패 시 `is_active=false` |
| `annotation` | 파서가 `@card` 주석 감지 시 | 주석 제거 시 `is_active=false` |
| `manual_review` | 사용자가 명시적으로 기록 | 사용자가 명시적으로 무효화 |
| `ai_verification` | AI 검증 도구 호출 시 (v3.1) | 재검증 시 갱신 |

### 6.3 Evidence와 is_active 전환 타이밍 (v2 D-10 반영)

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
- `card_link`가 1건 이상 존재하고, active evidence가 있으면 → **covered**
- 없으면 → **uncovered**

#### Subtree Coverage (재귀 가중 집계)

```
coverage(card) =
  if card is leaf:
    1.0 if covered, 0.0 if uncovered
  else:
    Σ(child.weight × coverage(child)) / Σ(child.weight)
```

```sql
WITH RECURSIVE card_tree AS (
  -- base: 대상 card의 직접 children
  SELECT cr.dst_identity_id AS card_id, 1 AS depth
  FROM card_relation cr
  WHERE cr.src_identity_id = {target_card_id}
    AND cr.relation_type = 'contains'
  UNION ALL
  -- recursive: children의 children
  SELECT cr.dst_identity_id, ct.depth + 1
  FROM card_relation cr
  JOIN card_tree ct ON ct.card_id = cr.src_identity_id
  WHERE cr.relation_type = 'contains'
    AND ct.depth < 50  -- depth limit (v2 C-6 반영)
)
SELECT
  ct.card_id,
  ev.entity_key AS card_key,
  (ev.meta->>'weight')::float AS weight,
  CASE WHEN COUNT(cl.id) > 0 THEN 1.0 ELSE 0.0 END AS leaf_coverage
FROM card_tree ct
JOIN entity_version ev ON ev.identity_id = ct.card_id AND ev.status = 'active'
LEFT JOIN card_link cl ON cl.card_identity_id = ct.card_id
GROUP BY ct.card_id, ev.entity_key, ev.meta;
```

### 7.2 Tag 기반 횡단 집계

tree 구조와 독립적으로, 특정 tag를 가진 card들의 coverage를 집계:

```sql
SELECT
  tag,
  COUNT(*) AS total_cards,
  COUNT(cl.id) AS linked_cards,
  ROUND(COUNT(cl.id)::numeric / COUNT(*)::numeric * 100, 1) AS coverage_pct
FROM entity_version ev
CROSS JOIN LATERAL jsonb_array_elements_text(ev.meta->'tags') AS tag
LEFT JOIN card_link cl ON cl.card_identity_id = ev.identity_id
WHERE ev.status = 'active'
  AND ev.identity_id IN (
    SELECT id FROM entity_identity WHERE entity_type_id = {card_type_id}
  )
GROUP BY tag;
```

### 7.3 Priority 기반 필터링

```sql
-- P0 카드 중 미구현 목록
SELECT ev.entity_key, ev.meta->>'status' AS status
FROM entity_version ev
WHERE ev.status = 'active'
  AND ev.meta->>'priority' = 'P0'
  AND ev.identity_id NOT IN (
    SELECT card_identity_id FROM card_link
  );
```

---

## 8. 거버넌스 모델 (Approval Event)

### 8.1 핵심 원칙

v2에서 계승: **시스템의 진실은 추론이 아니라 승인 로그이다.**

### 8.2 `approval_event` 스키마

```sql
CREATE TABLE approval_event (
  id              SERIAL PRIMARY KEY,
  workspace_id    TEXT NOT NULL REFERENCES workspace(id),
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
  actor           TEXT NOT NULL DEFAULT 'agent'
    CHECK (actor IN ('agent', 'user', 'system')),
  target_card_link_id   INTEGER REFERENCES card_link(id) ON DELETE SET NULL,
  target_identity_id    INTEGER REFERENCES entity_identity(id) ON DELETE SET NULL,
  target_card_relation_id INTEGER REFERENCES card_relation(id) ON DELETE SET NULL,
  payload         JSONB NOT NULL,
  rationale       TEXT,
  parent_event_id INTEGER REFERENCES approval_event(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX approval_target_link_idx ON approval_event(target_card_link_id);
CREATE INDEX approval_target_identity_idx ON approval_event(target_identity_id);
CREATE INDEX approval_workspace_time_idx ON approval_event(workspace_id, created_at DESC);
```

> **v2 이슈 #28 반영**: `link_removed`의 생성 경로를 명시.
> - `link_removed`는 `rollback_approval`로 `link_created`를 롤백할 때 생성
> - 또는 card가 `deprecated`로 전이 시 연결된 link에 대해 `link_removed` 이벤트 생성
> - 명시적 `unlink_card` 도구도 v3에서 제공 (v2 C-1 반영)

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

### 8.4 Payload 검증 (v2 B-2 반영)

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

v2에서 계승 + 확장. `rollback_approval` 도구:

| event_type | compensating action |
|-----------|-------------------|
| `link_created` | card_link 삭제 (link_removed 이벤트 생성) |
| `link_updated` | card_link.meta를 payload.before로 복원 |
| `link_removed` | card_link 재생성 |
| `identity_rewritten` | card_link의 code_identity_id를 원래 값으로 복원 |
| `identity_merged` | version/relation을 원래 identity로 이관 원복 |
| `card_registered` | version 삭제 + identity 삭제 (cascade) |
| `card_updated` | 이전 version을 active로 복원, 현재 version 삭제 |
| `card_status_changed` | 이전 status로 복원 + 전파된 children도 복원 |
| `card_relation_created` | 해당 card_relation 삭제 |
| `card_relation_updated` | card_relation.meta를 이전 상태로 복원 |
| `card_reparented` | 이전 parent로 재이동 |

> **v2 B-5 반영**: `identity_merged` 롤백 시 인과 순서 기준: merge 이후에 생성된 approval_event가 해당 identity를 참조하면 거부. 참조 여부는 `target_identity_id = merged_identity_id` OR payload 내 identity 참조로 판단.

### 8.6 Provenance Chain

특정 card_link에 대해 전체 이력 조회:

```sql
SELECT ae.*
FROM approval_event ae
WHERE ae.target_card_link_id = {card_link_id}
ORDER BY ae.created_at ASC;
```

---

## 9. 계층적 방어 전략 (3-Tier Defense)

> v2에서 전면 계승. identity/version 분리가 핵심.

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

v2 §6.3과 동일. 주요 흐름:

**startupScan 시**:
1. `scanFiles()` 결과와 DB의 active version을 교차 비교
2. content_hash가 동일한 1:1 쌍 → 기존 version archived, 같은 identity에 새 version active
3. 1:N, N:1, hash 불일치 → 기존 version archived, 새 identity 생성

**Watch 이벤트 시**:
- DELETE: version archived. identity + card_link 유지 (identity가 보호)
- CREATE: content_hash로 archived version 검색 → 매칭 성공이면 같은 identity에 연결

**Watch 역순 (CREATE→DELETE) 방어**: Post-DELETE Identity Merge Check (v2 §6.3 동일)

#### Symbol-level Identity Cascade (v2 A-1 반영)

module identity matching이 성공하여 파일 이동이 감지된 경우, **하위 symbol entity**도 처리해야 한다:

1. 이동된 module의 기존 active version에 연결된 symbol identity 목록 조회
2. 각 symbol에 대해:
   - 새 파일에서 동일 symbolName이 존재하면 → 해당 symbol identity에 새 version 추가 (자동)
   - 존재하지 않으면 → 기존 symbol version archived. card_link가 있으면 계층 2로 위임
3. `entity_lifecycle`에 `event_type: 'renamed'` 기록 (symbol 단위)

### 9.3 계층 2: Identity Resolution

v2 §8과 동일. `resolve_identity_candidates` + `apply_identity_rewrite`.

### 9.4 계층 3: 수동 도구

v2 §7에서 card-centric으로 변경. 도구명 변경:
- `register_spec` → `register_card`
- `link_spec` → `link_card`
- `relate_specs` → `relate_cards`
- `spec_impact` → `card_impact`
- `kb_status` → `card_status`

(상세 §13에서 정의)

---

## 10. Sync Worker

### 10.1 Core Loop

v2 §9에서 계승. version append 중심.

#### `processFile()` 변경

v2의 `processFile()`에 추가:
- `@card` 주석 파싱 → `card_link` 자동 생성 (evidence_type: `annotation`)
- 기존 annotation evidence가 없어졌으면 `is_active=false` 전환

### 10.2 Orphan Cleanup

v2 §9.2 동일.

**code_relation orphan**: 파싱 파일 scope로 한정 + `strength='manual'` 제외.

**card_link orphan 금지**: card_link는 수동 생성이므로 sync에서 자동 삭제하지 않음. stale 마킹만.

### 10.3 `__manual__/` 경로 보호

v2 §9.3 동일. 5개 레이어 필터링.

### 10.4 Stale Link Detection

card 갱신 시 기존 card_link의 stale 감지 (v2 §17.4를 v3 본문으로 격상):

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

v2 §10.2 기반 + v2 이슈 #27 반영:

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

v2 §10.3 기반 + v2 이슈 #29 반영 (COALESCE 추가):

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

> **보호 조건**: card_link가 참여하는 identity는 purge하지 않음. (v2의 `strength='manual'` relation 보호 → card_link 자체가 보호)

### 11.3 보호 해제 경로

| 해제 조건 | 설명 |
|-----------|------|
| `apply_identity_rewrite`로 card_link 이전 | 옛 identity에 link 없어지면 purge 가능 |
| `unlink_card`로 link 삭제 | link 해제 |
| card `deprecated` 전이 시 link 정리 | deprecated card의 link을 정리하면 code identity 보호 해제 |

---

## 12. MCP 도구

### 12.1 Card 도구

#### `register_card`

card entity를 KB에 등록/갱신한다.

```typescript
interface RegisterCardInput {
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
  /** 외부 참조 */
  externalRefs?: ExternalRef[];
  /** 추가 메타 */
  meta?: Record<string, unknown>;
}
```

**동작 절차** (단일 트랜잭션):

1. **Identity 생성/조회**: `stable_key = cardKey`로 조회. 없으면 `entity_type = 'card'`로 생성
2. **Version 생성/갱신**: `content_hash = SHA-256(body)` 비교. 다르면 새 version (version_num++)
3. **Source 생성**: `kind: "card"`, `file_path: "__manual__/card/{cardKey}"`
4. **Fact 생성**: `fact_type: "card_body"`, `payload_text: body`
5. **Contains relation 자동 생성**: `parentCardKey` 지정 시
   - parent identity 조회 → 없으면 에러
   - `card_relation` INSERT (`relation_type: 'contains'`, `src = parent`, `dst = this`)
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
  /** 코드 entity key */
  codeEntityKey: string;
  /** Card key */
  cardKey: string;
  /** 왜 이 코드가 이 card를 구현하는지 */
  rationale: string;
}
```

**동작 절차** (단일 트랜잭션):

1. **코드 entity 확인**: active version 존재 확인
2. **Card entity 확인**: stable_key로 identity 조회
3. **앵커 수집**: 코드 entity의 fact로부터 LinkAnchor 구성
4. **card_link 생성/갱신** (UPSERT on unique constraint)
5. **card_evidence 생성**: `evidence_type: 'code_link'`
6. **Approval event**: `link_created` 또는 `link_updated`

#### `unlink_card` (v2 C-1 반영)

card와 code 사이의 link를 삭제한다.

```typescript
interface UnlinkCardInput {
  /** 삭제할 card_link의 id 또는 card+code 키 조합 */
  cardLinkId?: number;
  cardKey?: string;
  codeEntityKey?: string;
  /** 삭제 이유 */
  reason: string;
}
```

**동작**: card_link 삭제 + `link_removed` approval_event 생성.

#### `move_card` (v2 C-2 반영)

card의 부모를 변경한다 (reparent).

```typescript
interface MoveCardInput {
  /** 이동할 card 키 */
  cardKey: string;
  /** 새 부모 card 키 (null이면 root로 이동) */
  newParentCardKey: string | null;
  /** 이동 이유 */
  reason: string;
}
```

**동작 절차**:
1. 순환 검사: 새 parent가 cardKey의 descendant가 아닌지 확인
2. 기존 `contains` relation 삭제
3. 새 `contains` relation 생성 (newParentCardKey가 있으면)
4. `entity_lifecycle`에 `reparented` 이벤트 기록
5. `approval_event`에 `card_reparented` 기록

#### `update_card_status`

card의 lifecycle 상태를 전이한다.

```typescript
interface UpdateCardStatusInput {
  cardKey: string;
  newStatus: CardStatus;
  reason?: string;
}
```

**동작 절차**:
1. 현재 status 조회
2. 전이 규칙 검증 (`CARD_STATUS_TRANSITIONS`)
3. status 변경 (version.meta.status 갱신)
4. **하위 전파**: `deprecated` 전이 시 모든 descendants도 deprecated (재귀)
5. `approval_event`에 `card_status_changed` 기록

#### `relate_cards`

card 간 `depends_on` 또는 `extends` 관계를 생성한다.

```typescript
interface RelateCardsInput {
  srcKey: string;
  dstKey: string;
  relationType: 'depends_on' | 'extends';
  rationale: string;
}
```

v2 `relate_specs`와 동일한 절차. `depends_on`에 대해 순환 검사 (depth 50).

#### `unrelate_cards` (v2 D-7 반영)

card 간 관계를 삭제한다.

```typescript
interface UnrelateCardsInput {
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

v2 `spec_impact`에서 확장:
- **양방향 탐색** (v2 A-2 반영): 
  - 역방향: card를 참조하는 code (card_link)
  - 정방향: card의 children (contains), depends_on, extends
- `contains` 관계는 **정방향**(src → dst)으로 탐색 (card의 하위 card)

```typescript
interface CardImpactResult {
  cardKey: string;
  depth: number;
  truncated: boolean;
  impactedCode: Array<{ entityKey: string; identityId: number; path: string[] }>;
  impactedCards: Array<{ cardKey: string; identityId: number; relationType: string; path: string[] }>;
  summary: { totalImpacted: number; codeCount: number; cardCount: number };
}
```

#### `card_status` (dashboard)

KB 전체 또는 특정 card의 건강 상태.

```typescript
interface CardStatusResult {
  scope: 'global' | string;
  cards: {
    total: number;
    byStatus: Record<CardStatus, number>;
    byPriority: Record<string, number>;
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

### 12.3 거버넌스 도구

- `rollback_approval`: v2와 동일 (§8.5 참조)
- `resolve_identity_candidates`: v2 §8.2 동일
- `apply_identity_rewrite`: v2 §8.3 동일 (card_link의 code_identity_id를 변경)

### 12.4 도구별 Bulk 지원 (v2 D-6 반영)

```typescript
interface RegisterCardBatchInput {
  cards: RegisterCardInput[];
}
```

> 단일 트랜잭션으로 다수의 card를 일괄 등록. 실패 시 전체 롤백.

### 12.5 기존 도구 변경

v2 §11.2 동일. 기존 18개 도구를 identity + active version JOIN 기반으로 전환.

추가 변경:
- `search`: card entity 검색 시 status/priority/tags 필터 지원
- `inconsistency_report`: card 고유 검사 추가 (§10.4 stale link, orphan card)
- `find_orphans`: "parent가 없는 non-root card" 검사 추가

---

## 13. 에러 및 예외 처리

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

### 13.2 `link_card` 에러

| 상황 | 처리 |
|------|------|
| code entity active version 없음 | 에러 + search로 유사 entity 추천 |
| card identity 없음 | 에러: "Card not found. Use register_card first." |
| card status = 'deprecated' | 에러: "Cannot link to deprecated card" |
| 이미 동일 link 존재 | upsert: meta 갱신, `link_updated` |

### 13.3 `update_card_status` 에러

| 상황 | 처리 |
|------|------|
| 잘못된 전이 | 에러: "Cannot transition from {from} to {to}" |
| 상한 제약 위반 | 에러: "Child status cannot exceed parent status" |

### 13.4 기타 에러

v2 §12의 나머지 에러 처리 계승 (identity matching, apply_identity_rewrite, rollback_approval 등).

---

## 14. 스키마 변경 상세

### 14.1 신규 테이블

| 테이블 | 용도 |
|--------|------|
| `entity_identity` | 불변 정체성 (§3.3) |
| `entity_version` | 가변 주소/상태 (§3.3) |
| `entity_lifecycle` | 생애 이벤트 로그 (§3.3) |
| `approval_event` | 거버넌스 이벤트 (§8.2) |
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

### 14.3 제거 테이블

| 테이블 | 시점 |
|--------|------|
| `entity` | migration 완료 후 제거 |
| `relation` | `card_link` + `card_relation` + `code_relation`으로 분리 후 제거 |
| `relation_evidence` | `card_evidence`로 대체 후 제거 |

### 14.4 Seed 데이터

```sql
-- entity_type: card 추가, claim 불필요
INSERT INTO entity_type (name) VALUES ('card')
  ON CONFLICT (name) DO NOTHING;
```

> v2에서 사용하던 `spec`, `claim` entity_type은 migration 후 제거.
> `relation_type`, `strength_type` 시드: code_relation에서만 사용. card_link/card_relation은 자체 CHECK.

### 14.5 성능 베이스라인 (v2 C-7 반영)

주요 쿼리의 성능 기준:

| 쿼리 | 목표 응답 시간 | 비고 |
|------|--------------|------|
| `resolveIdentity` (stable_key) | < 5ms | partial unique index |
| `resolveIdentity` (entity_key) | < 10ms | active version unique index |
| card_link stale 목록 | < 50ms | partial index on stale_status |
| coverage_map (depth 5) | < 200ms | recursive CTE + index |
| card_impact (depth 3) | < 100ms | BFS + index |

### 14.6 FTS 의존성 (v2 D-5 반영)

한국어 Full-Text Search를 위해 다음 중 하나 필요:
- `pg_bigm`: bigram 기반 (설치 간단)
- `pgroonga`: Groonga 기반 (정확도 높음)

> 기본은 PostgreSQL 내장 FTS. 한국어 지원이 필요한 경우 `pg_bigm` 권장. `docker-compose.yml`에 extension 설치 포함.

---

## 15. Migration Path (v1 → v3)

### 15.1 전략

v1 → v3 직접 migration. (v2는 설계 문서로만 존재하므로 v2 스키마가 배포된 적 없음)

| Phase | 내용 |
|-------|------|
| 1 | 신규 테이블 생성 |
| 2 | entity → entity_identity + entity_version 데이터 복사 (INSERT...RETURNING 방식) |
| 3 | relation → card_link + card_relation + code_relation 분리 |
| 4 | source/fact FK 전환 |
| 5 | 레거시 테이블 제거 |

### 15.2 Phase 2: Entity 매핑 (v2 A-3 반영)

> **v2의 ROW_NUMBER 매칭 문제 수정**: `INSERT...RETURNING`으로 안전한 1:1 매핑.

```sql
-- entity별로 INSERT → RETURNING으로 identity_id를 즉시 획득
-- PL/pgSQL 루프 또는 CTE WITH INSERT...RETURNING 사용

WITH inserted_identities AS (
  INSERT INTO entity_identity (workspace_id, entity_type_id, stable_key, created_at)
  SELECT
    e.workspace_id,
    e.entity_type_id,
    CASE WHEN et.name IN ('spec', 'claim') THEN e.entity_key ELSE NULL END,
    e.created_at
  FROM entity e
  JOIN entity_type et ON et.id = e.entity_type_id
  ORDER BY e.id
  RETURNING id, workspace_id, stable_key, created_at
)
-- 매핑 테이블은 entity.id 순서와 inserted identity를 entity_key/workspace_id로 JOIN
INSERT INTO entity_to_identity_map (entity_id, identity_id, entity_key, workspace_id)
SELECT e.id, ii.id, e.entity_key, e.workspace_id
FROM entity e
JOIN entity_type et ON et.id = e.entity_type_id
JOIN inserted_identities ii ON ii.workspace_id = e.workspace_id
  AND COALESCE(ii.stable_key, '') = COALESCE(
    CASE WHEN et.name IN ('spec', 'claim') THEN e.entity_key ELSE NULL END, ''
  )
  AND ii.created_at = e.created_at;
```

> **검증**: entity 수 == identity 수 == map 수. 불일치 시 즉시 중단.

### 15.3 Phase 3: relation 분리

```sql
-- relation_type별로 대상 테이블 분배
-- implements → card_link
-- contains, depends_on, extends → card_relation
-- imports, extends(code), calls → code_relation
```

### 15.4 롤백 계획

각 phase를 개별 트랜잭션으로 실행. phase 간 검증 체크포인트.

### 15.5 Dual-Write / Dual-Read

v2 §15.5 동일 패턴. `BUNNER_V3_ENABLED` feature flag.

---

## 16. 구현 순서

### 16.1 단계별 작업

| 단계 | 작업 | 의존성 | 위험도 |
|------|------|--------|--------|
| **0** | Preflight: 회귀 테스트 베이스라인 확보 | 없음 | 낮 |
| **1** | v3 스키마 생성 (identity, version, lifecycle, approval_event, card_link, card_relation, code_relation, card_evidence) | 없음 | 낮 |
| **2** | Migration 스크립트 (INSERT...RETURNING + relation 분리) + 검증 | 1 | **높** |
| **3** | Repo 계층 분리 (identity-repo, version-repo, card-link-repo, card-relation-repo) | 2 | 높 |
| **3b** | Dual-read adapter | 3 | 중 |
| **4** | Card 도구 구현 (register_card, link_card, unlink_card, move_card, update_card_status, relate_cards, unrelate_cards) | 3b | 중 |
| **5** | 거버넌스 도구 (rollback_approval + payload 검증) | 4 | 중 |
| **6** | 분석 도구 (card_impact, card_status, coverage_map) | 4 | 중 |
| **7** | Sync worker 재작성 (version append + @card 파싱 + stale detection) | 3b | **높** |
| **8** | Purge 재작성 (lifecycle FK 처리 + COALESCE identity purge) | 7 | 높 |
| **9** | Identity resolution (resolve_identity_candidates + apply_identity_rewrite) | 4 | 중 |
| **10** | 기존 18개 도구 쿼리 전환 | 3b | 높 |
| **11** | 호환성 모드 종료 + 레거시 제거 | 10 완료 + 검증 | **높** |

### 16.2 호환성 모드

v2 §16.2 동일 패턴. `BUNNER_V3_ENABLED` feature flag로 점진적 전환.

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

v2 §17.6 동일. `pg_advisory_xact_lock(identity_id)`.

### 17.7 `.card.md` 파서 (v3.1)

`.card.md` 파일을 sync 파서가 인식하여 card를 자동 등록.

### 17.8 approval_event Archive Policy (v3.1)

v2 §17.5 동일.

### 17.9 Weighted Scoring for Identity Candidates (v3.1)

v2 §17.2 동일.

### 17.10 Multi-workspace Card Sharing (v3.2)

공통 card를 여러 workspace에서 참조.

### 17.11 Access Control / Ownership (v3.2)

card owner/reviewer 지정.

---

## 부록 A: 용어 정의

| 용어 | 정의 |
|------|------|
| **card** | 1급 지식 객체. 요구사항·기능 명세를 표현하는 nested tree의 노드. v2의 spec/claim을 통합 |
| **entity_identity** | entity의 전 생애 불변 정체성. card_link/code_relation이 참조하는 대상 |
| **entity_version** | entity의 특정 시점 상태 (주소, 내용, 메타). 가변 |
| **entity_key** | entity_version에 저장되는 현재 주소. 형식: `{type}:{identifier}` |
| **stable_key** | card entity의 불변 식별자. `card::{path}` 형식 |
| **identity matching** | content_hash를 이용해 기존 identity에 새 version을 연결하는 과정 |
| **approval_event** | 수동/반자동 상태 전이를 기록하는 1급 이벤트. 거버넌스의 단일 진실 소스 |
| **entity_lifecycle** | identity의 생애 이벤트 로그 |
| **card_link** | card↔code 구현 관계. anchor, rationale, stale_status 포함 |
| **card_relation** | card↔card 관계 (contains, depends_on, extends) |
| **code_relation** | code↔code 정적 분석 관계 (imports, extends, calls) |
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
| `tooling/mcp/src/tools/dashboard.ts` | **신규** | card_impact, card_status, coverage_map |
| `tooling/mcp/src/repo/identity-repo.ts` | **신규** | entity_identity CRUD |
| `tooling/mcp/src/repo/version-repo.ts` | **신규** | entity_version CRUD + status 전이 |
| `tooling/mcp/src/repo/card-link-repo.ts` | **신규** | card_link CRUD + stale 관리 |
| `tooling/mcp/src/repo/card-relation-repo.ts` | **신규** | card_relation CRUD + cycle 검사 |
| `tooling/mcp/src/repo/code-relation-repo.ts` | **신규** | code_relation CRUD + orphan cleanup |
| `tooling/mcp/src/repo/card-evidence-repo.ts` | **신규** | card_evidence CRUD |
| `tooling/mcp/src/repo/approval-repo.ts` | **신규** | approval_event 기록/조회 + payload 검증 |
| `tooling/mcp/src/repo/lifecycle-repo.ts` | **신규** | entity_lifecycle 기록/조회 |
| `tooling/mcp/src/repo/entity-repo.ts` | **제거** | identity-repo + version-repo로 대체 |
| `tooling/mcp/src/repo/relation-repo.ts` | **제거** | card-link-repo + card-relation-repo + code-relation-repo로 대체 |
| `tooling/mcp/src/sync-worker.ts` | **재작성** | version append + @card 파싱 + stale detection |
| `tooling/mcp/src/kb.ts` | 수정 | SyncAction 확장, 새 repo 래퍼 |
| `tooling/mcp/src/repo/sync-event-repo.ts` | 수정 | FK 변경 |
| `tooling/mcp/src/repo/source-repo.ts` | 수정 | FK를 version 참조로 변경 |
| `tooling/mcp/src/repo/fact-repo.ts` | 수정 | FK를 version 참조로 변경 |
| `tooling/mcp/src/read-through.ts` | 수정 | `__manual__/` 예외 + version 기준 |
| `tooling/mcp/drizzle/migrations/` | **신규** | v1→v3 migration SQL |

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
| T2-1 | root card 등록 | `register_card({cardKey: "card::auth"})` | identity 생성, version active, source `__manual__/card/card::auth` |
| T2-2 | child card 등록 | `register_card({cardKey: "card::auth/login", parentCardKey: "card::auth"})` | identity 생성, contains relation 자동 생성 |
| T2-3 | nested card 등록 | `register_card({cardKey: "card::auth/login/oauth", parentCardKey: "card::auth/login"})` | 3레벨 depth 정상 |
| T2-4 | card 갱신 | body 변경하여 재호출 | 기존 version archived, 새 version active, `card_updated` |
| T2-5 | card 동일 내용 | 같은 body로 재호출 | `unchanged` |
| T2-6 | link 생성 | `link_card(...)` | card_link 생성, card_evidence 생성, `link_created` |
| T2-7 | link 중복 | 같은 pair 재호출 | upsert, `link_updated` |
| T2-8 | unlink | `unlink_card(...)` | card_link 삭제, `link_removed` |
| T2-9 | move_card | parent 변경 | 기존 contains 삭제, 새 contains 생성, `card_reparented` |
| T2-10 | move_card 순환 | child를 parent로 이동 시도 | 에러: "Circular reference" |

### C.3 Card Lifecycle

| # | 시나리오 | 수행 | 기대 결과 |
|---|----------|------|-----------|
| T3-1 | draft → proposed | `update_card_status` | status 변경, `card_status_changed` |
| T3-2 | 잘못된 전이 | draft → verified | 에러: "Cannot transition" |
| T3-3 | deprecated 전파 | parent deprecated | 모든 children도 deprecated |
| T3-4 | 상한 제약 | parent=accepted, child=verified 시도 | 에러: "Cannot exceed parent" |

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

## 부록 D: v1 대비 변경 요약

| 영역 | v1 | v3 | 변경 이유 |
|------|----|----|-----------|
| 정체성 담체 | `entity.id` | `entity_identity.id` | 스키마 수준 강제 |
| 파일 이동 처리 | entity_key rewrite | version append | 복잡도 제거 |
| grace window | 필요 | **불필요** | identity가 보호 |
| 스펙 모델 | 1 spec = 1 blob | **card nested tree** (depth 무제한) | 계층적 요구사항 관리 |
| entity_type | spec, claim | **card** (단일) | 통합 모델 |
| 관계 테이블 | relation (단일) | **card_link + card_relation + code_relation** (3종) | 성격별 분리 |
| evidence | relation_evidence (fact 참조만) | **card_evidence** (5종 다형성) | test, annotation 등 |
| card 속성 | 없음 | **status, priority, tags, weight, template, external_refs** | 분류/필터/가중치 |
| card lifecycle | 없음 | **7단계 state machine + 하위 전파** | 워크플로우 추적 |
| coverage | flat 비율 | **재귀 가중 집계 + tag 횡단** | 정밀한 진행률 |
| 감사 모델 | sync_event | approval_event (CHECK + payload 검증) | 거버넌스 |
| 되돌리기 | 없음 | rollback_approval | Reversibility |
| purge | 물리 삭제 | version purge (evidence 보존) → identity purge (COALESCE fallback) | 감사 보존 |
| KB 중심 | code-centric | **card-centric** | 요구사항 중심 |
| 연결 방향 | code→spec 수동만 | + **@card 자동, glob pattern, external_refs** | 양방향 |
| 구현 전략 | big-bang | dual-read + feature flag | 점진적 전환 |
| 도구 | 기존 18개 + 8개 (v2) | 기존 18개 + **12개** (register_card, link_card, unlink_card, move_card, update_card_status, relate_cards, unrelate_cards, card_impact, card_status, coverage_map, rollback_approval, resolve/apply) | card 모델 + lifecycle |

---

> **문서 상태**: 초안. 재검토 후 완성도 높여갈 예정.
