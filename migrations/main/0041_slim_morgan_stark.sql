CREATE TYPE "public"."feed_source" AS ENUM('feedbin', 'feedly', 'reeder');--> statement-breakpoint
CREATE TABLE "feed_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"feed_id" integer NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"author" text,
	"content" text,
	"image_urls" text[],
	"enclosure" jsonb,
	"starred" boolean DEFAULT false NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"record_id" integer,
	"published_at" timestamp with time zone,
	"integration_run_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"text_embedding" vector(768)
);
--> statement-breakpoint
CREATE TABLE "feeds" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"feed_url" text NOT NULL,
	"site_url" text,
	"icon_url" text,
	"description" text,
	"sources" "feed_source"[] NOT NULL,
	"owner_id" integer,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feed_entries" ADD CONSTRAINT "feed_entries_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_entries" ADD CONSTRAINT "feed_entries_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_entries" ADD CONSTRAINT "feed_entries_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feeds" ADD CONSTRAINT "feeds_owner_id_records_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feed_entries_feed_id_index" ON "feed_entries" USING btree ("feed_id");--> statement-breakpoint
CREATE INDEX "feed_entries_record_id_index" ON "feed_entries" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "feed_entries_integration_run_id_index" ON "feed_entries" USING btree ("integration_run_id");--> statement-breakpoint
CREATE INDEX "feed_entries_url_index" ON "feed_entries" USING btree ("url");--> statement-breakpoint
CREATE INDEX "feeds_feed_url_index" ON "feeds" USING btree ("feed_url");--> statement-breakpoint
CREATE INDEX "feeds_site_url_index" ON "feeds" USING btree ("site_url");--> statement-breakpoint
CREATE INDEX "feeds_owner_id_index" ON "feeds" USING btree ("owner_id");