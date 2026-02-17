PRAGMA foreign_keys=OFF;
--> statement-breakpoint

CREATE TABLE `__card_relation_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL CHECK (`type` IN ('depends-on','references','related','extends','conflicts')),
	`src_card_key` text NOT NULL,
	`dst_card_key` text NOT NULL,
	`is_reverse` integer DEFAULT false NOT NULL,
	`meta_json` text,
	FOREIGN KEY (`src_card_key`) REFERENCES `card`(`key`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dst_card_key`) REFERENCES `card`(`key`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `__card_relation_new` (`id`, `type`, `src_card_key`, `dst_card_key`, `is_reverse`, `meta_json`)
SELECT `id`, `type`, `src_card_key`, `dst_card_key`, `is_reverse`, `meta_json`
FROM `card_relation`;
--> statement-breakpoint

DROP TABLE `card_relation`;
--> statement-breakpoint

ALTER TABLE `__card_relation_new` RENAME TO `card_relation`;
--> statement-breakpoint

CREATE INDEX `idx_card_relation_src` ON `card_relation` (`src_card_key`);
--> statement-breakpoint
CREATE INDEX `idx_card_relation_dst` ON `card_relation` (`dst_card_key`);
--> statement-breakpoint
CREATE INDEX `idx_card_relation_type` ON `card_relation` (`type`);
--> statement-breakpoint

PRAGMA foreign_keys=ON;
