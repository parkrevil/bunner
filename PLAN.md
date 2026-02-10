# 스펙-코드 링크 유지 설계

> **범위**: bunner-kb MCP 서버에 스펙(spec) 등록·링크·정체성 유지 기능 추가  
> **상태**: 설계 확정 (구현 전)  
> **관련 코드**: `tooling/mcp/`

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

### 1.3 설계 목표

- 파일 이동(내용 동일) 시 링크가 **자동으로 유지**되어야 한다
- 파일 분리/통합/심볼 리네임 시 링크 **후보를 제시**하고 **인간이 승인**해야 한다
- 수동 링크는 **절대 자동 삭제되지 않아야** 한다
- 링크에는 **"왜 연결했는지"(rationale)**가 항상 남아야 한다

---

## 2. 정체성(Identity) 모델

### 2.1 핵심 원칙

> **`entity.id`(serial PK)가 진짜 정체성이다. `entity_key`는 변경 가능한 주소(address)일 뿐이다.**

현재 DB 구조에서 `relation.src_entity_id`와 `relation.dst_entity_id`는 `entity.id`를 FK로 참조한다. 따라서 **`entity.id`만 유지되면 relation은 깨지지 않는다.** `entity_key`가 바뀌더라도.

### 2.2 계층별 정체성 정의

| 레벨 | Identity (불변) | Address (가변) | 매칭 신호 |
|------|-----------------|----------------|-----------|
| **Module** | `entity.id` | `module:{file_path}` | `source.content_hash` (SHA-256) |
| **Symbol** | `entity.id` | `symbol:{file_path}#{symbol_name}` | 부모 module의 identity + `symbol_name` |
| **Spec** | `entity.id` | `spec::{spec_name}` | 사용자 지정 (변경 불가, 불변) |

### 2.3 정체성 유지의 의미

"파일 `a.ts`가 `b.ts`로 이동"되었을 때:
- **현재**: `module:a.ts` tombstone + `module:b.ts` 신규 생성 → 두 entity는 **별개의 `entity.id`**
- **변경 후**: `module:a.ts`의 `entity_key`를 `module:b.ts`로 **UPDATE** → **같은 `entity.id`** 유지 → 모든 relation FK 자동 유지

> ⚠️ **정밀 설명**: "파일 이동 시 항상 새 entity.id 생성"은 현재 sync의 **기본 동작**을 설명한 것이다. content_hash rewrite(§4)가 이를 **가로채서** 기존 entity.id를 유지하는 것이 본 설계의 핵심이다. 즉, rewrite가 정상 동작하면 새 entity.id는 생성되지 **않는다**. rewrite에 실패한 경우에만(1:N, N:1 등) 현재 동작(tombstone + 새 entity)이 fallback으로 실행된다.

---

## 3. 링크 유지 전략: 계층적 방어

### 3.1 개요

```
┌─────────────────────────────────────────────────┐
│  계층 1: content_hash 기반 entity key rewrite    │ ← 자동 (결정론적)
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

---

## 4. 계층 1: content_hash 기반 Entity Key Rewrite

### 4.1 동작 원리

`startupScan()`(full sync) 시점에서, DB의 source 레코드와 파일 시스템 스캔 결과를 교차 비교한다.

**현재 `startupScan`이 이미 보유한 데이터:**

| 출처 | 데이터 | 위치 |
|------|--------|------|
| DB | `(file_path, content_hash, entity_id, entity_key, is_deleted)` | `source JOIN entity` 쿼리 결과 |
| 파일 시스템 | `(filePath, contentHash)` | `scanFiles()` 결과 |

**rename 감지 로직:**

```
DB에 있지만 파일시스템에 없는 source  →  deletedSources = { file_path → content_hash, entity_id }
파일시스템에 있지만 DB에 없는 파일     →  newFiles = { file_path → content_hash }
```

이 두 집합에서 **content_hash가 동일한 (deleted, new) 쌍**을 찾는다.

### 4.2 매칭 조건 (전부 충족해야 자동 적용)

1. `deletedSource.content_hash === newFile.contentHash` (파일 내용 동일)
2. 매칭이 **1:1** (같은 hash로 여러 후보가 있으면 자동 적용 금지)
3. 같은 sync run 내의 (삭제, 생성) 쌍

### 4.3 Rewrite 트랜잭션

매칭이 확정되면, **단일 트랜잭션** 내에서 다음을 수행한다:

#### 4.3.1 직접 UPDATE하는 대상

| 테이블 | 변경 내용 | 이유 |
|--------|-----------|------|
| `entity.entity_key` | `module:old_path` → `module:new_path` | canonical address 변경 |
| `source.file_path` | `old_path` → `new_path` | stale 검증/scan 기준 |

module entity를 rewrite하면, 해당 module에 속한 **모든 symbol entity**의 key prefix도 일괄 변경한다:

```sql
UPDATE entity
SET entity_key = 'symbol:' || {new_path} || '#' || split_part(entity_key, '#', 2),
    updated_at = now()
WHERE workspace_id = {workspace_id}
  AND entity_key LIKE 'symbol:{old_path}#%'
  AND is_deleted = false
```

symbol의 source도 동일하게:

```sql
UPDATE source
SET file_path = {new_path}
WHERE workspace_id = {workspace_id}
  AND file_path = {old_path}
```

#### 4.3.1.1 Source Unique Constraint 충돌 처리

`source` 테이블의 unique constraint: `(workspace_id, kind, file_path, span_start, span_end)`

rewrite 시 target 경로(`new_path`)에 이미 source가 존재할 수 있는 경우:

| 상황 | 발생 조건 | 처리 |
|------|-----------|------|
| startupScan에서 rewrite | rename detection은 tombstone/enqueue **전에** 실행되므로, new_path에 아직 source 없음 | **충돌 없음** (정상) |
| watch grace window에서 rewrite | 새 파일이 먼저 `processFile`로 처리되어 source가 생긴 후, pending_delete에서 rewrite 시도 | **충돌 가능** |

**watch 충돌 시 처리 규칙**:
1. new_path에 이미 source가 존재하면, 그 source가 가리키는 entity의 `entity.id`를 확인
2. 만약 새 entity가 이미 생성되었고, 기존 entity(pending_delete 대상)와 **다른 `entity.id`**를 가진다면:
   - rewrite를 **포기**하고, pending_delete 항목은 정상적으로 tombstone 처리
   - 이 경우 manual link는 깨지며, `resolve_identity_candidates`로 사후 복구
3. 만약 새 entity가 없거나 source만 존재한다면:
   - 기존 source를 **UPDATE**로 덮어씀 (entity_id를 rewrite 대상으로 변경)

#### 4.3.2 직접 UPDATE하지 않는 대상 (파생 데이터 재생성)

| 테이블 | 이유 |
|--------|------|
| `fact.*` (fact_key, payload_json, payload_text) | 파서가 생성한 파생 데이터. 다음 sync에서 재파싱 → upsert + orphan fact cleanup으로 자연 갱신 |
| `relation` (파서 생성 relation의 meta, dst 등) | 파서가 생성한 파생 데이터. 다음 sync에서 재생성 |

rewrite 트랜잭션 완료 후, **해당 파일을 sync 큐에 enqueue**하면 파서가 새 경로 기준으로 fact/relation을 재생성한다. orphan fact cleanup(`deleteOrphanFacts`)이 이전 fact를 정리한다.

> **주의: relation orphan cleanup**  
> 현재 sync 경로에는 fact orphan cleanup만 존재하고, **relation orphan cleanup은 없다** (`sync-worker.ts`의 `commitExtraction`에서 fact만 `deleteOrphanFacts` 호출). 파서가 생성하는 relation(예: `depends_on`, `exports`)도 경로 변경 시 이전 dst를 가리키는 relation이 누적될 수 있다.
>
> **해결**: `commitExtraction`에 `deleteOrphanRelations` 단계를 추가한다. fact와 동일한 패턴:
> 1. 파서가 현재 파싱에서 생성한 relation을 `retainedRelations` 집합으로 추적 (src_entity_key + dst_entity_key + relation_type 조합)
> 2. 해당 entity의 outgoing relation 중, `retainedRelations`에 포함되지 않고 `strength != 'manual'`인 relation을 삭제
> 3. **`strength = 'manual'`인 relation은 절대 삭제하지 않음** (수동 링크 보호 원칙)
>
> 이를 위해 `relation-repo.ts`에 `deleteOrphanRelations` 메서드를 추가하고, `kb.ts`에 래퍼를 추가한다.

#### 4.3.3 감사 기록

`sync_event`에 다음을 기록한다:

| 필드 | 값 |
|------|----|
| `action` | `'renamed'` (새 action 타입 추가) |
| `entity_id` | rewrite된 entity의 id |
| `prev_content_hash` | 파일의 content_hash (rewrite 전후 동일) |
| `new_content_hash` | 파일의 content_hash (rewrite 전후 동일) |

rename의 이전/이후 entity_key는 `sync_event`의 hash 필드가 아닌, **별도 방식으로 기록**한다:

- **방식**: `entity.meta`에 `{ renamedFrom: "module:old_path", renamedAt: "ISO8601" }` 저장
- **이유**: `prev_content_hash`/`new_content_hash` 필드에 entity_key 문자열을 넣으면 필드의 semantic이 깨진다. 감사 로그 분석 시 "이 값이 hash인지 key인지" 구분이 불가능해진다.

> **참고**: `sync_event.action`에 `'renamed'` 값을 추가해야 한다. 현재는 `'created' | 'updated' | 'deleted' | 'restored'`만 존재.

### 4.4 적용 시점

| 트리거 | rewrite 적용 | 비고 |
|--------|-------------|------|
| `startupScan()` (startup/full sync) | **적용** | 삭제 대상과 신규 파일을 동시에 파악 가능 |
| `processFile()` (watch/개별 파일) | **미적용** | 파일 하나만 보므로 rename 판단 불가. 아래 §4.5 참고 |

### 4.5 Watch 트리거에서의 지연 Tombstone

watch(inotify) 이벤트는 "파일 삭제"와 "파일 생성"이 별도 이벤트로 도착한다. 즉시 tombstone하면 rename을 놓친다.

**해결: Grace Window (2~5초)**

1. 삭제 이벤트 수신 시, 즉시 tombstone하지 않고 **pending_delete 큐**에 `{ filePath, contentHash, entityId, timestamp }` 저장
2. 생성 이벤트 수신 시, pending_delete 큐에서 **content_hash가 동일한 항목** 검색
   - 매칭 성공: rename으로 처리 (entity_key rewrite)
   - 매칭 실패: pending_delete 항목 유지, 생성은 정상 처리
3. Grace window(기본 3초) 경과 후, pending_delete에 남아있는 항목은 **정상적으로 tombstone 처리**

**구현 위치**: `sync-worker.ts`의 `handleDeletedFile()` 전단에 pending_delete 로직 추가.

**Grace window 설정**: `KBConfig.sync.renameGraceWindowMs` (기본값: 3000)

#### 4.5.1 Grace Window Edge Case 처리 규칙

| # | 시나리오 | 이벤트 시퀀스 | 처리 규칙 |
|---|----------|---------------|-----------|
| E1 | **정상 rename** | DELETE(a.ts) → CREATE(b.ts), hash 동일 | pending_delete에서 a.ts 제거, entity key rewrite 실행 |
| E2 | **역순 이벤트** (OS/watcher에 따라 가능) | CREATE(b.ts) → DELETE(a.ts), hash 동일 | CREATE 시점에는 pending_delete에 a.ts가 없으므로 정상적으로 새 entity 생성. 이후 DELETE 시 a.ts를 pending_delete에 넣고, 새로 생성된 b.ts와 hash 비교. 이미 b.ts entity가 존재하므로 **rewrite 불가** → a.ts는 tombstone, 결과적으로 두 entity가 됨. `resolve_identity_candidates`로 사후 복구 |
| E3 | **동일 hash 복수 생성** (파일 복사) | DELETE(a.ts) → CREATE(b.ts) + CREATE(c.ts), 3개 hash 동일 | 1:N 매칭이므로 자동 rewrite **금지**. pending_delete 항목은 grace window 만료 후 tombstone |
| E4 | **연쇄 이벤트** | DELETE(a.ts) → CREATE(b.ts) → DELETE(b.ts), 모두 hash 동일 | 첫 DELETE→CREATE: rewrite(a→b). 두 번째 DELETE(b): 새 pending_delete 항목 생성. grace window 만료 시 tombstone |
| E5 | **grace window 내 내용 변경** | DELETE(a.ts) → CREATE(b.ts), hash **불일치** | pending_delete에서 매칭 실패. a.ts는 grace window 만료 후 tombstone, b.ts는 새 entity |
| E6 | **grace window 만료 후 생성** | DELETE(a.ts) → (3초 경과) → CREATE(b.ts), hash 동일 | a.ts는 이미 tombstone됨. b.ts는 새 entity. `resolve_identity_candidates`로 사후 복구 |
| E7 | **중복 DELETE 이벤트** | DELETE(a.ts) → DELETE(a.ts) | pending_delete에 이미 존재하면 **무시** (idempotent). file_path를 key로 중복 판단 |

**pending_delete 자료구조**:
```typescript
type PendingDelete = Map<string, {  // key: filePath
  contentHash: string;
  entityId: number;
  timestamp: number;
  timerId: ReturnType<typeof setTimeout>;
}>;
```

**타이머 관리**: 각 pending_delete 항목은 개별 타이머를 갖는다. 매칭 성공 시 `clearTimeout(timerId)`로 타이머 취소.

---

## 5. 계층 2: Identity Resolution (인간 승인 기반)

### 5.1 대상 케이스

content_hash rewrite가 커버하지 못하는 경우:

| 케이스 | 왜 자동 실패하는가 |
|--------|-------------------|
| 파일 이동 + 내용 변경 | content_hash 불일치 |
| 파일 분리 (1 → N) | old file의 hash와 매칭되는 new file이 없음 |
| 파일 통합 (N → 1) | 여러 old file이 하나의 new file에 대응 |
| 심볼 리네임 (파일 내) | entity_key의 `#` 이후 부분이 변경됨 |

### 5.2 도구: `resolve_identity_candidates`

깨진 링크(spec과 연결된 entity가 tombstone이거나 missing)를 감지하고, **후보 entity 목록을 반환**한다. 자동 적용 없음.

#### 입력 스키마

```typescript
type ResolveIdentityCandidatesInput = {
  /** 특정 spec만 검사. 생략 시 모든 깨진 링크 스캔 */
  specKey?: string;
  /** 반환할 후보 수 상한 (기본값: 5) */
  maxCandidates?: number;
};
```

#### 동작 절차

1. `relation` 테이블에서 `strength_type.name = 'manual'` AND `relation_type.name = 'implements'`인 관계를 조회
2. 각 관계의 `src_entity_id`가 가리키는 entity가 `is_deleted = true`이거나, 해당 entity의 source가 가리키는 파일이 파일시스템에 존재하지 않으면 → **깨진 링크**
3. 깨진 링크의 `relation.meta`에 저장된 앵커 정보(§6.3에서 정의)를 기반으로 후보 검색:
   - `meta.anchor.symbolName`으로 **기존 FTS 인프라** 활용: `fact.payload_tsv @@ plainto_tsquery(symbolName)` + `ts_rank_cd`로 관련도 정렬
   - `entity_type` 필터 (같은 타입만)
   - `is_deleted = false` 필터 (살아있는 entity만)

   > **참고**: fact 테이블에 이미 `payload_tsv` (tsvector) 컬럼이 존재하고, 파서가 심볼명/시그니처를 text로 저장하고 있다. 별도 인덱스 추가 없이 기존 인프라를 재사용한다.
4. 결과를 반환 (자동 적용 없음)

#### 출력 스키마

```typescript
type ResolveIdentityCandidatesResult = {
  brokenLinks: Array<{
    /** 깨진 relation의 id */
    relationId: number;
    /** spec entity key */
    specKey: string;
    /** 원래 연결되어 있던 entity key (현재 tombstone 또는 missing) */
    originalEntityKey: string;
    /** relation.meta에 저장된 앵커 정보 */
    anchor: LinkAnchor;
    /** 후보 entity 목록 */
    candidates: Array<{
      entityKey: string;
      entityType: string;
      summary: string | null;
      /** 매칭 근거 (어떤 앵커가 일치했는지) */
      matchReason: string;
    }>;
  }>;
  totalBroken: number;
};
```

### 5.3 도구: `apply_identity_rewrite`

사용자가 `resolve_identity_candidates`의 결과를 검토하고, 승인한 매칭을 적용한다.

#### 입력 스키마

```typescript
type ApplyIdentityRewriteInput = {
  /** 적용할 매칭 목록 */
  rewrites: Array<{
    /** 깨진 relation의 id */
    relationId: number;
    /** 새로 연결할 entity key */
    newEntityKey: string;
  }>;
};
```

#### 동작 절차

각 rewrite 항목에 대해 **단일 트랜잭션**으로:

1. `newEntityKey`로 entity 조회 → `newEntityId` 획득
2. relation의 `src_entity_id`를 `newEntityId`로 UPDATE
3. `relation.meta`에 마이그레이션 기록 추가:
   ```json
   {
     "migratedFrom": "symbol:old_path#foo",
     "migratedAt": "2026-02-10T...",
     "migratedBy": "apply_identity_rewrite"
   }
   ```
4. **evidence 재연결** (아래 §5.3.1 evidence 정책 참조)
5. `sync_event`에 `action: 'renamed'` 기록

#### 5.3.1 Evidence 재연결 정책

`apply_identity_rewrite`가 relation의 `src_entity_id`를 변경하면, 기존 evidence(옛 entity의 fact에 연결)와 새 evidence(새 entity의 fact)가 공존하는 문제가 발생한다.

**정책: 기존 evidence 유지 + 새 evidence 추가 (append-only)**

| 단계 | 동작 |
|------|------|
| 1 | 기존 `relation_evidence` 레코드는 **삭제하지 않음** (옛 근거 보존) |
| 2 | 새 entity의 `manual_link` fact가 있으면 evidence에 추가 연결 |
| 3 | 새 entity의 `signature` fact가 있으면 evidence에 추가 연결 (앵커 검증용) |
| 4 | `relation_evidence`의 PK `(relation_id, fact_id)`가 중복이면 `INSERT ... ON CONFLICT DO NOTHING` |

**근거**: evidence는 "왜 이 링크가 존재하는지"의 이력이다. 옛 evidence를 삭제하면 원래 링크의 근거가 소실된다. 새 evidence를 추가하면 "원래 이유 + 재연결 이유"가 모두 남는다.

**정리 시점**: 옛 entity가 `purge_tombstones`로 물리 삭제되면, 옛 entity의 fact도 cascade 삭제되고, `relation_evidence`에서 해당 fact_id 레코드도 cascade 삭제된다. 즉 **자연스럽게 정리**된다.

#### 충돌 처리

relation의 unique constraint: `(src_entity_id, dst_entity_id, relation_type_id, strength_type_id)`

새 `(newEntityId, specEntityId, implements, manual)` 조합이 이미 존재하면:
- 기존 relation의 `meta`를 병합 (rationale 보존)
- 중복 relation은 생성하지 않음
- 옛 relation의 `meta`에 `{ supersededBy: newRelationId }` 표시

#### 출력 스키마

```typescript
type ApplyIdentityRewriteResult = {
  applied: number;
  skipped: number;
  details: Array<{
    relationId: number;
    status: 'applied' | 'skipped_already_exists' | 'skipped_entity_not_found';
    newEntityKey?: string;
  }>;
};
```

---

## 6. 계층 3: 수동 도구

### 6.1 도구: `register_spec`

스펙 entity를 KB에 수동 등록한다.

#### 입력 스키마

```typescript
type RegisterSpecInput = {
  /** 스펙 키. 형식: "spec::{name}". 예: "spec::di-container", "spec::auth-flow" */
  specKey: string;
  /** 스펙 요약 (1~2줄) */
  summary: string;
  /** 스펙 본문 (마크다운) */
  body: string;
  /** 추가 메타데이터 */
  meta?: Record<string, unknown>;
};
```

#### 동작 절차

**단일 트랜잭션**으로:

1. **Entity 생성/갱신**
   ```
   entity_key:    specKey (예: "spec::di-container")
   entity_type:   "spec"
   summary:       입력의 summary
   meta:          입력의 meta ?? {}
   is_deleted:    false
   ```
   - 이미 존재하면 upsert (summary, meta 갱신)

2. **Source 생성/갱신**
   ```
   kind:          "spec"
   file_path:     "__manual__/spec/{specKey}" (가상 경로)
   content_hash:  SHA-256(body)
   ```
   - `__manual__/` prefix는 read-through stale 검증에서 **제외**해야 함 (파일시스템에 실제 파일이 없으므로)

3. **Fact 생성**
   ```
   fact_type:     "spec_body"
   fact_key:      "body:{specKey}"
   payload_text:  body (FTS 인덱싱 대상)
   payload_json:  { format: "markdown", version: 1 }
   content_hash:  SHA-256(body)
   ```

4. **감사 기록**
   `sync_event`에 `action: 'created'` 또는 `'updated'` 기록

#### 출력 스키마

```typescript
type RegisterSpecResult = {
  specKey: string;
  entityId: number;
  action: 'created' | 'updated';
};
```

#### 스펙 키 규칙

- 형식: `spec::{name}` (콜론 두 개)
- `name`은 kebab-case 권장: `di-container`, `auth-flow`, `pipeline-v2`
- 한번 등록된 `specKey`는 변경 불가. 변경이 필요하면 별도 도구(`rename_spec_key`, 향후 구현)로만 허용
- 본문 변경은 `register_spec` 재호출로 처리 (upsert). `content_hash`로 변경 감지

### 6.2 도구: `link_spec`

스펙과 코드 entity 사이에 `implements` 관계를 수동으로 생성한다.

#### 입력 스키마

```typescript
type LinkSpecInput = {
  /** 코드 entity key. 예: "symbol:packages/core/src/app.ts#createApplication" */
  codeEntityKey: string;
  /** 스펙 entity key. 예: "spec::di-container" */
  specKey: string;
  /** 왜 이 코드가 이 스펙을 구현하는지에 대한 근거 (필수) */
  rationale: string;
};
```

#### 동작 절차

**단일 트랜잭션**으로:

1. **코드 entity 존재 확인**
   - `codeEntityKey`로 entity 조회 (`is_deleted = false`)
   - 존재하지 않으면: **에러 반환** + `search` 도구로 후보 추천
   - 에러 메시지에 유사한 entity key 목록 포함

2. **스펙 entity 존재 확인**
   - `specKey`로 entity 조회 (`entity_type.name = 'spec'`)
   - 존재하지 않으면: 에러 반환 ("먼저 register_spec으로 등록하세요")

3. **앵커 정보 수집** (relation.meta에 저장할 데이터)

   코드 entity의 fact를 조회하여 앵커를 구성한다:

   ```typescript
   type LinkAnchor = {
     /** 링크 생성 시점의 entity_key */
     entityKey: string;
     /** 심볼 이름 (entity_key에서 '#' 이후 부분) */
     symbolName: string | null;
     /** source.file_path */
     filePath: string;
     /** entity_type.name */
     entityType: string;
     /** signature fact의 payload_text (있으면) */
     signatureText: string | null;
     /** kind fact의 payload_text (있으면). 예: "function", "class" */
     symbolKind: string | null;
   };
   ```

4. **Relation 생성**
   ```
   src_entity_id:   코드 entity의 id
   dst_entity_id:   스펙 entity의 id
   relation_type:   "implements"
   strength:        "manual"
   meta: {
     anchor: <위에서 수집한 LinkAnchor>,
     rationale: <입력의 rationale>,
     linkedAt: <ISO 8601 타임스탬프>,
     linkedBy: "link_spec"
   }
   ```

5. **Rationale Fact 생성** (evidence용)
   ```
   entity_id:     코드 entity의 id
   fact_type:     "manual_link"
   fact_key:      "manual_link:{specKey}"
   payload_text:  rationale
   payload_json:  { specKey, linkedAt }
   ```

6. **Evidence 연결**
   - 위에서 생성한 `manual_link` fact의 id를 `relation_evidence`에 연결
   - 기존의 "src entity의 모든 fact를 evidence로 연결"하는 방식이 아닌, **이 fact만 타깃팅**

#### 출력 스키마

```typescript
type LinkSpecResult = {
  relationId: number;
  codeEntityKey: string;
  specKey: string;
  action: 'created' | 'updated';
};
```

### 6.3 relation.meta에 저장되는 앵커의 역할

앵커(`LinkAnchor`)는 두 가지 목적으로 사용된다:

1. **계층 1 (content_hash rewrite) 이후 잔여 검증**: rewrite가 정상 수행되었는지 확인할 때 앵커의 `symbolName`과 실제 entity를 대조
2. **계층 2 (resolve_identity_candidates)의 검색 근거**: tombstone entity에 접근하지 않고도, relation.meta만으로 후보 검색 가능

**핵심**: 앵커는 **링크 생성 시점에 한 번만 기록**된다. tombstone entity의 fact에 의존하지 않는다. 따라서 `purge_tombstones`로 entity가 삭제되어도 앵커 정보는 relation.meta에 보존된다.

---

## 7. Purge 정책: 수동 링크 보호

### 7.1 문제

현재 `purgeTombstones()`:

```typescript
// entity-repo.ts
const deleted = await ctx.db
  .delete(schema.entity)
  .where(
    and(
      eq(schema.entity.workspaceId, workspaceId),
      eq(schema.entity.isDeleted, true),
      sql`${schema.entity.updatedAt} < now() - ${olderThanDays} * interval '1 day'`,
    ),
  )
  .returning({ id: schema.entity.id });
```

entity가 DELETE되면 `relation`이 **FK cascade로 함께 삭제**된다 (`onDelete: 'cascade'`). 수동 링크의 rationale, 앵커 정보가 전부 소실된다.

### 7.2 해결: Manual Link 보호 조건 추가

`purgeTombstones` 쿼리에 다음 조건을 추가한다:

```sql
AND NOT EXISTS (
  SELECT 1
  FROM relation r
  JOIN strength_type st ON st.id = r.strength_type_id
  WHERE (r.src_entity_id = entity.id OR r.dst_entity_id = entity.id)
    AND st.name = 'manual'
)
```

**의미**: `strength = 'manual'`인 relation에 참여하는 entity는 tombstone이라도 purge하지 않는다.

### 7.3 보호 대상

| entity 역할 | 보호 여부 | 이유 |
|-------------|-----------|------|
| spec entity (dst) | 보호 | 스펙 자체가 삭제되면 모든 링크 소실 |
| code entity (src) — tombstone | 보호 | 링크의 앵커 정보와 rationale이 relation.meta에 있지만, relation 자체가 cascade 삭제되면 소실 |

### 7.4 content_hash rewrite와의 상호작용

content_hash rewrite가 정상 동작하면 **코드 entity가 tombstone되지 않으므로** purge 보호가 필요한 케이스 자체가 감소한다. purge 보호는 **마지막 안전장치**이다.

### 7.5 보호 해제 경로

수동 링크 보호된 tombstone entity가 영구 누적되는 것을 방지하기 위한 해제 조건:

| 해제 조건 | 설명 |
|-----------|------|
| **명시적 해제** | `apply_identity_rewrite`로 relation이 새 entity에 재연결되면, 옛 entity는 더 이상 manual relation에 참여하지 않게 되어 purge 보호 자동 해제 |
| **relation 삭제** | `unlink_spec` (향후 구현) 등으로 manual relation을 명시적으로 삭제하면 보호 해제 |
| **superseded** | `apply_identity_rewrite`의 충돌 처리에서 `supersededBy` 표시된 relation → 해당 relation의 `strength`를 `'inferred'`로 격하하여 보호 해제 |

**TTL 자동 해제는 도입하지 않는다.** 수동 링크의 보존은 사용자 의도에 기반하므로, 해제도 반드시 명시적 행위에 의해서만 이루어져야 한다. 자동 TTL은 "모르는 사이에 근거가 소실되는" 위험을 만든다.

---

## 8. Sync Worker 변경 사항

### 8.1 `startupScan()` 변경

현재 흐름:
```
scanFiles() → DB 비교 → deletedEntityIds 수집 → tombstone 트랜잭션 → 변경/신규 파일 enqueue
```

변경 후 흐름:
```
scanFiles() → DB 비교 → deletedSources, newFiles 수집
  → content_hash 기반 rename 매칭
  → 매칭 성공: entity key rewrite 트랜잭션
  → 매칭 실패: tombstone 트랜잭션
  → 변경/신규 파일 enqueue (rewrite된 파일 포함)
```

**구체적 변경 위치**: `sync-worker.ts` `startupScan()` 메서드, tombstone 처리 (`if (deletedEntityIds.length > 0)`) 블록 **앞에** rename detection 로직 삽입.

### 8.2 `handleDeletedFile()` 변경 — Grace Window

현재 흐름:
```
파일 미존재 확인 → 해당 entity tombstone
```

변경 후 흐름:
```
파일 미존재 확인
  → pending_delete 큐에 추가 (entity_id, file_path, content_hash, timestamp)
  → grace window 타이머 시작
  → 타이머 만료 시: pending_delete에서 매칭 안 된 항목 tombstone
```

**생성 이벤트(`processFile`) 진입 시**:
```
pending_delete 큐에서 동일 content_hash 검색
  → 매칭 발견: entity key rewrite (tombstone 안 함)
  → 매칭 미발견: 정상적으로 새 entity 생성
```

### 8.3 `sync_event.action` 확장

| 기존 값 | 새로 추가 |
|---------|-----------|
| `created`, `updated`, `deleted`, `restored` | **`renamed`** |

`SyncAction` 타입에 `'renamed'` 추가. **두 곳에 중복 선언**되어 있으므로 양쪽 모두 수정해야 한다:

| 파일 | 현재 |
|------|------|
| `tooling/mcp/src/kb.ts:42` | `export type SyncAction = 'created' \| 'updated' \| 'deleted' \| 'restored';` |
| `tooling/mcp/src/repo/sync-event-repo.ts:6` | `export type SyncAction = 'created' \| 'updated' \| 'deleted' \| 'restored';` |

> **리팩터링 권장**: 중복 선언을 제거하고 한 곳에서만 정의 후 re-export. 예: `sync-event-repo.ts`에서 정의, `kb.ts`에서 import.

변경 후:
```typescript
export type SyncAction = 'created' | 'updated' | 'deleted' | 'restored' | 'renamed';
```

### 8.4 `__manual__/` 경로 정합성 정책

`__manual__/` prefix는 파일시스템에 실제 파일이 존재하지 않는 **가상 경로**이다. 다음 3개 지점에서 명시적으로 제외해야 한다:

#### 8.4.1 Read-Through Stale 검증 제외

`ReadThroughValidator`가 source의 `file_path`를 파일시스템과 비교할 때, `__manual__/` prefix로 시작하는 source는 **검증 대상에서 제외**한다.

- 위치: `read-through.ts`
- 조건: `source.filePath.startsWith('__manual__/')`이면 항상 fresh로 간주

#### 8.4.2 startupScan Tombstone 제외

`startupScan()`은 DB의 source 경로와 파일시스템의 실제 파일 목록을 교차 비교하여, "DB에 있지만 파일시스템에 없는" source의 entity를 tombstone 대상으로 분류한다. `__manual__/` 경로는 파일시스템에 절대 존재하지 않으므로, 무조건 tombstone 대상이 된다.

**해결**: `startupScan()`의 tombstone 대상 수집 시, `source.file_path`가 `__manual__/`로 시작하는 entity를 **제외**:

```
deletedEntityIds = dbSources
  .filter(s => !fsFileSet.has(s.filePath) && !s.filePath.startsWith('__manual__/'))
  .map(s => s.entityId)
```

- 위치: `sync-worker.ts`, `startupScan()` 메서드 내 tombstone 대상 수집 로직
- 추가로 rename detection의 `deletedSources` 수집 시에도 동일한 필터 적용

#### 8.4.3 Watch/Sync 큐 제외

`__manual__/` 경로가 watch 이벤트나 sync 큐에 진입하는 것은 정상적으로 불가능하다(파일시스템에 없으므로). 그러나 방어적으로:

- `handleDeletedFile()`에서 `filePath.startsWith('__manual__/')`이면 **무시** (early return)
- `processFile()`에서 `filePath.startsWith('__manual__/')`이면 **무시** (early return)
- 위치: `sync-worker.ts`, 각 메서드 진입부

---

## 8.5 `strength_type` 의미 정의

| `strength_type.name` | 의미 | 생성 주체 | orphan cleanup 대상 | purge 보호 |
|----------------------|------|-----------|---------------------|------------|
| `'inferred'` (기존) | 파서가 코드에서 자동 추론한 relation | sync 파서 | **대상** (`deleteOrphanRelations`에서 삭제 가능) | **아니오** |
| `'manual'` (신규) | 사용자/에이전트가 명시적으로 생성한 relation | `link_spec`, `apply_identity_rewrite` | **제외** (절대 자동 삭제 안 함) | **예** |

**`apply_identity_rewrite`가 생성하는 relation의 strength**: `'manual'`을 유지한다.

- 근거: `apply_identity_rewrite`는 사용자가 후보를 **승인**한 결과이다. 자동 추론이 아니라 인간 판단이 개입했으므로 `'manual'`이 정확하다.
- 이 relation도 orphan cleanup에서 보호되고, purge에서도 보호된다.

---

## 9. 타입 테이블 시드 데이터

새 도구가 사용하는 타입 값들은 `type-repo.ts`의 `ensure*` 패턴으로 런타임에 자동 생성된다. 별도 마이그레이션 불필요.

| 테이블 | 값 | 용도 | 생성 시점 |
|--------|-----|------|-----------|
| `entity_type` | `spec` | 스펙 entity | `register_spec` 최초 호출 시 |
| `relation_type` | `implements` | 스펙↔코드 관계 | `link_spec` 최초 호출 시 |
| `strength_type` | `manual` | 수동 링크 표시 | `link_spec` 최초 호출 시 |
| `fact_type` | `spec_body` | 스펙 본문 | `register_spec` 최초 호출 시 |
| `fact_type` | `manual_link` | 링크 근거 | `link_spec` 최초 호출 시 |

> `coverage_map`이 이미 `entity_type.name = 'spec'`과 `relation_type.name = 'implements'`를 쿼리하고 있으므로, 새 도구가 만드는 데이터는 `coverage_map`과 **즉시 호환**된다.

---

## 10. 기존 도구와의 호환성

### 10.1 `coverage_map`

```sql
-- coverage_map이 사용하는 쿼리 (analysis.ts)
SELECT ... FROM relation r
JOIN entity e ON e.id = r.src_entity_id
WHERE r.dst_entity_id = {spec.id}
  AND rt.name = 'implements'
  AND e.is_deleted = false
```

`link_spec`이 생성하는 데이터:
- `dst_entity_id` = spec entity의 id ✓
- `relation_type.name` = `'implements'` ✓
- src entity가 `is_deleted = false` ✓ (살아있는 코드 entity만 링크 가능)

→ **변경 없이 즉시 호환.**

### 10.2 `inconsistency_report`

`inconsistency_report`가 이미 검사하는 항목:
- `spec_no_impl`: spec entity에 implements relation이 없는 경우
- `evidenceless_relation`: evidence가 없는 relation

`link_spec`은 항상 evidence를 생성하므로 `evidenceless_relation`에 걸리지 않는다.
`register_spec` 후 `link_spec`을 안 하면 `spec_no_impl`이 감지된다 → **의도된 동작.**

### 10.3 `impact_analysis`

`impact_analysis`는 역방향 BFS로 incoming relation을 추적한다. `implements` relation도 추적 대상에 포함된다.

→ spec entity에 대해 `impact_analysis`를 실행하면, **해당 스펙을 구현하는 모든 코드 entity가 영향 범위에 포함**된다. 변경 없이 즉시 동작.

---

## 11. 에러 및 예외 처리

### 11.1 `register_spec` 에러

**입력 검증 (도구 실행 전 선행)**:
| 검증 | 규칙 | 에러 메시지 |
|------|------|-------------|
| `specKey` prefix | `specKey.startsWith('spec::')` | "specKey must start with 'spec::'" |
| `specKey` name 부분 | `/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(name)` (2자 이상, kebab-case) | "specKey name must be kebab-case (e.g., 'spec::my-feature')" |
| `summary` 길이 | `1 ≤ length ≤ 500` | "summary must be 1-500 characters" |
| `body` 길이 | `1 ≤ length ≤ 50000` | "body must be 1-50000 characters" |

**런타임 에러**:
| 상황 | 처리 |
|------|------|
| DB 트랜잭션 실패 | 에러 전파. 부분 커밋 없음 (단일 트랜잭션) |

### 11.2 `link_spec` 에러

**입력 검증**:
| 검증 | 규칙 | 에러 메시지 |
|------|------|-------------|
| `codeEntityKey` prefix | `module:` 또는 `symbol:`로 시작 | "codeEntityKey must start with 'module:' or 'symbol:'" |
| `specKey` prefix | `spec::` 시작 | "specKey must start with 'spec::'" |
| `rationale` 길이 | `1 ≤ length ≤ 5000` | "rationale must be 1-5000 characters" |

**런타임 에러**:
| 상황 | 처리 |
|------|------|
| `codeEntityKey`에 해당하는 entity 없음 | 에러 반환 + `search(codeEntityKey의 마지막 segment)` 결과로 유사 entity 추천 |
| `specKey`에 해당하는 spec entity 없음 | 에러 반환: "Spec not found. Use register_spec first." |
| `codeEntityKey`의 entity가 `is_deleted = true` | 에러 반환: "Entity is tombstoned. Run sync first or check the entity key." |
| 이미 동일 링크가 존재 | upsert: `meta`를 갱신 (rationale, anchor 업데이트). `action: 'updated'` 반환 |

### 11.3 `resolve_identity_candidates` 에러

| 상황 | 처리 |
|------|------|
| 깨진 링크가 없음 | `{ brokenLinks: [], totalBroken: 0 }` 반환 (에러 아님) |
| 특정 `specKey`에 해당하는 spec이 없음 | 에러 반환: "Spec not found: {specKey}" |

### 11.4 `apply_identity_rewrite` 에러

**입력 검증**:
| 검증 | 규칙 | 에러 메시지 |
|------|------|-------------|
| `rewrites` 배열 | `minItems: 1` (JSON Schema에서 이미 정의) | MCP SDK 레벨에서 거부 |
| `newEntityKey` | 빈 문자열 불가 (`minLength: 1`) | MCP SDK 레벨에서 거부 |
| `relationId` | 양의 정수 | "relationId must be a positive integer" |

**런타임 에러**:
| 상황 | 처리 |
|------|------|
| `newEntityKey`에 해당하는 entity 없음 | 해당 항목 skip, `status: 'skipped_entity_not_found'` |
| `relationId`가 유효하지 않음 | 해당 항목 skip, `status: 'skipped_relation_not_found'` |
| unique constraint 충돌 | 기존 relation에 meta 병합, 옛 relation에 `supersededBy` 표시 |

### 11.5 content_hash rewrite 에러

| 상황 | 처리 |
|------|------|
| 1:N 매칭 (같은 hash로 여러 new file) | rewrite 안 함, 정상적으로 tombstone + 새 entity 생성 |
| N:1 매칭 (여러 old entity가 같은 new file에 대응) | rewrite 안 함, 정상적으로 tombstone + 새 entity 생성 |
| rewrite 트랜잭션 실패 | 정상적으로 tombstone fallback. `sync_event`에 에러 기록 |

---

## 12. MCP 도구 등록

`server.ts`의 `TOOL_DEFINITIONS`에 다음 4개 도구를 추가한다:

### 12.1 `register_spec`

```typescript
{
  name: 'register_spec',
  description: '스펙(spec) 엔티티를 KB에 수동 등록한다. 사용자와 에이전트가 논의하여 확정한 기능 명세를 저장한다. 이미 존재하는 specKey면 본문/요약을 갱신한다.',
  inputSchema: {
    type: 'object',
    properties: {
      specKey: {
        type: 'string',
        minLength: 1,
        description: '스펙 키. 형식: "spec::{name}". 예: "spec::di-container"'
      },
      summary: {
        type: 'string',
        minLength: 1,
        description: '스펙 요약 (1~2줄)'
      },
      body: {
        type: 'string',
        minLength: 1,
        description: '스펙 본문 (마크다운)'
      },
      meta: {
        type: 'object',
        description: '추가 메타데이터 (선택)'
      },
    },
    required: ['specKey', 'summary', 'body'],
    additionalProperties: false,
  },
}
```

### 12.2 `link_spec`

```typescript
{
  name: 'link_spec',
  description: '스펙과 코드 엔티티 사이에 implements 관계를 수동으로 생성한다. 어떤 코드가 어떤 스펙을 구현하는지 기록한다. rationale(근거)은 필수이며, relation_evidence로 보존된다.',
  inputSchema: {
    type: 'object',
    properties: {
      codeEntityKey: {
        type: 'string',
        minLength: 1,
        description: '코드 엔티티 키. 예: "symbol:packages/core/src/app.ts#createApplication", "module:packages/core/src/app.ts"'
      },
      specKey: {
        type: 'string',
        minLength: 1,
        description: '스펙 엔티티 키. 예: "spec::di-container"'
      },
      rationale: {
        type: 'string',
        minLength: 1,
        description: '왜 이 코드가 이 스펙을 구현하는지에 대한 근거'
      },
    },
    required: ['codeEntityKey', 'specKey', 'rationale'],
    additionalProperties: false,
  },
}
```

### 12.3 `resolve_identity_candidates`

```typescript
{
  name: 'resolve_identity_candidates',
  description: '스펙-코드 링크 중 깨진 것(코드 엔티티가 tombstone이거나 missing)을 감지하고, 대체 후보 엔티티 목록을 반환한다. 자동 적용하지 않으며, 사용자 승인 후 apply_identity_rewrite로 적용한다.',
  inputSchema: {
    type: 'object',
    properties: {
      specKey: {
        type: 'string',
        description: '특정 스펙만 검사. 생략 시 모든 깨진 링크를 스캔한다.'
      },
      maxCandidates: {
        type: 'integer',
        minimum: 1,
        maximum: 20,
        default: 5,
        description: '각 깨진 링크당 반환할 최대 후보 수'
      },
    },
    additionalProperties: false,
  },
}
```

### 12.4 `apply_identity_rewrite`

```typescript
{
  name: 'apply_identity_rewrite',
  description: 'resolve_identity_candidates의 결과를 검토한 뒤, 승인된 매칭을 적용한다. 깨진 relation의 src_entity_id를 새 엔티티로 재연결한다.',
  inputSchema: {
    type: 'object',
    properties: {
      rewrites: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            relationId: { type: 'integer', description: '깨진 relation의 id' },
            newEntityKey: { type: 'string', minLength: 1, description: '새로 연결할 엔티티 키' },
          },
          required: ['relationId', 'newEntityKey'],
        },
        minItems: 1,
        description: '적용할 매칭 목록'
      },
    },
    required: ['rewrites'],
    additionalProperties: false,
  },
}
```

---

## 13. 구현 순서 (권장)

| 단계 | 작업 | 의존성 |
|------|------|--------|
| **1** | `register_spec` 도구 구현 | 없음 |
| **2** | `link_spec` 도구 구현 | register_spec |
| **3** | `purgeTombstones` 보호 조건 추가 | link_spec (manual strength 사용) |
| **4** | Read-through `__manual__/` 예외 처리 | register_spec |
| **5** | `startupScan` content_hash rename detection | 없음 (독립) |
| **6** | watch grace window (pending_delete) | rename detection |
| **7** | `resolve_identity_candidates` 도구 구현 | link_spec (anchor 구조 사용) |
| **8** | `apply_identity_rewrite` 도구 구현 | resolve_identity_candidates |
| **9** | `sync_event.action` 에 `'renamed'` 추가 | rename detection |

---

## 14. 미래 확장 경로

### 14.1 불변 ID + Alias 테이블 (A 방식)

현재 설계(B 방식: entity_key rewrite)로 시작하되, 다음 수요가 발생하면 A 방식으로 승격한다:

- "이 심볼이 예전에 어디 있었는지" 이력 조회가 빈번
- 대규모 리팩터링(파일 분할/통합)이 잦아서 content_hash rewrite로 커버 안 되는 케이스가 많음
- 링크 보존이 제품의 핵심 가치로 격상

A 방식 스키마 (참고):
```sql
CREATE TABLE entity_alias (
  id SERIAL PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace(id),
  entity_id INTEGER NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  alias_key TEXT NOT NULL,
  reason TEXT,  -- 'renamed', 'split', 'merged'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, alias_key)
);
```

### 14.2 코드 내 @spec 주석 태그

`/** @spec spec::di-container */` 같은 태그를 파서가 인식하여 자동으로 `implements` relation을 생성하는 방식. 가장 강력한 링크 유지 방법이나, 코드에 대량 삽입이 필요하므로 **옵션으로만** 제공.

### 14.3 가중치 기반 스코어링

`resolve_identity_candidates`에서 후보를 **점수 기반으로 정렬**하는 기능. 현재는 후보를 나열하기만 하고 점수를 매기지 않는다. 운영 데이터(실제 rename 패턴)가 충분히 쌓이면 도입을 검토한다.

---

## 부록 A: 용어 정의

| 용어 | 정의 |
|------|------|
| **entity** | KB의 기본 단위. module, symbol, spec, pkg, test 등의 타입을 가진다 |
| **entity_key** | entity의 현재 주소. 형식: `{type}:{identifier}`. 가변(mutable) |
| **entity.id** | entity의 불변 정체성. serial PK. relation FK가 참조하는 대상 |
| **tombstone** | `entity.is_deleted = true` 상태. 실제 삭제가 아닌 논리적 삭제 |
| **purge** | tombstone entity를 DB에서 물리적으로 DELETE. FK cascade로 관련 데이터 소실 |
| **rewrite** | entity_key를 UPDATE하여 entity.id(정체성)를 유지하는 방식 |
| **앵커(anchor)** | 링크 생성 시 relation.meta에 저장하는 식별 정보. tombstone에 의존하지 않음 |
| **grace window** | watch 트리거에서 삭제 이벤트 후 rename 매칭을 위해 대기하는 시간 |
| **rationale** | 링크의 근거. "왜 이 코드가 이 스펙을 구현하는가"에 대한 설명 |

## 부록 B: 관련 파일 목록

| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `tooling/mcp/src/server.ts` | 수정 | 4개 도구 등록 (TOOL_DEFINITIONS, handleToolCall) |
| `tooling/mcp/src/tools/spec.ts` | **신규** | register_spec, link_spec 구현 |
| `tooling/mcp/src/tools/identity.ts` | **신규** | resolve_identity_candidates, apply_identity_rewrite 구현 |
| `tooling/mcp/src/sync-worker.ts` | 수정 | startupScan rename detection, handleDeletedFile grace window |
| `tooling/mcp/src/repo/entity-repo.ts` | 수정 | purgeTombstones manual link 보호, rewriteEntityKey 메서드 추가 |
| `tooling/mcp/src/kb.ts` | 수정 | SyncAction에 'renamed' 추가, rewriteEntityKey 래퍼 |
| `tooling/mcp/src/read-through.ts` | 수정 | `__manual__/` prefix 예외 처리 |
| `tooling/mcp/src/config.ts` | 수정 | `sync.renameGraceWindowMs` 설정 추가 |
| `tooling/mcp/src/sync-ipc.ts` | 수정 | SyncWorkerStatus에 pendingDeletes 필드 추가 (선택) |
| `tooling/mcp/src/repo/relation-repo.ts` | 수정 | `deleteOrphanRelations` 메서드 추가 |
| `tooling/mcp/src/repo/sync-event-repo.ts` | 수정 | `SyncAction`에 `'renamed'` 추가 (중복 선언 해소) |

## 부록 C: 테스트 케이스 매트릭스

구현 검증을 위한 핵심 테스트 시나리오.

### C.1 계층 1: content_hash Rewrite

| # | 시나리오 | 선행 상태 | 수행 | 기대 결과 |
|---|----------|-----------|------|-----------|
| T1-1 | **단순 파일 이동** | `a.ts`에 module+symbol+link 존재 | `mv a.ts b.ts` → startupScan | entity_key `module:b.ts`로 rewrite, symbol key도 갱신, relation FK 유지, sync_event `'renamed'` 기록 |
| T1-2 | **이동+내용변경 동시** | `a.ts`에 link 존재 | `mv a.ts b.ts` + b.ts 내용 수정 → startupScan | hash 불일치 → rewrite 안 됨, a.ts tombstone, b.ts 새 entity. link 파손 (계층 2로 전환) |
| T1-3 | **파일 복사 (1:N)** | `a.ts` 존재 | `cp a.ts b.ts` + `rm a.ts` → startupScan | 동일 hash 2개 → rewrite 금지, a.ts tombstone, b.ts 새 entity |
| T1-4 | **N:1 통합** | `a.ts`, `b.ts` 존재 (같은 hash) | `rm a.ts` + `rm b.ts` + `c.ts` 생성(같은 hash) → startupScan | 2:1 매칭 → rewrite 금지, 둘 다 tombstone, c.ts 새 entity |
| T1-5 | **rewrite 후 파싱** | T1-1 수행 후 | enqueue된 b.ts를 파싱 | fact/relation이 새 경로 기준으로 재생성, orphan fact 정리됨 |

### C.2 Watch Grace Window

| # | 시나리오 | 이벤트 시퀀스 | 기대 결과 |
|---|----------|---------------|-----------|
| T2-1 | **정상 rename (window 내)** | DELETE(a.ts) → 1초 후 CREATE(b.ts), hash 동일 | rewrite 성공, tombstone 안 됨 |
| T2-2 | **window 만료** | DELETE(a.ts) → 4초 대기 (default 3초) → CREATE(b.ts), hash 동일 | a.ts 이미 tombstone됨, b.ts 새 entity |
| T2-3 | **역순 이벤트** | CREATE(b.ts) → DELETE(a.ts), hash 동일 | b.ts 새 entity 생성됨, a.ts tombstone, rewrite 불가 |
| T2-4 | **중복 DELETE** | DELETE(a.ts) → DELETE(a.ts) | 두 번째 DELETE 무시 (idempotent) |
| T2-5 | **source unique 충돌** | CREATE(b.ts)가 먼저 처리 → pending_delete에서 a.ts→b.ts rewrite 시도 | b.ts entity 이미 존재 → rewrite 포기, a.ts tombstone |

### C.3 수동 도구

| # | 시나리오 | 수행 | 기대 결과 |
|---|----------|------|-----------|
| T3-1 | **spec 등록** | `register_spec({specKey: "spec::auth", ...})` | entity 생성, source `__manual__/spec/spec::auth`, fact `spec_body` 생성 |
| T3-2 | **spec 갱신** | T3-1 후 body 변경하여 재호출 | upsert: body/hash 갱신, `action: 'updated'` |
| T3-3 | **link 생성** | `link_spec({codeEntityKey: "symbol:...", specKey: "spec::auth", rationale: "..."})` | relation 생성 (strength='manual'), evidence 연결, anchor in meta |
| T3-4 | **link 중복** | T3-3 재호출 (같은 pair) | upsert: meta 갱신, `action: 'updated'` |
| T3-5 | **tombstoned entity에 link** | `is_deleted=true`인 entity에 link 시도 | 에러: "Entity is tombstoned" |
| T3-6 | **잘못된 specKey 형식** | `register_spec({specKey: "auth", ...})` | 에러: "specKey must start with 'spec::'" |

### C.4 Purge 보호

| # | 시나리오 | 수행 | 기대 결과 |
|---|----------|------|-----------|
| T4-1 | **manual link가 있는 tombstone** | code entity tombstone, manual link 존재 | `purgeTombstones` 실행 → entity 보호됨 (삭제 안 됨) |
| T4-2 | **manual link 없는 tombstone** | code entity tombstone, manual link 없음 | `purgeTombstones` 실행 → entity 삭제됨 |
| T4-3 | **rewrite로 보호 해제** | T4-1 상태에서 `apply_identity_rewrite`로 relation 이전 | 옛 entity에 manual relation 없음 → 다음 purge에서 삭제됨 |

### C.5 __manual__/ 경로 보호

| # | 시나리오 | 수행 | 기대 결과 |
|---|----------|------|-----------|
| T5-1 | **startupScan 시 __manual__/ 제외** | spec entity with source `__manual__/spec/spec::auth` | startupScan → tombstone 대상에서 **제외** |
| T5-2 | **read-through 시 __manual__/ 제외** | `__manual__/` source의 stale 체크 | 항상 fresh로 간주 |
| T5-3 | **watch에 __manual__/ 진입** | (정상적으로 불가능하지만) `__manual__/` path가 processFile에 도달 | early return, 무시 |

### C.6 Identity Resolution (계층 2)

| # | 시나리오 | 수행 | 기대 결과 |
|---|----------|------|-----------|
| T6-1 | **깨진 링크 감지** | code entity tombstone, manual link 존재 | `resolve_identity_candidates` → `brokenLinks` 1건, `candidates`에 FTS 결과 |
| T6-2 | **깨진 링크 없음** | 모든 manual link healthy | `resolve_identity_candidates` → `{ brokenLinks: [], totalBroken: 0 }` |
| T6-3 | **rewrite 적용** | T6-1에서 후보 선택 → `apply_identity_rewrite` | relation.src_entity_id 변경, evidence 추가, meta에 migratedFrom 기록 |
| T6-4 | **rewrite 충돌** | 이미 동일 (src, dst, type, strength) 존재 | meta 병합, 옛 relation에 supersededBy 표시 |
| T6-5 | **relation orphan cleanup** | 파일 이동 후 sync → 파서가 새 relation 생성 | 옛 relation (strength='inferred')이 deleteOrphanRelations에 의해 삭제, manual relation은 보존 |
