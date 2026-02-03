CREATE TABLE `symbol_files` (
	`projectKey` text NOT NULL,
	`filePath` text NOT NULL,
	`contentHash` text NOT NULL,
	`indexedAt` integer NOT NULL,
	`symbolCount` integer NOT NULL,
	PRIMARY KEY(`projectKey`, `filePath`)
);
--> statement-breakpoint
CREATE INDEX `idx_symbol_files_projectKey` ON `symbol_files` (`projectKey`);
--> statement-breakpoint
CREATE INDEX `idx_symbol_files_indexedAt` ON `symbol_files` (`indexedAt`);
--> statement-breakpoint
CREATE TABLE `symbols` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`projectKey` text NOT NULL,
	`filePath` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`startLine` integer NOT NULL,
	`startColumn` integer NOT NULL,
	`endLine` integer NOT NULL,
	`endColumn` integer NOT NULL,
	`indexedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_symbols_projectKey_name` ON `symbols` (`projectKey`,`name`);
--> statement-breakpoint
CREATE INDEX `idx_symbols_projectKey_filePath` ON `symbols` (`projectKey`,`filePath`);
--> statement-breakpoint
CREATE INDEX `idx_symbols_projectKey_kind` ON `symbols` (`projectKey`,`kind`);
