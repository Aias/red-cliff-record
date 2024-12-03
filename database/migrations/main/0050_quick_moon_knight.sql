CREATE TYPE "public"."document_format" AS ENUM('html', 'markdown', 'plaintext');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('image', 'video', 'audio', 'pdf');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"url_id" integer,
	"title" text NOT NULL,
	"format" "document_format" NOT NULL,
	"content" text NOT NULL,
	"metadata" json,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "media_type" NOT NULL,
	"url_id" integer NOT NULL,
	"title" text,
	"alt_text" text,
	"caption" text,
	"metadata" json,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_url_id_urls_id_fk" FOREIGN KEY ("url_id") REFERENCES "public"."urls"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media" ADD CONSTRAINT "media_url_id_urls_id_fk" FOREIGN KEY ("url_id") REFERENCES "public"."urls"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_format_idx" ON "documents" USING btree ("format");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_type_idx" ON "media" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_url_idx" ON "media" USING btree ("url_id");