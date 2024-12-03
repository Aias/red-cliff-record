CREATE TYPE "public"."url_type" AS ENUM('primary', 'crawled');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "url_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"target_id" integer NOT NULL,
	"metadata" json,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "urls" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" varchar NOT NULL,
	"title" varchar,
	"type" "url_type" DEFAULT 'primary' NOT NULL,
	"last_crawl_date" timestamp with time zone,
	"last_http_status" integer,
	"content_type" varchar,
	"is_internal" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "url_idx" UNIQUE("url")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "url_links" ADD CONSTRAINT "url_links_source_id_urls_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."urls"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "url_links" ADD CONSTRAINT "url_links_target_id_urls_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."urls"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
