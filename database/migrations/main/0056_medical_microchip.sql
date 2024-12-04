CREATE TYPE "public"."categorization_type" AS ENUM('about', 'file_under');--> statement-breakpoint
CREATE TYPE "public"."creator_role_type" AS ENUM('creator', 'author', 'editor', 'contributor', 'via', 'participant', 'interviewer', 'interviewee', 'subject', 'mentioned');--> statement-breakpoint
CREATE TYPE "public"."record_relation_type" AS ENUM('primary_source', 'quoted_from', 'copied_from', 'derived_from', 'part_of', 'references', 'similar_to', 'responds_to', 'contradicts', 'supports');--> statement-breakpoint
CREATE TYPE "public"."record_type" AS ENUM('resource', 'bookmark', 'object', 'document', 'abstraction', 'extracted');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "record_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"record_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"type" "categorization_type" NOT NULL,
	"primary" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "record_category_unique_idx" UNIQUE("record_id","category_id","type")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "record_creators" (
	"id" serial PRIMARY KEY NOT NULL,
	"record_id" integer NOT NULL,
	"entity_id" integer NOT NULL,
	"role" "creator_role_type" NOT NULL,
	"order" text DEFAULT 'a0' NOT NULL,
	"notes" text,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "record_creator_unique_idx" UNIQUE("record_id","entity_id","role")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "record_media" (
	"id" serial PRIMARY KEY NOT NULL,
	"record_id" integer NOT NULL,
	"media_id" integer NOT NULL,
	"caption" text,
	"order" text DEFAULT 'a0' NOT NULL,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "record_media_unique_idx" UNIQUE("record_id","media_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "record_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"record_id" integer NOT NULL,
	"page_id" integer NOT NULL,
	"order" text DEFAULT 'a0' NOT NULL,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "record_page_unique_idx" UNIQUE("record_id","page_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "record_relations" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"target_id" integer NOT NULL,
	"type" "record_relation_type" NOT NULL,
	"order" text DEFAULT 'a0' NOT NULL,
	"notes" text,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "record_relation_unique_idx" UNIQUE("source_id","target_id","type")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "records" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text,
	"content" text,
	"type" "record_type" NOT NULL,
	"format_id" integer,
	"private" boolean DEFAULT false NOT NULL,
	"flags" "flag"[],
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "record_categories" ADD CONSTRAINT "record_categories_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "record_categories" ADD CONSTRAINT "record_categories_category_id_index_entries_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."index_entries"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "record_creators" ADD CONSTRAINT "record_creators_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "record_creators" ADD CONSTRAINT "record_creators_entity_id_index_entries_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."index_entries"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "record_media" ADD CONSTRAINT "record_media_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "record_media" ADD CONSTRAINT "record_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "record_pages" ADD CONSTRAINT "record_pages_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "record_pages" ADD CONSTRAINT "record_pages_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "record_relations" ADD CONSTRAINT "record_relations_source_id_records_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."records"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "record_relations" ADD CONSTRAINT "record_relations_target_id_records_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."records"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "records" ADD CONSTRAINT "records_format_id_index_entries_id_fk" FOREIGN KEY ("format_id") REFERENCES "public"."index_entries"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "record_category_record_idx" ON "record_categories" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "record_category_category_idx" ON "record_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "record_creator_record_idx" ON "record_creators" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "record_creator_entity_idx" ON "record_creators" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "record_media_record_idx" ON "record_media" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "record_media_media_idx" ON "record_media" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "record_page_record_idx" ON "record_pages" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "record_page_page_idx" ON "record_pages" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "record_relation_source_idx" ON "record_relations" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "record_relation_target_idx" ON "record_relations" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "record_type_idx" ON "records" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "record_format_idx" ON "records" USING btree ("format_id");--> statement-breakpoint
ALTER TABLE "media" DROP COLUMN IF EXISTS "caption";--> statement-breakpoint
ALTER TABLE "pages" DROP COLUMN IF EXISTS "is_internal";--> statement-breakpoint
ALTER TABLE "public"."index_entries" ALTER COLUMN "main_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."index_main_type";--> statement-breakpoint
CREATE TYPE "public"."index_main_type" AS ENUM('entity', 'category ', 'format');--> statement-breakpoint
ALTER TABLE "public"."index_entries" ALTER COLUMN "main_type" SET DATA TYPE "public"."index_main_type" USING "main_type"::"public"."index_main_type";