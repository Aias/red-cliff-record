DROP INDEX "lightroom_images_integration_run_id_index";--> statement-breakpoint
DROP INDEX "lightroom_images_capture_date_index";--> statement-breakpoint
DROP INDEX "raindrop_bookmarks_integration_run_id_index";--> statement-breakpoint
DROP INDEX "raindrop_bookmarks_link_url_index";--> statement-breakpoint
DROP INDEX "readwise_documents_integration_run_id_index";--> statement-breakpoint
DROP INDEX "readwise_documents_source_url_index";--> statement-breakpoint
DROP INDEX "readwise_documents_created_at_index";--> statement-breakpoint
ALTER TABLE "lightroom_images" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "airtable_creators" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "airtable_extracts" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "airtable_formats" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "airtable_spaces" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "github_users" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "raindrop_bookmarks" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "raindrop_collections" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "raindrop_tags" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "readwise_authors" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "readwise_documents" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "readwise_tags" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "twitter_tweets" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "twitter_users" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "lightroom_images_deleted_at_index" ON "lightroom_images" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "airtable_creators_deleted_at_index" ON "airtable_creators" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "airtable_extracts_deleted_at_index" ON "airtable_extracts" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "airtable_formats_deleted_at_index" ON "airtable_formats" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "airtable_spaces_deleted_at_index" ON "airtable_spaces" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "github_repositories_deleted_at_index" ON "github_repositories" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "github_users_deleted_at_index" ON "github_users" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "raindrop_bookmarks_deleted_at_index" ON "raindrop_bookmarks" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "raindrop_collections_deleted_at_index" ON "raindrop_collections" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "raindrop_tags_deleted_at_index" ON "raindrop_tags" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "readwise_authors_deleted_at_index" ON "readwise_authors" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "readwise_documents_deleted_at_index" ON "readwise_documents" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "readwise_tags_deleted_at_index" ON "readwise_tags" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "twitter_tweets_deleted_at_index" ON "twitter_tweets" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "twitter_users_deleted_at_index" ON "twitter_users" USING btree ("deleted_at");