-- Rename primary key constraints to match table names
ALTER TABLE "integrations"."adobe_lightroom_images" RENAME CONSTRAINT "photographs_pkey" TO "adobe_lightroom_images_pkey";--> statement-breakpoint
ALTER TABLE "integrations"."arc_browsing_history" RENAME CONSTRAINT "browsing_history_pkey" TO "arc_browsing_history_pkey";--> statement-breakpoint
ALTER TABLE "integrations"."arc_browsing_history_omit_list" RENAME CONSTRAINT "browsing_history_omit_list_pkey" TO "arc_browsing_history_omit_list_pkey";--> statement-breakpoint
ALTER TABLE "integrations"."github_commit_changes" RENAME CONSTRAINT "commit_changes_pkey" TO "github_commit_changes_pkey";--> statement-breakpoint
ALTER TABLE "integrations"."github_commits" RENAME CONSTRAINT "commits_pkey" TO "github_commits_pkey";--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_bookmarks" RENAME CONSTRAINT "raindrops_pkey" TO "raindrop_bookmarks_pkey";--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_collections" RENAME CONSTRAINT "collections_pkey" TO "raindrop_collections_pkey";--> statement-breakpoint
ALTER TABLE "integrations"."readwise_documents" RENAME CONSTRAINT "documents_pkey" TO "readwise_documents_pkey";--> statement-breakpoint
ALTER TABLE "integrations"."twitter_media" RENAME CONSTRAINT "media_pkey" TO "twitter_media_pkey";--> statement-breakpoint
ALTER TABLE "integrations"."twitter_tweets" RENAME CONSTRAINT "tweets_pkey" TO "twitter_tweets_pkey";--> statement-breakpoint
ALTER TABLE "integrations"."twitter_users" RENAME CONSTRAINT "users_pkey" TO "twitter_users_pkey";--> statement-breakpoint

ALTER TYPE "integrations"."browser" SET SCHEMA "public";--> statement-breakpoint
ALTER TYPE "integrations"."github_commit_change_status" SET SCHEMA "public";--> statement-breakpoint
ALTER TYPE "integrations"."github_commit_types" SET SCHEMA "public";--> statement-breakpoint
ALTER TYPE "integrations"."readwise_category" SET SCHEMA "public";--> statement-breakpoint
ALTER TYPE "integrations"."readwise_location" SET SCHEMA "public";--> statement-breakpoint
ALTER TYPE "integrations"."twitter_media_type" SET SCHEMA "public";--> statement-breakpoint
ALTER TYPE "operations"."integration_status" SET SCHEMA "public";--> statement-breakpoint
ALTER TYPE "operations"."integration_type" SET SCHEMA "public";--> statement-breakpoint
ALTER TYPE "operations"."run_type" SET SCHEMA "public";--> statement-breakpoint
ALTER TABLE "integrations"."adobe_lightroom_images" SET SCHEMA "public";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_attachments" SET SCHEMA "public";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_creators" SET SCHEMA "public";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_connections" SET SCHEMA "public";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_creators" SET SCHEMA "public";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_spaces" SET SCHEMA "public";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extracts" SET SCHEMA "public";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_spaces" SET SCHEMA "public";
--> statement-breakpoint
ALTER TABLE "integrations"."arc_browsing_history" SET SCHEMA "public";
--> statement-breakpoint
ALTER TABLE "integrations"."arc_browsing_history_omit_list" SET SCHEMA "public";
--> statement-breakpoint
ALTER TABLE "integrations"."github_commit_changes" SET SCHEMA "public";
--> statement-breakpoint
ALTER TABLE "integrations"."github_commits" SET SCHEMA "public";
--> statement-breakpoint
ALTER TABLE "integrations"."github_repositories" SET SCHEMA "public";
--> statement-breakpoint
ALTER TABLE "integrations"."github_users" SET SCHEMA "public";
--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_bookmarks" SET SCHEMA "public";
--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_collections" SET SCHEMA "public";
--> statement-breakpoint
ALTER TABLE "integrations"."readwise_documents" SET SCHEMA "public";
--> statement-breakpoint
ALTER TABLE "integrations"."twitter_media" SET SCHEMA "public";
--> statement-breakpoint
ALTER TABLE "integrations"."twitter_tweets" SET SCHEMA "public";
--> statement-breakpoint
ALTER TABLE "integrations"."twitter_users" SET SCHEMA "public";
--> statement-breakpoint
ALTER TABLE "operations"."integration_runs" SET SCHEMA "public";
--> statement-breakpoint
DROP SCHEMA "integrations";
--> statement-breakpoint
DROP SCHEMA "operations";
