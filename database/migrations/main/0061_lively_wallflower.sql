ALTER TYPE "integrations"."commit_change_status" RENAME TO "github_commit_change_status";--> statement-breakpoint
ALTER TYPE "integrations"."category" RENAME TO "readwise_category";--> statement-breakpoint
ALTER TYPE "integrations"."location" RENAME TO "readwise_location";--> statement-breakpoint
ALTER MATERIALIZED VIEW "integrations"."browsing_history_daily" RENAME TO "arc_browsing_history_daily";--> statement-breakpoint
DROP MATERIALIZED VIEW "integrations"."arc_browsing_history_daily";--> statement-breakpoint
ALTER TABLE "integrations"."photographs" RENAME TO "adobe_lightroom_images";--> statement-breakpoint
ALTER TABLE "integrations"."attachments" RENAME TO "airtable_attachments";--> statement-breakpoint
ALTER TABLE "integrations"."creators" RENAME TO "airtable_creators";--> statement-breakpoint
ALTER TABLE "integrations"."extract_connections" RENAME TO "airtable_extract_connections";--> statement-breakpoint
ALTER TABLE "integrations"."extract_creators" RENAME TO "airtable_extract_creators";--> statement-breakpoint
ALTER TABLE "integrations"."extract_spaces" RENAME TO "airtable_extract_spaces";--> statement-breakpoint
ALTER TABLE "integrations"."extracts" RENAME TO "airtable_extracts";--> statement-breakpoint
ALTER TABLE "integrations"."spaces" RENAME TO "airtable_spaces";--> statement-breakpoint
ALTER TABLE "integrations"."browsing_history" RENAME TO "arc_browsing_history";--> statement-breakpoint
ALTER TABLE "integrations"."browsing_history_omit_list" RENAME TO "arc_browsing_history_omit_list";--> statement-breakpoint
ALTER TABLE "integrations"."commit_changes" RENAME TO "github_commit_changes";--> statement-breakpoint
ALTER TABLE "integrations"."commits" RENAME TO "github_commits";--> statement-breakpoint
ALTER TABLE "integrations"."stars" RENAME TO "github_stars";--> statement-breakpoint
ALTER TABLE "integrations"."collections" RENAME TO "raindrop_collections";--> statement-breakpoint
ALTER TABLE "integrations"."raindrops" RENAME TO "raindrop_raindrops";--> statement-breakpoint
ALTER TABLE "integrations"."documents" RENAME TO "readwise_documents";--> statement-breakpoint
ALTER TABLE "integrations"."tweets" RENAME TO "twitter_tweets";--> statement-breakpoint
ALTER TABLE "integrations"."adobe_lightroom_images" RENAME COLUMN "url2048" TO "url_2048";--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_raindrops" DROP CONSTRAINT "raindrops_linkUrl_createdAt_unique";--> statement-breakpoint
ALTER TABLE "integrations"."adobe_lightroom_images" DROP CONSTRAINT "photographs_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_attachments" DROP CONSTRAINT "attachments_extract_id_extracts_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_creators" DROP CONSTRAINT "creators_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_connections" DROP CONSTRAINT "extract_connections_from_extract_id_extracts_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_connections" DROP CONSTRAINT "extract_connections_to_extract_id_extracts_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_creators" DROP CONSTRAINT "extract_creators_extract_id_extracts_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_creators" DROP CONSTRAINT "extract_creators_creator_id_creators_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_spaces" DROP CONSTRAINT "extract_spaces_extract_id_extracts_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_spaces" DROP CONSTRAINT "extract_spaces_space_id_spaces_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extracts" DROP CONSTRAINT "extracts_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extracts" DROP CONSTRAINT "extracts_parent_id_extracts_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_spaces" DROP CONSTRAINT "spaces_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."arc_browsing_history" DROP CONSTRAINT "browsing_history_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."github_commit_changes" DROP CONSTRAINT "commit_changes_commit_id_commits_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."github_commits" DROP CONSTRAINT "commits_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."github_stars" DROP CONSTRAINT "stars_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_collections" DROP CONSTRAINT "collections_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_collections" DROP CONSTRAINT "collections_parent_id_collections_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_raindrops" DROP CONSTRAINT "raindrops_collection_id_collections_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_raindrops" DROP CONSTRAINT "raindrops_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."readwise_documents" DROP CONSTRAINT "documents_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."readwise_documents" DROP CONSTRAINT "documents_parent_id_documents_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."twitter_tweets" DROP CONSTRAINT "tweets_user_id_twitter_users_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."twitter_tweets" DROP CONSTRAINT "tweets_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."twitter_tweets" DROP CONSTRAINT "tweets_quoted_tweet_id_tweets_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."twitter_media" DROP CONSTRAINT "twitter_media_tweet_id_tweets_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "photographs_integration_run_id_index";--> statement-breakpoint
DROP INDEX IF EXISTS "photographs_capture_date_index";--> statement-breakpoint
DROP INDEX IF EXISTS "browsing_history_integration_run_id_index";--> statement-breakpoint
DROP INDEX IF EXISTS "browsing_history_view_time_index";--> statement-breakpoint
DROP INDEX IF EXISTS "browsing_history_url_index";--> statement-breakpoint
DROP INDEX IF EXISTS "browsing_history_view_epoch_microseconds_index";--> statement-breakpoint
DROP INDEX IF EXISTS "browsing_history_hostname_index";--> statement-breakpoint
DROP INDEX IF EXISTS "stars_integration_run_id_index";--> statement-breakpoint
DROP INDEX IF EXISTS "stars_starred_at_index";--> statement-breakpoint
DROP INDEX IF EXISTS "collections_parent_id_index";--> statement-breakpoint
DROP INDEX IF EXISTS "raindrops_integration_run_id_index";--> statement-breakpoint
DROP INDEX IF EXISTS "raindrops_link_url_index";--> statement-breakpoint
DROP INDEX IF EXISTS "raindrops_created_at_index";--> statement-breakpoint
DROP INDEX IF EXISTS "documents_integration_run_id_index";--> statement-breakpoint
DROP INDEX IF EXISTS "documents_url_index";--> statement-breakpoint
DROP INDEX IF EXISTS "documents_created_at_index";--> statement-breakpoint
DROP INDEX IF EXISTS "documents_parent_id_index";--> statement-breakpoint
DROP INDEX IF EXISTS "tweets_integration_run_id_index";--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_connections" DROP CONSTRAINT "extract_connections_from_extract_id_to_extract_id_pk";--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_creators" DROP CONSTRAINT "extract_creators_extract_id_creator_id_pk";--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_spaces" DROP CONSTRAINT "extract_spaces_extract_id_space_id_pk";--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_connections" ADD CONSTRAINT "airtable_extract_connections_from_extract_id_to_extract_id_pk" PRIMARY KEY("from_extract_id","to_extract_id");--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_creators" ADD CONSTRAINT "airtable_extract_creators_extract_id_creator_id_pk" PRIMARY KEY("extract_id","creator_id");--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_spaces" ADD CONSTRAINT "airtable_extract_spaces_extract_id_space_id_pk" PRIMARY KEY("extract_id","space_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."adobe_lightroom_images" ADD CONSTRAINT "adobe_lightroom_images_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "integrations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."airtable_attachments" ADD CONSTRAINT "airtable_attachments_extract_id_airtable_extracts_id_fk" FOREIGN KEY ("extract_id") REFERENCES "integrations"."airtable_extracts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."airtable_creators" ADD CONSTRAINT "airtable_creators_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "integrations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."airtable_extract_connections" ADD CONSTRAINT "airtable_extract_connections_from_extract_id_airtable_extracts_id_fk" FOREIGN KEY ("from_extract_id") REFERENCES "integrations"."airtable_extracts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."airtable_extract_connections" ADD CONSTRAINT "airtable_extract_connections_to_extract_id_airtable_extracts_id_fk" FOREIGN KEY ("to_extract_id") REFERENCES "integrations"."airtable_extracts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."airtable_extract_creators" ADD CONSTRAINT "airtable_extract_creators_extract_id_airtable_extracts_id_fk" FOREIGN KEY ("extract_id") REFERENCES "integrations"."airtable_extracts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."airtable_extract_creators" ADD CONSTRAINT "airtable_extract_creators_creator_id_airtable_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "integrations"."airtable_creators"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."airtable_extract_spaces" ADD CONSTRAINT "airtable_extract_spaces_extract_id_airtable_extracts_id_fk" FOREIGN KEY ("extract_id") REFERENCES "integrations"."airtable_extracts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."airtable_extract_spaces" ADD CONSTRAINT "airtable_extract_spaces_space_id_airtable_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "integrations"."airtable_spaces"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."airtable_extracts" ADD CONSTRAINT "airtable_extracts_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "integrations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."airtable_extracts" ADD CONSTRAINT "airtable_extracts_parent_id_airtable_extracts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "integrations"."airtable_extracts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."airtable_spaces" ADD CONSTRAINT "airtable_spaces_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "integrations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."arc_browsing_history" ADD CONSTRAINT "arc_browsing_history_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "integrations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."github_commit_changes" ADD CONSTRAINT "github_commit_changes_commit_id_github_commits_id_fk" FOREIGN KEY ("commit_id") REFERENCES "integrations"."github_commits"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."github_commits" ADD CONSTRAINT "github_commits_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "integrations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."github_stars" ADD CONSTRAINT "github_stars_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "integrations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."raindrop_collections" ADD CONSTRAINT "raindrop_collections_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "integrations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."raindrop_collections" ADD CONSTRAINT "raindrop_collections_parent_id_raindrop_collections_id_fk" FOREIGN KEY ("parent_id") REFERENCES "integrations"."raindrop_collections"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."raindrop_raindrops" ADD CONSTRAINT "raindrop_raindrops_collection_id_raindrop_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "integrations"."raindrop_collections"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."raindrop_raindrops" ADD CONSTRAINT "raindrop_raindrops_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "integrations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."readwise_documents" ADD CONSTRAINT "readwise_documents_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "integrations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."readwise_documents" ADD CONSTRAINT "readwise_documents_parent_id_readwise_documents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "integrations"."readwise_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."twitter_tweets" ADD CONSTRAINT "twitter_tweets_user_id_twitter_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "integrations"."twitter_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."twitter_tweets" ADD CONSTRAINT "twitter_tweets_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "integrations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."twitter_tweets" ADD CONSTRAINT "twitter_tweets_quoted_tweet_id_twitter_tweets_id_fk" FOREIGN KEY ("quoted_tweet_id") REFERENCES "integrations"."twitter_tweets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."twitter_media" ADD CONSTRAINT "twitter_media_tweet_id_twitter_tweets_id_fk" FOREIGN KEY ("tweet_id") REFERENCES "integrations"."twitter_tweets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "adobe_lightroom_images_integration_run_id_index" ON "integrations"."adobe_lightroom_images" USING btree ("integration_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "adobe_lightroom_images_capture_date_index" ON "integrations"."adobe_lightroom_images" USING btree ("capture_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "arc_browsing_history_integration_run_id_index" ON "integrations"."arc_browsing_history" USING btree ("integration_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "arc_browsing_history_view_time_index" ON "integrations"."arc_browsing_history" USING btree ("view_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "arc_browsing_history_view_epoch_microseconds_index" ON "integrations"."arc_browsing_history" USING btree ("view_epoch_microseconds");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "arc_browsing_history_hostname_index" ON "integrations"."arc_browsing_history" USING btree ("hostname");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_stars_integration_run_id_index" ON "integrations"."github_stars" USING btree ("integration_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_stars_starred_at_index" ON "integrations"."github_stars" USING btree ("starred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "raindrop_collections_parent_id_index" ON "integrations"."raindrop_collections" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "raindrop_raindrops_integration_run_id_index" ON "integrations"."raindrop_raindrops" USING btree ("integration_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "raindrop_raindrops_link_url_index" ON "integrations"."raindrop_raindrops" USING btree ("link_url");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "raindrop_raindrops_created_at_index" ON "integrations"."raindrop_raindrops" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "readwise_documents_integration_run_id_index" ON "integrations"."readwise_documents" USING btree ("integration_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "readwise_documents_url_index" ON "integrations"."readwise_documents" USING btree ("url");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "readwise_documents_created_at_index" ON "integrations"."readwise_documents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "readwise_documents_parent_id_index" ON "integrations"."readwise_documents" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "twitter_tweets_integration_run_id_index" ON "integrations"."twitter_tweets" USING btree ("integration_run_id");--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_raindrops" ADD CONSTRAINT "raindrop_raindrops_link_url_created_at_unique" UNIQUE("link_url","created_at");--> statement-breakpoint
CREATE MATERIALIZED VIEW "integrations"."arc_browsing_history_daily" AS (select DATE("view_time" AT TIME ZONE CURRENT_SETTING('timezone')) as "date", "url" as "url", "page_title" as "page_title", "hostname" as "hostname", SUM(COALESCE("view_duration", 0)) as "total_duration", MIN("view_time") as "first_visit", MAX("view_time") as "last_visit", COUNT(*) as "visit_count" from "integrations"."arc_browsing_history" group by DATE("integrations"."arc_browsing_history"."view_time" AT TIME ZONE CURRENT_SETTING('timezone')), "integrations"."arc_browsing_history"."url", "integrations"."arc_browsing_history"."page_title", "integrations"."arc_browsing_history"."hostname");