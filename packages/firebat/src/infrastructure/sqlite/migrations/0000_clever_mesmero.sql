CREATE TABLE `artifacts` (
	`projectKey` text NOT NULL,
	`kind` text NOT NULL,
	`artifactKey` text NOT NULL,
	`inputsDigest` text NOT NULL,
	`createdAt` integer NOT NULL,
	`payloadJson` text NOT NULL,
	PRIMARY KEY(`projectKey`, `kind`, `artifactKey`, `inputsDigest`)
);
--> statement-breakpoint
CREATE INDEX `idx_artifacts_projectKey_kind` ON `artifacts` (`projectKey`,`kind`);--> statement-breakpoint
CREATE INDEX `idx_artifacts_createdAt` ON `artifacts` (`createdAt`);--> statement-breakpoint
CREATE TABLE `files` (
	`projectKey` text NOT NULL,
	`filePath` text NOT NULL,
	`mtimeMs` integer NOT NULL,
	`size` integer NOT NULL,
	`contentHash` text NOT NULL,
	`updatedAt` integer NOT NULL,
	PRIMARY KEY(`projectKey`, `filePath`)
);
--> statement-breakpoint
CREATE INDEX `idx_files_projectKey` ON `files` (`projectKey`);--> statement-breakpoint
CREATE TABLE `reports` (
	`projectKey` text NOT NULL,
	`reportKey` text NOT NULL,
	`createdAt` integer NOT NULL,
	`reportJson` text NOT NULL,
	PRIMARY KEY(`projectKey`, `reportKey`)
);
