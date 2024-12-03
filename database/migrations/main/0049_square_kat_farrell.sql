CREATE TYPE "public"."index_main_type" AS ENUM('entity', 'subject', 'format');--> statement-breakpoint
CREATE TYPE "public"."index_relation_type" AS ENUM('related_to', 'opposite_of', 'part_of');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "index_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"short_name" text,
	"sense" text,
	"notes" text,
	"private" boolean DEFAULT false NOT NULL,
	"main_type" "index_main_type" NOT NULL,
	"sub_type" text,
	"canonical_url_id" integer,
	"alias_of" integer,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "index_entry_idx" UNIQUE("name","sense","main_type")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "index_relations" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"target_id" integer NOT NULL,
	"type" "index_relation_type" DEFAULT 'related_to' NOT NULL,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "index_entries" ADD CONSTRAINT "index_entries_canonical_url_id_urls_id_fk" FOREIGN KEY ("canonical_url_id") REFERENCES "public"."urls"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "index_entries" ADD CONSTRAINT "index_entries_alias_of_index_entries_id_fk" FOREIGN KEY ("alias_of") REFERENCES "public"."index_entries"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "index_relations" ADD CONSTRAINT "index_relations_source_id_index_entries_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."index_entries"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "index_relations" ADD CONSTRAINT "index_relations_target_id_index_entries_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."index_entries"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "type_subtype_idx" ON "index_entries" USING btree ("main_type","sub_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_type_idx" ON "events" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_timepoint_idx" ON "events" USING btree ("timepoint");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_parent_idx" ON "events" USING btree ("parent_event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crawl_status_idx" ON "urls" USING btree ("last_crawl_date","last_http_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_type_idx" ON "urls" USING btree ("content_type");