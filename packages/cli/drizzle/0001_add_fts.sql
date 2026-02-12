-- FTS5 external content virtual tables + triggers (PLAN-v5 §5.2)

CREATE VIRTUAL TABLE IF NOT EXISTS card_fts USING fts5(
	key,
	summary,
	body,
	keywords,
	content='card',
	content_rowid='rowid',
	tokenize='trigram'
);
--> statement-breakpoint
CREATE VIRTUAL TABLE IF NOT EXISTS code_fts USING fts5(
	entity_key,
	symbol_name,
	content='code_entity',
	content_rowid='rowid',
	tokenize='trigram'
);
--> statement-breakpoint

-- card_fts triggers
CREATE TRIGGER IF NOT EXISTS card_fts_ai AFTER INSERT ON card BEGIN
	INSERT INTO card_fts(rowid, key, summary, body, keywords)
		VALUES (new.rowid, new.key, new.summary, new.body, new.keywords);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS card_fts_au AFTER UPDATE ON card BEGIN
	INSERT INTO card_fts(card_fts, rowid, key, summary, body, keywords)
		VALUES('delete', old.rowid, old.key, old.summary, old.body, old.keywords);
	INSERT INTO card_fts(rowid, key, summary, body, keywords)
		VALUES (new.rowid, new.key, new.summary, new.body, new.keywords);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS card_fts_ad AFTER DELETE ON card BEGIN
	INSERT INTO card_fts(card_fts, rowid, key, summary, body, keywords)
		VALUES('delete', old.rowid, old.key, old.summary, old.body, old.keywords);
END;
--> statement-breakpoint

-- code_fts triggers
CREATE TRIGGER IF NOT EXISTS code_fts_ai AFTER INSERT ON code_entity BEGIN
	INSERT INTO code_fts(rowid, entity_key, symbol_name)
		VALUES (new.rowid, new.entity_key, new.symbol_name);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS code_fts_au AFTER UPDATE ON code_entity BEGIN
	INSERT INTO code_fts(code_fts, rowid, entity_key, symbol_name)
		VALUES('delete', old.rowid, old.entity_key, old.symbol_name);
	INSERT INTO code_fts(rowid, entity_key, symbol_name)
		VALUES (new.rowid, new.entity_key, new.symbol_name);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS code_fts_ad AFTER DELETE ON code_entity BEGIN
	INSERT INTO code_fts(code_fts, rowid, entity_key, symbol_name)
		VALUES('delete', old.rowid, old.entity_key, old.symbol_name);
END;