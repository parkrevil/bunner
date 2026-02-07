-- KB v2 migration — MCP_PLAN §2 기반 전면 재설계
-- Git-free, content_hash 기반, workspace 격리

-- ============================================================
-- 1. 레거시 테이블 DROP (역순, FK 의존 존중)
-- ============================================================

DROP TABLE IF EXISTS edge_evidence CASCADE;
DROP TABLE IF EXISTS edge CASCADE;
DROP TABLE IF EXISTS chunk CASCADE;
DROP TABLE IF EXISTS entity CASCADE;
DROP TABLE IF EXISTS pointer CASCADE;
DROP TABLE IF EXISTS ingest_run CASCADE;
DROP TABLE IF EXISTS entity_type CASCADE;
DROP TABLE IF EXISTS chunk_type CASCADE;
DROP TABLE IF EXISTS edge_type CASCADE;
DROP TABLE IF EXISTS strength_type CASCADE;

-- ============================================================
-- 2. Extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 3. Type 테이블 (Seed Data)
-- ============================================================

CREATE TABLE IF NOT EXISTS entity_type (
  id SMALLSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS fact_type (
  id SMALLSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS relation_type (
  id SMALLSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS strength_type (
  id SMALLSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  rank SMALLINT NOT NULL DEFAULT 0
);

-- ============================================================
-- 4. workspace
-- ============================================================

CREATE TABLE IF NOT EXISTS workspace (
  id TEXT PRIMARY KEY,                       -- sha256(hostname+repo_root)[:16]
  hostname TEXT NOT NULL,
  repo_root TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 5. sync_run
-- ============================================================

CREATE TABLE IF NOT EXISTS sync_run (
  id SERIAL PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace(id),
  trigger TEXT NOT NULL,                     -- startup/watch/manual/read_through
  status TEXT NOT NULL,                      -- running/completed/failed
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { files_scanned, entities_created, ... }
  errors JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{ path, error }]

  CONSTRAINT sync_run_trigger_check CHECK (trigger IN (
    'startup', 'watch', 'manual', 'read_through'
  )),
  CONSTRAINT sync_run_status_check CHECK (status IN (
    'running', 'completed', 'failed'
  ))
);

CREATE INDEX IF NOT EXISTS sync_run_workspace_idx ON sync_run (workspace_id);

-- ============================================================
-- 6. entity
-- ============================================================

CREATE TABLE IF NOT EXISTS entity (
  id SERIAL PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace(id),
  entity_key TEXT NOT NULL,                  -- stable ID
  entity_type_id SMALLINT NOT NULL REFERENCES entity_type(id),
  summary TEXT,                              -- human-readable 1줄
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,   -- 유연한 메타데이터
  is_deleted BOOLEAN NOT NULL DEFAULT false, -- tombstone
  last_seen_run INTEGER REFERENCES sync_run(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT entity_workspace_key UNIQUE (workspace_id, entity_key)
);

CREATE INDEX IF NOT EXISTS entity_type_idx ON entity (entity_type_id);
CREATE INDEX IF NOT EXISTS entity_workspace_idx ON entity (workspace_id);
CREATE INDEX IF NOT EXISTS entity_deleted_idx ON entity (is_deleted);

-- ============================================================
-- 7. source
-- ============================================================

CREATE TABLE IF NOT EXISTS source (
  id SERIAL PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace(id),
  entity_id INTEGER NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                        -- spec/code/test/config/doc
  file_path TEXT NOT NULL,                   -- repo-relative path
  span_start INTEGER,
  span_end INTEGER,
  content_hash TEXT NOT NULL,                -- SHA-256 (attribute, UPDATE-in-place)

  CONSTRAINT source_workspace_loc UNIQUE (workspace_id, kind, file_path, span_start, span_end),
  CONSTRAINT source_span_check CHECK (
    span_start IS NULL
    OR span_end IS NULL
    OR (span_start >= 0 AND span_end >= span_start)
  )
);

CREATE INDEX IF NOT EXISTS source_entity_idx ON source (entity_id);
CREATE INDEX IF NOT EXISTS source_hash_idx ON source USING hash (content_hash);
CREATE INDEX IF NOT EXISTS source_workspace_file_idx ON source (workspace_id, file_path);

-- ============================================================
-- 8. fact
-- ============================================================

CREATE TABLE IF NOT EXISTS fact (
  id SERIAL PRIMARY KEY,
  entity_id INTEGER NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  fact_type_id SMALLINT NOT NULL REFERENCES fact_type(id),
  fact_key TEXT NOT NULL,                    -- entity 내 하위 ID
  payload_text TEXT,                         -- 검색 대상
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb, -- 구조화 데이터
  content_hash TEXT,                         -- payload 해시 (dedup)

  CONSTRAINT fact_entity_type_key UNIQUE (entity_id, fact_type_id, fact_key)
);

-- FTS: generated tsvector column
ALTER TABLE fact
  ADD COLUMN IF NOT EXISTS payload_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce(payload_text, ''))) STORED;

CREATE INDEX IF NOT EXISTS fact_entity_idx ON fact (entity_id);
CREATE INDEX IF NOT EXISTS fact_type_idx ON fact (fact_type_id);
CREATE INDEX IF NOT EXISTS fact_hash_idx ON fact USING hash (content_hash);
CREATE INDEX IF NOT EXISTS fact_tsv_gin ON fact USING gin (payload_tsv);

-- ============================================================
-- 9. relation
-- ============================================================

CREATE TABLE IF NOT EXISTS relation (
  id SERIAL PRIMARY KEY,
  src_entity_id INTEGER NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  dst_entity_id INTEGER NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  relation_type_id SMALLINT NOT NULL REFERENCES relation_type(id),
  strength_type_id SMALLINT NOT NULL REFERENCES strength_type(id),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT relation_unique UNIQUE (src_entity_id, dst_entity_id, relation_type_id, strength_type_id),
  CONSTRAINT relation_no_self_loop CHECK (src_entity_id <> dst_entity_id)
);

CREATE INDEX IF NOT EXISTS relation_src_idx ON relation (src_entity_id);
CREATE INDEX IF NOT EXISTS relation_dst_idx ON relation (dst_entity_id);
CREATE INDEX IF NOT EXISTS relation_type_idx ON relation (relation_type_id);

-- ============================================================
-- 10. relation_evidence
-- ============================================================

CREATE TABLE IF NOT EXISTS relation_evidence (
  relation_id INTEGER NOT NULL REFERENCES relation(id) ON DELETE CASCADE,
  fact_id INTEGER NOT NULL REFERENCES fact(id) ON DELETE CASCADE,
  PRIMARY KEY (relation_id, fact_id)
);

-- ============================================================
-- 11. sync_event (Audit Trail)
-- ============================================================

CREATE TABLE IF NOT EXISTS sync_event (
  id SERIAL PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES sync_run(id) ON DELETE CASCADE,
  entity_id INTEGER NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  action TEXT NOT NULL,                      -- created/updated/deleted/restored
  prev_content_hash TEXT,                    -- 변경 전
  new_content_hash TEXT,                     -- 변경 후
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT sync_event_action_check CHECK (action IN (
    'created', 'updated', 'deleted', 'restored'
  ))
);

CREATE INDEX IF NOT EXISTS sync_event_run_idx ON sync_event (run_id);
CREATE INDEX IF NOT EXISTS sync_event_entity_idx ON sync_event (entity_id);
CREATE INDEX IF NOT EXISTS sync_event_created_idx ON sync_event (created_at);

-- ============================================================
-- 12. Seed Data
-- ============================================================

-- entity_type (§1.1)
INSERT INTO entity_type (name) VALUES
  ('spec'),
  ('rule'),
  ('diagnostic'),
  ('package'),
  ('module'),
  ('symbol'),
  ('test'),
  ('decision'),
  ('invariant'),
  ('derived')
ON CONFLICT (name) DO NOTHING;

-- fact_type (§1.3)
INSERT INTO fact_type (name) VALUES
  ('summary'),
  ('signature'),
  ('rule_definition'),
  ('diagnostic_mapping'),
  ('dependency'),
  ('test_assertion'),
  ('behavior')
ON CONFLICT (name) DO NOTHING;

-- relation_type (§1.4)
INSERT INTO relation_type (name) VALUES
  ('depends_on'),
  ('implements'),
  ('tests'),
  ('triggers'),
  ('relates_to'),
  ('derives_from'),
  ('renamed_to')
ON CONFLICT (name) DO NOTHING;

-- strength_type (§1.4)
INSERT INTO strength_type (name, rank) VALUES
  ('contract', 4),
  ('implementation', 3),
  ('convention', 2),
  ('reference', 1)
ON CONFLICT (name) DO NOTHING;
