CREATE TABLE `card` (
	`rowid` integer,
	`key` text PRIMARY KEY NOT NULL,
	`summary` text NOT NULL,
	`status` text NOT NULL,
	`constraints_json` text,
	`body` text,
	`file_path` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_card_status` ON `card` (`status`);--> statement-breakpoint
CREATE INDEX `idx_card_file_path` ON `card` (`file_path`);--> statement-breakpoint
CREATE TABLE `card_code_link` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`card_key` text NOT NULL,
	`entity_key` text NOT NULL,
	`file_path` text NOT NULL,
	`symbol_name` text,
	`meta_json` text,
	FOREIGN KEY (`card_key`) REFERENCES `card`(`key`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`entity_key`) REFERENCES `code_entity`(`entity_key`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_card_code_link_card` ON `card_code_link` (`card_key`);--> statement-breakpoint
CREATE INDEX `idx_card_code_link_entity` ON `card_code_link` (`entity_key`);--> statement-breakpoint
CREATE INDEX `idx_card_code_link_file` ON `card_code_link` (`file_path`);--> statement-breakpoint
CREATE TABLE `card_fts` (
	`rowid` integer,
	`key` text,
	`summary` text,
	`body` text
);
--> statement-breakpoint
CREATE TABLE `card_keyword` (
	`card_key` text NOT NULL,
	`keyword_id` integer NOT NULL,
	PRIMARY KEY(`card_key`, `keyword_id`),
	FOREIGN KEY (`card_key`) REFERENCES `card`(`key`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`keyword_id`) REFERENCES `keyword`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_card_keyword_card` ON `card_keyword` (`card_key`);--> statement-breakpoint
CREATE INDEX `idx_card_keyword_keyword` ON `card_keyword` (`keyword_id`);--> statement-breakpoint
CREATE TABLE `card_relation` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`src_card_key` text NOT NULL,
	`dst_card_key` text NOT NULL,
	`is_reverse` integer DEFAULT false NOT NULL,
	`meta_json` text,
	FOREIGN KEY (`src_card_key`) REFERENCES `card`(`key`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dst_card_key`) REFERENCES `card`(`key`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_card_relation_src` ON `card_relation` (`src_card_key`);--> statement-breakpoint
CREATE INDEX `idx_card_relation_dst` ON `card_relation` (`dst_card_key`);--> statement-breakpoint
CREATE INDEX `idx_card_relation_type` ON `card_relation` (`type`);--> statement-breakpoint
CREATE TABLE `card_tag` (
	`card_key` text NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`card_key`, `tag_id`),
	FOREIGN KEY (`card_key`) REFERENCES `card`(`key`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_card_tag_card` ON `card_tag` (`card_key`);--> statement-breakpoint
CREATE INDEX `idx_card_tag_tag` ON `card_tag` (`tag_id`);--> statement-breakpoint
CREATE TABLE `code_entity` (
	`rowid` integer,
	`entity_key` text PRIMARY KEY NOT NULL,
	`file_path` text NOT NULL,
	`symbol_name` text,
	`kind` text NOT NULL,
	`signature` text,
	`fingerprint` text,
	`content_hash` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_code_entity_file_path` ON `code_entity` (`file_path`);--> statement-breakpoint
CREATE INDEX `idx_code_entity_kind` ON `code_entity` (`kind`);--> statement-breakpoint
CREATE TABLE `code_fts` (
	`rowid` integer,
	`entity_key` text,
	`symbol_name` text
);
--> statement-breakpoint
CREATE TABLE `code_relation` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`src_entity_key` text NOT NULL,
	`dst_entity_key` text NOT NULL,
	`meta_json` text,
	FOREIGN KEY (`src_entity_key`) REFERENCES `code_entity`(`entity_key`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dst_entity_key`) REFERENCES `code_entity`(`entity_key`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_code_relation_src` ON `code_relation` (`src_entity_key`);--> statement-breakpoint
CREATE INDEX `idx_code_relation_dst` ON `code_relation` (`dst_entity_key`);--> statement-breakpoint
CREATE INDEX `idx_code_relation_type` ON `code_relation` (`type`);--> statement-breakpoint
CREATE TABLE `file_state` (
	`path` text PRIMARY KEY NOT NULL,
	`content_hash` text NOT NULL,
	`mtime` text NOT NULL,
	`last_indexed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `keyword` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `keyword_name_unique` ON `keyword` (`name`);--> statement-breakpoint
CREATE TABLE `metadata` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tag` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_name_unique` ON `tag` (`name`);