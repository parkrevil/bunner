-- FTS5 external content virtual tables + triggers (PLAN-v5 §5.2)

-- drizzle-kit generate currently creates card_fts/code_fts as regular tables.
-- Our store invariants require FTS5 virtual tables + triggers, so we rebuild them here.

DROP TABLE IF EXISTS card_fts;
--> statement-breakpoint
DROP TABLE IF EXISTS code_fts;
--> statement-breakpoint

CREATE VIRTUAL TABLE IF NOT EXISTS card_fts USING fts5(
        key,
        summary,
        body,
        content='card',
        content_rowid='_rowid_',
        tokenize='trigram'
);
--> statement-breakpoint
CREATE VIRTUAL TABLE IF NOT EXISTS code_fts USING fts5(
        entity_key,
        symbol_name,
        content='code_entity',
        content_rowid='_rowid_',
        tokenize='trigram'
);
--> statement-breakpoint

-- card_fts triggers
CREATE TRIGGER IF NOT EXISTS card_fts_ai AFTER INSERT ON card BEGIN
        INSERT INTO card_fts(rowid, key, summary, body)
                VALUES (new._rowid_, new.key, new.summary, new.body);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS card_fts_au AFTER UPDATE ON card BEGIN
        INSERT INTO card_fts(card_fts, rowid, key, summary, body)
                VALUES('delete', old._rowid_, old.key, old.summary, old.body);
        INSERT INTO card_fts(rowid, key, summary, body)
                VALUES (new._rowid_, new.key, new.summary, new.body);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS card_fts_ad AFTER DELETE ON card BEGIN
        INSERT INTO card_fts(card_fts, rowid, key, summary, body)
                VALUES('delete', old._rowid_, old.key, old.summary, old.body);
END;
--> statement-breakpoint

-- code_fts triggers
CREATE TRIGGER IF NOT EXISTS code_fts_ai AFTER INSERT ON code_entity BEGIN
        INSERT INTO code_fts(rowid, entity_key, symbol_name)
                VALUES (new._rowid_, new.entity_key, new.symbol_name);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS code_fts_au AFTER UPDATE ON code_entity BEGIN
        INSERT INTO code_fts(code_fts, rowid, entity_key, symbol_name)
                VALUES('delete', old._rowid_, old.entity_key, old.symbol_name);
        INSERT INTO code_fts(rowid, entity_key, symbol_name)
                VALUES (new._rowid_, new.entity_key, new.symbol_name);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS code_fts_ad AFTER DELETE ON code_entity BEGIN
        INSERT INTO code_fts(code_fts, rowid, entity_key, symbol_name)
                VALUES('delete', old._rowid_, old.entity_key, old.symbol_name);
END;
