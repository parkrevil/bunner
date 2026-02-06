-- Derived facts store (prefixless, normalized)
-- - No raw source blobs. Use pointer table to locate source-of-truth content in git.
-- - All changes are idempotent via natural keys + chunk_key.

CREATE TABLE IF NOT EXISTS ingest_run (
  id BIGSERIAL PRIMARY KEY,
  repo_rev TEXT NOT NULL,
  tool TEXT NOT NULL,
  tool_version TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT ingest_run_status_check CHECK (status IN (
    'running',
    'succeeded',
    'failed'
  ))
);

CREATE INDEX IF NOT EXISTS ingest_run_repo_rev_idx ON ingest_run (repo_rev);

CREATE TABLE IF NOT EXISTS entity_type (
  id SMALLSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS chunk_type (
  id SMALLSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS edge_type (
  id SMALLSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS strength_type (
  id SMALLSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS pointer (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  repo_path TEXT NOT NULL,
  span_start INTEGER,
  span_end INTEGER,
  rev TEXT NOT NULL,

  CONSTRAINT pointer_span_check CHECK (
    span_start IS NULL
    OR span_end IS NULL
    OR (span_start >= 0 AND span_end >= span_start)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS pointer_unique
  ON pointer (kind, repo_path, span_start, span_end, rev);

CREATE TABLE IF NOT EXISTS entity (
  id BIGSERIAL PRIMARY KEY,
  entity_key TEXT NOT NULL UNIQUE,
  entity_type_id SMALLINT NOT NULL REFERENCES entity_type(id),
  package_name TEXT,
  display_name TEXT,
  summary_text TEXT,
  pointer_id BIGINT REFERENCES pointer(id),
  created_run_id BIGINT NOT NULL REFERENCES ingest_run(id),
  updated_run_id BIGINT NOT NULL REFERENCES ingest_run(id),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entity_package_name_idx ON entity (package_name);
CREATE INDEX IF NOT EXISTS entity_type_idx ON entity (entity_type_id);

CREATE TABLE IF NOT EXISTS chunk (
  id BIGSERIAL PRIMARY KEY,
  entity_id BIGINT NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  chunk_type_id SMALLINT NOT NULL REFERENCES chunk_type(id),
  chunk_key TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload_text TEXT NOT NULL,
  pointer_id BIGINT REFERENCES pointer(id),
  ingest_run_id BIGINT NOT NULL REFERENCES ingest_run(id),
  embedding vector,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chunk_payload_text_len CHECK (char_length(payload_text) <= 4000)
);

CREATE UNIQUE INDEX IF NOT EXISTS chunk_unique
  ON chunk (entity_id, chunk_type_id, chunk_key);

CREATE INDEX IF NOT EXISTS chunk_entity_idx ON chunk (entity_id);
CREATE INDEX IF NOT EXISTS chunk_type_idx ON chunk (chunk_type_id);
CREATE INDEX IF NOT EXISTS chunk_run_idx ON chunk (ingest_run_id);

-- Hybrid search support (lexical)
ALTER TABLE chunk
  ADD COLUMN IF NOT EXISTS payload_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', payload_text)) STORED;

CREATE INDEX IF NOT EXISTS chunk_payload_tsv_gin ON chunk USING gin (payload_tsv);

-- Vector index (cosine). Optional if embeddings are inserted.
CREATE INDEX IF NOT EXISTS chunk_embedding_hnsw
  ON chunk USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS edge (
  id BIGSERIAL PRIMARY KEY,
  src_entity_id BIGINT NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  dst_entity_id BIGINT NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  edge_type_id SMALLINT NOT NULL REFERENCES edge_type(id),
  strength_type_id SMALLINT NOT NULL REFERENCES strength_type(id),
  pointer_id BIGINT REFERENCES pointer(id),
  ingest_run_id BIGINT NOT NULL REFERENCES ingest_run(id),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT edge_no_self_loop CHECK (src_entity_id <> dst_entity_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS edge_unique
  ON edge (src_entity_id, dst_entity_id, edge_type_id, strength_type_id);

CREATE INDEX IF NOT EXISTS edge_src_idx ON edge (src_entity_id);
CREATE INDEX IF NOT EXISTS edge_dst_idx ON edge (dst_entity_id);
CREATE INDEX IF NOT EXISTS edge_type_idx ON edge (edge_type_id);
CREATE INDEX IF NOT EXISTS edge_strength_idx ON edge (strength_type_id);
CREATE INDEX IF NOT EXISTS edge_run_idx ON edge (ingest_run_id);

CREATE TABLE IF NOT EXISTS edge_evidence (
  edge_id BIGINT NOT NULL REFERENCES edge(id) ON DELETE CASCADE,
  chunk_id BIGINT NOT NULL REFERENCES chunk(id) ON DELETE CASCADE,
  PRIMARY KEY (edge_id, chunk_id)
);

-- Seed minimal type world (idempotent)
INSERT INTO entity_type (name) VALUES
  ('package'),
  ('module'),
  ('symbol'),
  ('concept'),
  ('diagnostic'),
  ('build_step'),
  ('test_case'),
  ('example'),
  ('decision'),
  ('perf_note')
ON CONFLICT (name) DO NOTHING;

INSERT INTO chunk_type (name) VALUES
  ('summary'),
  ('api_signature'),
  ('behavior'),
  ('diagnostic'),
  ('pipeline'),
  ('decision'),
  ('performance')
ON CONFLICT (name) DO NOTHING;

INSERT INTO edge_type (name) VALUES
  ('depends_on'),
  ('exports'),
  ('uses'),
  ('verifies'),
  ('demonstrates'),
  ('triggers'),
  ('mitigates'),
  ('relates_to')
ON CONFLICT (name) DO NOTHING;

INSERT INTO strength_type (name) VALUES
  ('contract'),
  ('implementation'),
  ('convention'),
  ('reference')
ON CONFLICT (name) DO NOTHING;
