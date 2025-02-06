ALTER TABLE "locations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "record_sources" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "source_connections" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "source_contents" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sources" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "record_timepoints" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "timepoints" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "indices" DROP CONSTRAINT "indices_canonical_page_id_sources_id_fk";
--> statement-breakpoint
ALTER TABLE "media" DROP CONSTRAINT "media_source_page_id_sources_id_fk";
--> statement-breakpoint
ALTER TABLE "records" DROP CONSTRAINT "records_location_id_locations_id_fk";
--> statement-breakpoint
DROP TABLE "locations" CASCADE;--> statement-breakpoint
DROP TABLE "record_sources" CASCADE;--> statement-breakpoint
DROP TABLE "source_connections" CASCADE;--> statement-breakpoint
DROP TABLE "source_contents" CASCADE;--> statement-breakpoint
DROP TABLE "sources" CASCADE;--> statement-breakpoint
DROP TABLE "record_timepoints" CASCADE;--> statement-breakpoint
DROP TABLE "timepoints" CASCADE;--> statement-breakpoint
ALTER TABLE "github_commits" RENAME COLUMN "embedding" TO "text_embedding";--> statement-breakpoint
ALTER TABLE "indices" RENAME COLUMN "private" TO "is_private";--> statement-breakpoint
ALTER TABLE "records" RENAME COLUMN "private" TO "is_private";--> statement-breakpoint
ALTER TABLE "records" RENAME COLUMN "embedding" TO "text_embedding";--> statement-breakpoint
DROP INDEX "adobe_lightroom_images_archived_at_index";--> statement-breakpoint
DROP INDEX "airtable_extracts_archived_at_index";--> statement-breakpoint
DROP INDEX "github_repositories_archived_at_index";--> statement-breakpoint
DROP INDEX "indices_canonical_page_id_index";--> statement-breakpoint
DROP INDEX "media_source_page_id_index";--> statement-breakpoint
DROP INDEX "raindrop_bookmarks_archived_at_index";--> statement-breakpoint
DROP INDEX "raindrop_collections_archived_at_index";--> statement-breakpoint
DROP INDEX "readwise_documents_archived_at_index";--> statement-breakpoint
DROP INDEX "records_location_id_index";--> statement-breakpoint
DROP INDEX "twitter_media_archived_at_index";--> statement-breakpoint
DROP INDEX "twitter_tweets_archived_at_index";--> statement-breakpoint
DROP INDEX "twitter_users_archived_at_index";--> statement-breakpoint
ALTER TABLE "indices" ADD COLUMN "content_created_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "indices" ADD COLUMN "content_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "indices" ADD COLUMN "needs_curation" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "indices" ADD COLUMN "text_embedding" vector(768);--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "content_created_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "content_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "needs_curation" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "is_private" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "content_created_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "content_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "adobe_lightroom_images" DROP COLUMN "archived_at";--> statement-breakpoint
ALTER TABLE "airtable_extracts" DROP COLUMN "archived_at";--> statement-breakpoint
ALTER TABLE "airtable_extracts" DROP COLUMN "embedding";--> statement-breakpoint
ALTER TABLE "github_repositories" DROP COLUMN "archived_at";--> statement-breakpoint
ALTER TABLE "github_repositories" DROP COLUMN "embedding";--> statement-breakpoint
ALTER TABLE "github_users" DROP COLUMN "embedding";--> statement-breakpoint
ALTER TABLE "indices" DROP COLUMN "canonical_page_id";--> statement-breakpoint
ALTER TABLE "indices" DROP COLUMN "embedding";--> statement-breakpoint
ALTER TABLE "media" DROP COLUMN "source_page_id";--> statement-breakpoint
ALTER TABLE "raindrop_bookmarks" DROP COLUMN "archived_at";--> statement-breakpoint
ALTER TABLE "raindrop_bookmarks" DROP COLUMN "embedding";--> statement-breakpoint
ALTER TABLE "raindrop_collections" DROP COLUMN "archived_at";--> statement-breakpoint
ALTER TABLE "raindrop_collections" DROP COLUMN "embedding";--> statement-breakpoint
ALTER TABLE "readwise_documents" DROP COLUMN "archived_at";--> statement-breakpoint
ALTER TABLE "readwise_documents" DROP COLUMN "embedding";--> statement-breakpoint
ALTER TABLE "records" DROP COLUMN "location_id";--> statement-breakpoint
ALTER TABLE "twitter_media" DROP COLUMN "archived_at";--> statement-breakpoint
ALTER TABLE "twitter_tweets" DROP COLUMN "archived_at";--> statement-breakpoint
ALTER TABLE "twitter_tweets" DROP COLUMN "embedding";--> statement-breakpoint
ALTER TABLE "twitter_users" DROP COLUMN "archived_at";--> statement-breakpoint
ALTER TABLE "twitter_users" DROP COLUMN "embedding";--> statement-breakpoint
DROP TYPE "public"."timepoint_type";