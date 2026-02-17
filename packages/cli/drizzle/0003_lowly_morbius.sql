-- no-op
-- Option B: keywords removal and FTS trigger shape are defined in 0000_init + 0001_add_fts.
-- Existing caches are rebuilt via SCHEMA_VERSION bump.
SELECT 1;