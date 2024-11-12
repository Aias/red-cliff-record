CREATE TABLE IF NOT EXISTS "airtable_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"filename" text NOT NULL,
	"size" integer,
	"type" text,
	"width" integer,
	"height" integer,
	"extract_id" text NOT NULL,
	"updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "airtable_creators" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'Individual' NOT NULL,
	"primary_project" text,
	"website" text,
	"professions" text[],
	"organizations" text[],
	"nationalities" text[],
	"integration_run_id" integer NOT NULL,
	"updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "airtable_extract_connections" (
	"from_extract_id" text NOT NULL,
	"to_extract_id" text NOT NULL,
	"updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "airtable_extract_connections_from_extract_id_to_extract_id_pk" PRIMARY KEY("from_extract_id","to_extract_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "airtable_extract_creators" (
	"extract_id" text NOT NULL,
	"creator_id" text NOT NULL,
	"updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "airtable_extract_creators_extract_id_creator_id_pk" PRIMARY KEY("extract_id","creator_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "airtable_extract_spaces" (
	"extract_id" text NOT NULL,
	"space_id" text NOT NULL,
	"updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "airtable_extract_spaces_extract_id_space_id_pk" PRIMARY KEY("extract_id","space_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "airtable_extracts" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"format" text DEFAULT 'Fragment' NOT NULL,
	"source" text,
	"michelin_stars" integer,
	"content" text,
	"notes" text,
	"attachment_caption" text,
	"parent_id" text,
	"lexicographical_order" text DEFAULT 'a0' NOT NULL,
	"integration_run_id" integer NOT NULL,
	"published_at" timestamp,
	"updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "airtable_spaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"full_name" text,
	"icon" text,
	"description" text,
	"integration_run_id" integer NOT NULL,
	"updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable_attachments" ADD CONSTRAINT "airtable_attachments_extract_id_airtable_extracts_id_fk" FOREIGN KEY ("extract_id") REFERENCES "public"."airtable_extracts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable_creators" ADD CONSTRAINT "airtable_creators_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable_extract_connections" ADD CONSTRAINT "airtable_extract_connections_from_extract_id_airtable_extracts_id_fk" FOREIGN KEY ("from_extract_id") REFERENCES "public"."airtable_extracts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable_extract_connections" ADD CONSTRAINT "airtable_extract_connections_to_extract_id_airtable_extracts_id_fk" FOREIGN KEY ("to_extract_id") REFERENCES "public"."airtable_extracts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable_extract_creators" ADD CONSTRAINT "airtable_extract_creators_extract_id_airtable_extracts_id_fk" FOREIGN KEY ("extract_id") REFERENCES "public"."airtable_extracts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable_extract_creators" ADD CONSTRAINT "airtable_extract_creators_creator_id_airtable_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."airtable_creators"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable_extract_spaces" ADD CONSTRAINT "airtable_extract_spaces_extract_id_airtable_extracts_id_fk" FOREIGN KEY ("extract_id") REFERENCES "public"."airtable_extracts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable_extract_spaces" ADD CONSTRAINT "airtable_extract_spaces_space_id_airtable_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."airtable_spaces"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable_extracts" ADD CONSTRAINT "airtable_extracts_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable_extracts" ADD CONSTRAINT "airtable_extracts_parent_id_airtable_extracts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."airtable_extracts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable_spaces" ADD CONSTRAINT "airtable_spaces_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
