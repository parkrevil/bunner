CREATE TABLE `memories` (
	`projectKey` text NOT NULL,
	`memoryKey` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`payloadJson` text NOT NULL,
	PRIMARY KEY(`projectKey`, `memoryKey`)
);
--> statement-breakpoint
CREATE INDEX `idx_memories_projectKey` ON `memories` (`projectKey`);
--> statement-breakpoint
CREATE INDEX `idx_memories_updatedAt` ON `memories` (`updatedAt`);
