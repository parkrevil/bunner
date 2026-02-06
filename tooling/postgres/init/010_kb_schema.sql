-- Minimal Agent Knowledge Base schema (derived data only)

CREATE TABLE IF NOT EXISTS kb_entity (
  id BIGSERIAL PRIMARY KEY,
  entity_key TEXT NOT NULL UNIQUE,
  entity_type TEXT NOT NULL,
  package_name TEXT,
  display_name TEXT,
  summary_text TEXT,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

  CONSTRAINT kb_entity_type_check CHECK (entity_type IN (
    'package',
    'module',
    'symbol',
    'concept',
    'rule',
    'diagnostic',
    'build_step'
  ))
);

CREATE TABLE IF NOT EXISTS kb_chunk (
  id BIGSERIAL PRIMARY KEY,
  entity_key TEXT NOT NULL,
  chunk_type TEXT NOT NULL,
  chunk_key TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload_text TEXT NOT NULL,
  embedding vector,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT kb_chunk_payload_text_len CHECK (char_length(payload_text) <= 4000),
  CONSTRAINT kb_chunk_type_check CHECK (chunk_type IN (
    'summary',
    'api',
    'concept',
    'rule',
    'diagnostic',
    'invariant',
    'build_step'
  )),
  CONSTRAINT kb_chunk_entity_fk
    FOREIGN KEY (entity_key)
    REFERENCES kb_entity(entity_key)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS kb_chunk_entity_key_idx ON kb_chunk (entity_key);
CREATE INDEX IF NOT EXISTS kb_chunk_chunk_type_idx ON kb_chunk (chunk_type);
CREATE UNIQUE INDEX IF NOT EXISTS kb_chunk_unique
  ON kb_chunk (entity_key, chunk_type, chunk_key);

-- Optional hybrid search support (lexical)
ALTER TABLE kb_chunk
  ADD COLUMN IF NOT EXISTS payload_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', payload_text)) STORED;

CREATE INDEX IF NOT EXISTS kb_chunk_payload_tsv_gin ON kb_chunk USING gin (payload_tsv);

-- Vector index (cosine). Note: this is safe even if embeddings are inserted later.
CREATE INDEX IF NOT EXISTS kb_chunk_embedding_hnsw
  ON kb_chunk USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS kb_edge (
  id BIGSERIAL PRIMARY KEY,
  src_entity_key TEXT NOT NULL,
  dst_entity_key TEXT NOT NULL,
  edge_type TEXT NOT NULL,
  strength TEXT NOT NULL,
  evidence_chunk_id BIGINT,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT kb_edge_no_self_loop CHECK (src_entity_key <> dst_entity_key),
  CONSTRAINT kb_edge_strength_check CHECK (strength IN (
    'contract',
    'implementation',
    'convention',
    'reference'
  )),
  CONSTRAINT kb_edge_type_check CHECK (edge_type IN (
    'depends_on',
    'exports',
    'implements',
    'triggers',
    'mitigates',
    'related_to'
  )),
  CONSTRAINT kb_edge_src_fk
    FOREIGN KEY (src_entity_key)
    REFERENCES kb_entity(entity_key)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT kb_edge_dst_fk
    FOREIGN KEY (dst_entity_key)
    REFERENCES kb_entity(entity_key)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT kb_edge_evidence_fk
    FOREIGN KEY (evidence_chunk_id)
    REFERENCES kb_chunk(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS kb_edge_src_idx ON kb_edge (src_entity_key);
CREATE INDEX IF NOT EXISTS kb_edge_dst_idx ON kb_edge (dst_entity_key);
CREATE INDEX IF NOT EXISTS kb_edge_type_idx ON kb_edge (edge_type);
CREATE INDEX IF NOT EXISTS kb_edge_strength_idx ON kb_edge (strength);

-- Uniqueness to avoid duplication during re-ingest
CREATE UNIQUE INDEX IF NOT EXISTS kb_edge_unique
  ON kb_edge (src_entity_key, dst_entity_key, edge_type, strength);
