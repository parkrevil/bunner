CREATE TABLE "entity" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"entity_key" text NOT NULL,
	"entity_type_id" smallint NOT NULL,
	"summary" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"last_seen_run" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entity_workspace_key" UNIQUE("workspace_id","entity_key")
);
--> statement-breakpoint
CREATE TABLE "entity_type" (
	"id" "smallserial" PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "entity_type_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "fact" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_id" integer NOT NULL,
	"fact_type_id" smallint NOT NULL,
	"fact_key" text NOT NULL,
	"payload_text" text,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"content_hash" text,
	"payload_tsv" "tsvector",
	CONSTRAINT "fact_entity_type_key" UNIQUE("entity_id","fact_type_id","fact_key")
);
--> statement-breakpoint
CREATE TABLE "fact_type" (
	"id" "smallserial" PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "fact_type_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "relation" (
	"id" serial PRIMARY KEY NOT NULL,
	"src_entity_id" integer NOT NULL,
	"dst_entity_id" integer NOT NULL,
	"relation_type_id" smallint NOT NULL,
	"strength_type_id" smallint NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "relation_unique" UNIQUE("src_entity_id","dst_entity_id","relation_type_id","strength_type_id")
);
--> statement-breakpoint
CREATE TABLE "relation_evidence" (
	"relation_id" integer NOT NULL,
	"fact_id" integer NOT NULL,
	CONSTRAINT "relation_evidence_pkey" PRIMARY KEY("relation_id","fact_id")
);
--> statement-breakpoint
CREATE TABLE "relation_type" (
	"id" "smallserial" PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "relation_type_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "source" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"entity_id" integer NOT NULL,
	"kind" text NOT NULL,
	"file_path" text NOT NULL,
	"span_start" integer,
	"span_end" integer,
	"content_hash" text NOT NULL,
	CONSTRAINT "source_workspace_loc" UNIQUE("workspace_id","kind","file_path","span_start","span_end")
);
--> statement-breakpoint
CREATE TABLE "strength_type" (
	"id" "smallserial" PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"rank" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "strength_type_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "sync_event" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"entity_id" integer NOT NULL,
	"action" text NOT NULL,
	"prev_content_hash" text,
	"new_content_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_run" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"trigger" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace" (
	"id" text PRIMARY KEY NOT NULL,
	"hostname" text NOT NULL,
	"repo_root" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entity" ADD CONSTRAINT "entity_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity" ADD CONSTRAINT "entity_entity_type_id_entity_type_id_fk" FOREIGN KEY ("entity_type_id") REFERENCES "public"."entity_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity" ADD CONSTRAINT "entity_last_seen_run_sync_run_id_fk" FOREIGN KEY ("last_seen_run") REFERENCES "public"."sync_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact" ADD CONSTRAINT "fact_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact" ADD CONSTRAINT "fact_fact_type_id_fact_type_id_fk" FOREIGN KEY ("fact_type_id") REFERENCES "public"."fact_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relation" ADD CONSTRAINT "relation_src_entity_id_entity_id_fk" FOREIGN KEY ("src_entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relation" ADD CONSTRAINT "relation_dst_entity_id_entity_id_fk" FOREIGN KEY ("dst_entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relation" ADD CONSTRAINT "relation_relation_type_id_relation_type_id_fk" FOREIGN KEY ("relation_type_id") REFERENCES "public"."relation_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relation" ADD CONSTRAINT "relation_strength_type_id_strength_type_id_fk" FOREIGN KEY ("strength_type_id") REFERENCES "public"."strength_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relation_evidence" ADD CONSTRAINT "relation_evidence_relation_id_relation_id_fk" FOREIGN KEY ("relation_id") REFERENCES "public"."relation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relation_evidence" ADD CONSTRAINT "relation_evidence_fact_id_fact_id_fk" FOREIGN KEY ("fact_id") REFERENCES "public"."fact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source" ADD CONSTRAINT "source_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source" ADD CONSTRAINT "source_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_event" ADD CONSTRAINT "sync_event_run_id_sync_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."sync_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_event" ADD CONSTRAINT "sync_event_entity_id_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_run" ADD CONSTRAINT "sync_run_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;