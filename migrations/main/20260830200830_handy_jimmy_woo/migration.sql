CREATE SCHEMA IF NOT EXISTS "extensions";--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "vector" SCHEMA "extensions";--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "pg_trgm" SCHEMA "extensions";--> statement-breakpoint
ALTER DATABASE "redcliffrecord" SET search_path = public, extensions;--> statement-breakpoint
CREATE TYPE "browser" AS ENUM('arc', 'dia', 'chrome', 'firefox', 'safari', 'edge');--> statement-breakpoint
CREATE TYPE "feed_source" AS ENUM('feedbin', 'feedly', 'reeder');--> statement-breakpoint
CREATE TYPE "github_commit_change_status" AS ENUM('added', 'modified', 'removed', 'renamed', 'copied', 'changed', 'unchanged');--> statement-breakpoint
CREATE TYPE "github_commit_types" AS ENUM('feature', 'enhancement', 'bugfix', 'refactor', 'documentation', 'style', 'chore', 'test', 'build');--> statement-breakpoint
CREATE TYPE "media_type" AS ENUM('application', 'audio', 'font', 'image', 'message', 'model', 'multipart', 'text', 'video');--> statement-breakpoint
CREATE TYPE "integration_status" AS ENUM('success', 'fail', 'in_progress');--> statement-breakpoint
CREATE TYPE "integration_type" AS ENUM('ai_chat', 'airtable', 'browser_history', 'crawler', 'embeddings', 'feedbin', 'github', 'lightroom', 'manual', 'raindrop', 'readwise', 'twitter');--> statement-breakpoint
CREATE TYPE "run_type" AS ENUM('seed', 'sync');--> statement-breakpoint
CREATE TYPE "raindrop_type" AS ENUM('link', 'document', 'video', 'image', 'audio', 'article');--> statement-breakpoint
CREATE TYPE "readwise_category" AS ENUM('article', 'email', 'rss', 'highlight', 'note', 'pdf', 'epub', 'tweet', 'video', 'podcast');--> statement-breakpoint
CREATE TYPE "readwise_location" AS ENUM('new', 'later', 'shortlist', 'archive', 'feed');--> statement-breakpoint
CREATE TYPE "record_type" AS ENUM('entity', 'concept', 'artifact');--> statement-breakpoint
CREATE TYPE "twitter_media_type" AS ENUM('photo', 'video', 'animated_gif');--> statement-breakpoint
CREATE TABLE "lightroom_images" (
	"id" text PRIMARY KEY,
	"url_2048" text NOT NULL,
	"base_url" text NOT NULL,
	"links" json NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"source_device" text,
	"camera_make" text,
	"camera_model" text,
	"camera_lens" text,
	"capture_date" timestamp with time zone NOT NULL,
	"user_updated_date" timestamp with time zone NOT NULL,
	"file_size" integer NOT NULL,
	"cropped_width" integer NOT NULL,
	"cropped_height" integer NOT NULL,
	"aesthetics" json,
	"exif" json,
	"location" json,
	"rating" integer,
	"auto_tags" text[],
	"integration_run_id" integer NOT NULL,
	"record_id" integer,
	"media_id" integer,
	"deleted_at" timestamp with time zone,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "airtable_attachments" (
	"id" text PRIMARY KEY,
	"url" text NOT NULL,
	"filename" text NOT NULL,
	"size" integer,
	"type" text,
	"width" integer,
	"height" integer,
	"extract_id" text NOT NULL,
	"media_id" integer,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "airtable_creators" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"type" text DEFAULT 'Individual' NOT NULL,
	"primary_project" text,
	"website" text,
	"professions" text[],
	"organizations" text[],
	"nationalities" text[],
	"integration_run_id" integer NOT NULL,
	"record_id" integer,
	"deleted_at" timestamp with time zone,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "airtable_extract_connections" (
	"from_extract_id" text,
	"to_extract_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "airtable_extract_connections_pkey" PRIMARY KEY("from_extract_id","to_extract_id")
);
--> statement-breakpoint
CREATE TABLE "airtable_extract_creators" (
	"extract_id" text,
	"creator_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "airtable_extract_creators_pkey" PRIMARY KEY("extract_id","creator_id")
);
--> statement-breakpoint
CREATE TABLE "airtable_extract_spaces" (
	"extract_id" text,
	"space_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "airtable_extract_spaces_pkey" PRIMARY KEY("extract_id","space_id")
);
--> statement-breakpoint
CREATE TABLE "airtable_extracts" (
	"id" text PRIMARY KEY,
	"title" text NOT NULL,
	"format_string" text DEFAULT 'Fragment' NOT NULL,
	"format_id" integer,
	"source" text,
	"michelin_stars" integer DEFAULT 0 NOT NULL,
	"content" text,
	"notes" text,
	"attachment_caption" text,
	"parent_id" text,
	"lexicographical_order" text DEFAULT 'a0' NOT NULL,
	"integration_run_id" integer NOT NULL,
	"published_at" timestamp with time zone,
	"record_id" integer,
	"deleted_at" timestamp with time zone,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "airtable_formats" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL UNIQUE,
	"integration_run_id" integer NOT NULL,
	"record_id" integer,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "airtable_spaces" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"full_name" text,
	"icon" text,
	"integration_run_id" integer NOT NULL,
	"record_id" integer,
	"deleted_at" timestamp with time zone,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "browsing_history" (
	"id" serial PRIMARY KEY,
	"view_time" timestamp with time zone NOT NULL,
	"browser" "browser" DEFAULT 'arc'::"browser" NOT NULL,
	"hostname" text NOT NULL,
	"view_epoch_microseconds" bigint,
	"view_duration" integer,
	"duration_since_last_view" integer,
	"url" text NOT NULL,
	"page_title" text,
	"search_terms" text,
	"related_searches" text,
	"integration_run_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "browsing_history_unique_idx" UNIQUE("hostname","view_epoch_microseconds","url")
);
--> statement-breakpoint
CREATE TABLE "browsing_history_omit_list" (
	"pattern" text PRIMARY KEY,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_entries" (
	"id" bigint PRIMARY KEY,
	"feed_id" bigint NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"author" text,
	"summary" text,
	"content" text,
	"image_urls" text[],
	"enclosure" jsonb,
	"starred" boolean DEFAULT false NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"record_id" integer,
	"published_at" timestamp with time zone,
	"integration_run_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feeds" (
	"id" bigint PRIMARY KEY,
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
CREATE TABLE "github_commit_changes" (
	"id" serial PRIMARY KEY,
	"filename" text NOT NULL,
	"status" "github_commit_change_status" NOT NULL,
	"patch" text NOT NULL,
	"commit_id" text NOT NULL,
	"changes" integer,
	"additions" integer,
	"deletions" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_commits" (
	"id" text PRIMARY KEY,
	"sha" text NOT NULL UNIQUE,
	"message" text NOT NULL,
	"repository_id" integer NOT NULL,
	"html_url" text NOT NULL,
	"commit_type" "github_commit_types",
	"summary" text,
	"technologies" text[],
	"integration_run_id" integer NOT NULL,
	"changes" integer,
	"additions" integer,
	"deletions" integer,
	"committed_at" timestamp with time zone,
	"content_created_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_repositories" (
	"id" integer PRIMARY KEY,
	"node_id" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"owner_id" integer NOT NULL,
	"readme" text,
	"private" boolean NOT NULL,
	"html_url" text NOT NULL,
	"homepage_url" text,
	"license_name" text,
	"description" text,
	"language" text,
	"topics" text[],
	"starred_at" timestamp with time zone,
	"integration_run_id" integer NOT NULL,
	"record_id" integer,
	"deleted_at" timestamp with time zone,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_users" (
	"id" integer PRIMARY KEY,
	"login" text NOT NULL,
	"node_id" text NOT NULL UNIQUE,
	"avatar_url" text,
	"html_url" text NOT NULL,
	"type" text NOT NULL,
	"partial" boolean NOT NULL,
	"name" text,
	"company" text,
	"blog" text,
	"location" text,
	"email" text,
	"bio" text,
	"twitter_username" text,
	"followers" integer,
	"following" integer,
	"integration_run_id" integer NOT NULL,
	"record_id" integer,
	"deleted_at" timestamp with time zone,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" serial PRIMARY KEY,
	"record_id" integer,
	"url" text NOT NULL,
	"alt_text" text,
	"alt_text_generated_at" timestamp with time zone,
	"type" "media_type" DEFAULT 'application'::"media_type" NOT NULL,
	"format" text DEFAULT 'octet-stream' NOT NULL,
	"content_type_string" text DEFAULT 'application/octet-stream' NOT NULL,
	"file_size" integer,
	"width" integer,
	"height" integer,
	"version_of_media_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_url_record_id_unique" UNIQUE("url","record_id")
);
--> statement-breakpoint
CREATE TABLE "integration_runs" (
	"id" serial PRIMARY KEY,
	"integration_type" "integration_type" NOT NULL,
	"run_type" "run_type" DEFAULT 'sync'::"run_type" NOT NULL,
	"status" "integration_status" DEFAULT 'in_progress'::"integration_status" NOT NULL,
	"message" text,
	"run_start_time" timestamp with time zone NOT NULL,
	"run_end_time" timestamp with time zone,
	"entries_created" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raindrop_bookmark_tags" (
	"id" serial PRIMARY KEY,
	"bookmark_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "raindrop_bookmark_tags_bookmark_id_tag_id_unique" UNIQUE("bookmark_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "raindrop_bookmarks" (
	"id" integer PRIMARY KEY,
	"link_url" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text,
	"note" text,
	"type" "raindrop_type",
	"tags" text[],
	"important" boolean DEFAULT false NOT NULL,
	"domain" text,
	"collection_id" integer,
	"integration_run_id" integer NOT NULL,
	"record_id" integer,
	"deleted_at" timestamp with time zone,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "raindrop_bookmarks_link_url_created_at_unique" UNIQUE("link_url","created_at")
);
--> statement-breakpoint
CREATE TABLE "raindrop_collections" (
	"id" integer PRIMARY KEY,
	"title" text NOT NULL,
	"parent_id" integer,
	"color_hex" text,
	"cover_url" text,
	"raindrop_count" integer,
	"integration_run_id" integer NOT NULL,
	"record_id" integer,
	"deleted_at" timestamp with time zone,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raindrop_highlights" (
	"id" text PRIMARY KEY,
	"text" text NOT NULL,
	"note" text,
	"bookmark_id" integer NOT NULL,
	"record_id" integer,
	"deleted_at" timestamp with time zone,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raindrop_images" (
	"id" serial PRIMARY KEY,
	"url" text NOT NULL,
	"bookmark_id" integer NOT NULL,
	"media_id" integer,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raindrop_tags" (
	"id" serial PRIMARY KEY,
	"tag" text NOT NULL UNIQUE,
	"record_id" integer,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "readwise_authors" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"origin" text,
	"record_id" integer,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "readwise_authors_name_origin_unique" UNIQUE("name","origin")
);
--> statement-breakpoint
CREATE TABLE "readwise_document_tags" (
	"id" serial PRIMARY KEY,
	"document_id" text NOT NULL,
	"tag_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "readwise_document_tags_document_id_tag_id_unique" UNIQUE("document_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "readwise_documents" (
	"id" text PRIMARY KEY,
	"url" text NOT NULL,
	"source_url" text,
	"title" text,
	"author" text,
	"author_id" integer,
	"source" text,
	"content" text,
	"html_content" text,
	"category" "readwise_category",
	"location" "readwise_location",
	"tags" text[],
	"site_name" text,
	"word_count" integer,
	"notes" text,
	"summary" text,
	"image_url" text,
	"parent_id" text,
	"reading_progress" numeric,
	"published_date" date,
	"first_opened_at" timestamp with time zone,
	"last_opened_at" timestamp with time zone,
	"saved_at" timestamp with time zone NOT NULL,
	"last_moved_at" timestamp with time zone NOT NULL,
	"integration_run_id" integer NOT NULL,
	"record_id" integer,
	"deleted_at" timestamp with time zone,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "readwise_tags" (
	"id" serial PRIMARY KEY,
	"tag" text NOT NULL UNIQUE,
	"record_id" integer,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "elo_matchups" (
	"id" serial PRIMARY KEY,
	"record_a_id" integer NOT NULL,
	"record_b_id" integer NOT NULL,
	"winner_id" integer,
	"record_type" "record_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "links" (
	"id" serial PRIMARY KEY,
	"source_id" integer NOT NULL,
	"target_id" integer NOT NULL,
	"predicate" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "links_source_id_target_id_predicate_unique" UNIQUE("source_id","target_id","predicate")
);
--> statement-breakpoint
CREATE TABLE "records" (
	"id" serial PRIMARY KEY,
	"slug" text UNIQUE,
	"type" "record_type" DEFAULT 'artifact'::"record_type" NOT NULL,
	"title" text,
	"sense" text,
	"abbreviation" text,
	"url" text,
	"avatar_url" text,
	"summary" text,
	"content" text,
	"notes" text,
	"media_caption" text,
	"elo_score" integer DEFAULT 1200 NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"curated_at" timestamp with time zone,
	"reminder_at" timestamp with time zone,
	"sources" "integration_type"[],
	"text_search" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce("records"."title", '') || ' ' || coalesce("records"."abbreviation", '') || ' ' || coalesce("records"."sense", '')), 'A') || setweight(to_tsvector('english', coalesce("records"."summary", '') || ' ' || coalesce("records"."media_caption", '')), 'B') || setweight(to_tsvector('english', left(coalesce("records"."content", ''), 100000)), 'C') || setweight(to_tsvector('english', coalesce("records"."notes", '') || ' ' || coalesce("records"."url", '')), 'D')) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"text_embedding" vector(768),
	"text_embedded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "twitter_media" (
	"id" text PRIMARY KEY,
	"type" "twitter_media_type" NOT NULL,
	"tweet_url" text NOT NULL,
	"media_url" text NOT NULL UNIQUE,
	"thumbnail_url" text UNIQUE,
	"tweet_id" text NOT NULL,
	"media_id" integer,
	"deleted_at" timestamp with time zone,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "twitter_tweets" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"text" text,
	"quoted_tweet_id" text,
	"in_reply_to_tweet_id" text,
	"conversation_id" text,
	"integration_run_id" integer NOT NULL,
	"record_id" integer,
	"deleted_at" timestamp with time zone,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "twitter_users" (
	"id" text PRIMARY KEY,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"location" text,
	"url" text,
	"external_url" text,
	"profile_image_url" text,
	"profile_banner_url" text,
	"integration_run_id" integer NOT NULL,
	"record_id" integer,
	"deleted_at" timestamp with time zone,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "lightroom_images_record_id_index" ON "lightroom_images" ("record_id");--> statement-breakpoint
CREATE INDEX "lightroom_images_media_id_index" ON "lightroom_images" ("media_id");--> statement-breakpoint
CREATE INDEX "lightroom_images_deleted_at_index" ON "lightroom_images" ("deleted_at");--> statement-breakpoint
CREATE INDEX "airtable_attachments_media_id_index" ON "airtable_attachments" ("media_id");--> statement-breakpoint
CREATE INDEX "airtable_attachments_deleted_at_index" ON "airtable_attachments" ("deleted_at");--> statement-breakpoint
CREATE INDEX "airtable_creators_record_id_index" ON "airtable_creators" ("record_id");--> statement-breakpoint
CREATE INDEX "airtable_creators_deleted_at_index" ON "airtable_creators" ("deleted_at");--> statement-breakpoint
CREATE INDEX "airtable_extracts_record_id_index" ON "airtable_extracts" ("record_id");--> statement-breakpoint
CREATE INDEX "airtable_extracts_deleted_at_index" ON "airtable_extracts" ("deleted_at");--> statement-breakpoint
CREATE INDEX "airtable_formats_record_id_index" ON "airtable_formats" ("record_id");--> statement-breakpoint
CREATE INDEX "airtable_formats_deleted_at_index" ON "airtable_formats" ("deleted_at");--> statement-breakpoint
CREATE INDEX "airtable_spaces_record_id_index" ON "airtable_spaces" ("record_id");--> statement-breakpoint
CREATE INDEX "airtable_spaces_deleted_at_index" ON "airtable_spaces" ("deleted_at");--> statement-breakpoint
CREATE INDEX "browsing_history_integration_run_id_index" ON "browsing_history" ("integration_run_id");--> statement-breakpoint
CREATE INDEX "browsing_history_view_time_index" ON "browsing_history" ("view_time");--> statement-breakpoint
CREATE INDEX "browsing_history_url_idx" ON "browsing_history" ("url");--> statement-breakpoint
CREATE INDEX "browsing_history_view_epoch_microseconds_index" ON "browsing_history" ("view_epoch_microseconds");--> statement-breakpoint
CREATE INDEX "feed_entries_feed_id_index" ON "feed_entries" ("feed_id");--> statement-breakpoint
CREATE INDEX "feed_entries_record_id_index" ON "feed_entries" ("record_id");--> statement-breakpoint
CREATE INDEX "feed_entries_integration_run_id_index" ON "feed_entries" ("integration_run_id");--> statement-breakpoint
CREATE INDEX "feed_entries_url_index" ON "feed_entries" ("url");--> statement-breakpoint
CREATE INDEX "feeds_feed_url_index" ON "feeds" ("feed_url");--> statement-breakpoint
CREATE INDEX "feeds_site_url_index" ON "feeds" ("site_url");--> statement-breakpoint
CREATE INDEX "feeds_owner_id_index" ON "feeds" ("owner_id");--> statement-breakpoint
CREATE INDEX "github_commit_changes_commit_id_index" ON "github_commit_changes" ("commit_id");--> statement-breakpoint
CREATE INDEX "github_commit_changes_filename_index" ON "github_commit_changes" ("filename");--> statement-breakpoint
CREATE INDEX "github_commits_repository_id_index" ON "github_commits" ("repository_id");--> statement-breakpoint
CREATE INDEX "github_commits_sha_index" ON "github_commits" ("sha");--> statement-breakpoint
CREATE INDEX "github_repositories_owner_id_index" ON "github_repositories" ("owner_id");--> statement-breakpoint
CREATE INDEX "github_repositories_node_id_index" ON "github_repositories" ("node_id");--> statement-breakpoint
CREATE INDEX "github_repositories_record_id_index" ON "github_repositories" ("record_id");--> statement-breakpoint
CREATE INDEX "github_repositories_deleted_at_index" ON "github_repositories" ("deleted_at");--> statement-breakpoint
CREATE INDEX "github_users_login_index" ON "github_users" ("login");--> statement-breakpoint
CREATE INDEX "github_users_record_id_index" ON "github_users" ("record_id");--> statement-breakpoint
CREATE INDEX "github_users_deleted_at_index" ON "github_users" ("deleted_at");--> statement-breakpoint
CREATE INDEX "media_record_id_index" ON "media" ("record_id");--> statement-breakpoint
CREATE INDEX "media_type_format_content_type_string_index" ON "media" ("type","format","content_type_string");--> statement-breakpoint
CREATE INDEX "media_url_index" ON "media" ("url");--> statement-breakpoint
CREATE INDEX "media_version_of_media_id_index" ON "media" ("version_of_media_id");--> statement-breakpoint
CREATE INDEX "integration_runs_integration_type_index" ON "integration_runs" ("integration_type");--> statement-breakpoint
CREATE INDEX "raindrop_bookmark_tags_bookmark_id_index" ON "raindrop_bookmark_tags" ("bookmark_id");--> statement-breakpoint
CREATE INDEX "raindrop_bookmark_tags_tag_id_index" ON "raindrop_bookmark_tags" ("tag_id");--> statement-breakpoint
CREATE INDEX "raindrop_bookmarks_created_at_index" ON "raindrop_bookmarks" ("created_at");--> statement-breakpoint
CREATE INDEX "raindrop_bookmarks_record_id_index" ON "raindrop_bookmarks" ("record_id");--> statement-breakpoint
CREATE INDEX "raindrop_bookmarks_deleted_at_index" ON "raindrop_bookmarks" ("deleted_at");--> statement-breakpoint
CREATE INDEX "raindrop_collections_parent_id_index" ON "raindrop_collections" ("parent_id");--> statement-breakpoint
CREATE INDEX "raindrop_collections_record_id_index" ON "raindrop_collections" ("record_id");--> statement-breakpoint
CREATE INDEX "raindrop_collections_deleted_at_index" ON "raindrop_collections" ("deleted_at");--> statement-breakpoint
CREATE INDEX "raindrop_highlights_bookmark_id_index" ON "raindrop_highlights" ("bookmark_id");--> statement-breakpoint
CREATE INDEX "raindrop_highlights_record_id_index" ON "raindrop_highlights" ("record_id");--> statement-breakpoint
CREATE INDEX "raindrop_highlights_deleted_at_index" ON "raindrop_highlights" ("deleted_at");--> statement-breakpoint
CREATE INDEX "raindrop_images_bookmark_id_index" ON "raindrop_images" ("bookmark_id");--> statement-breakpoint
CREATE INDEX "raindrop_images_media_id_index" ON "raindrop_images" ("media_id");--> statement-breakpoint
CREATE INDEX "raindrop_images_deleted_at_index" ON "raindrop_images" ("deleted_at");--> statement-breakpoint
CREATE INDEX "raindrop_tags_tag_index" ON "raindrop_tags" ("tag");--> statement-breakpoint
CREATE INDEX "raindrop_tags_record_id_index" ON "raindrop_tags" ("record_id");--> statement-breakpoint
CREATE INDEX "raindrop_tags_deleted_at_index" ON "raindrop_tags" ("deleted_at");--> statement-breakpoint
CREATE INDEX "readwise_authors_name_index" ON "readwise_authors" ("name");--> statement-breakpoint
CREATE INDEX "readwise_authors_origin_index" ON "readwise_authors" ("origin");--> statement-breakpoint
CREATE INDEX "readwise_authors_deleted_at_index" ON "readwise_authors" ("deleted_at");--> statement-breakpoint
CREATE INDEX "readwise_document_tags_document_id_index" ON "readwise_document_tags" ("document_id");--> statement-breakpoint
CREATE INDEX "readwise_document_tags_tag_id_index" ON "readwise_document_tags" ("tag_id");--> statement-breakpoint
CREATE INDEX "readwise_documents_parent_id_index" ON "readwise_documents" ("parent_id");--> statement-breakpoint
CREATE INDEX "readwise_documents_record_id_index" ON "readwise_documents" ("record_id");--> statement-breakpoint
CREATE INDEX "readwise_documents_author_id_index" ON "readwise_documents" ("author_id");--> statement-breakpoint
CREATE INDEX "readwise_documents_deleted_at_index" ON "readwise_documents" ("deleted_at");--> statement-breakpoint
CREATE INDEX "readwise_tags_deleted_at_index" ON "readwise_tags" ("deleted_at");--> statement-breakpoint
CREATE INDEX "elo_matchups_record_a_id_index" ON "elo_matchups" ("record_a_id");--> statement-breakpoint
CREATE INDEX "elo_matchups_record_b_id_index" ON "elo_matchups" ("record_b_id");--> statement-breakpoint
CREATE INDEX "elo_matchups_record_type_index" ON "elo_matchups" ("record_type");--> statement-breakpoint
CREATE INDEX "links_source_id_predicate_index" ON "links" ("source_id","predicate");--> statement-breakpoint
CREATE INDEX "links_target_id_predicate_index" ON "links" ("target_id","predicate");--> statement-breakpoint
CREATE INDEX "links_predicate_index" ON "links" ("predicate");--> statement-breakpoint
CREATE INDEX "records_type_title_url_index" ON "records" ("type","title","url");--> statement-breakpoint
CREATE INDEX "records_slug_index" ON "records" ("slug");--> statement-breakpoint
CREATE INDEX "idx_records_sources" ON "records" USING gin ("sources");--> statement-breakpoint
CREATE INDEX "idx_records_title_trgm" ON "records" USING gist ("title" gist_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_records_content_trgm" ON "records" USING gist ("content" gist_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_records_summary_trgm" ON "records" USING gist ("summary" gist_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_records_abbreviation_trgm" ON "records" USING gist ("abbreviation" gist_trgm_ops);--> statement-breakpoint
CREATE INDEX "records_created_at_index" ON "records" ("created_at");--> statement-breakpoint
CREATE INDEX "records_updated_at_index" ON "records" ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_records_curated_recency" ON "records" ("type","curated_at" DESC,"id" DESC) WHERE "curated_at" is not null;--> statement-breakpoint
CREATE INDEX "records_type_elo_score_index" ON "records" ("type","elo_score");--> statement-breakpoint
CREATE INDEX "records_text_embedding_index" ON "records" USING hnsw ("text_embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "idx_records_text_search" ON "records" USING gin ("text_search");--> statement-breakpoint
CREATE INDEX "twitter_media_tweet_id_index" ON "twitter_media" ("tweet_id");--> statement-breakpoint
CREATE INDEX "twitter_media_media_id_index" ON "twitter_media" ("media_id");--> statement-breakpoint
CREATE INDEX "twitter_tweets_integration_run_id_index" ON "twitter_tweets" ("integration_run_id");--> statement-breakpoint
CREATE INDEX "twitter_tweets_record_id_index" ON "twitter_tweets" ("record_id");--> statement-breakpoint
CREATE INDEX "twitter_tweets_user_id_index" ON "twitter_tweets" ("user_id");--> statement-breakpoint
CREATE INDEX "twitter_tweets_deleted_at_index" ON "twitter_tweets" ("deleted_at");--> statement-breakpoint
CREATE INDEX "twitter_users_record_id_index" ON "twitter_users" ("record_id");--> statement-breakpoint
CREATE INDEX "twitter_users_deleted_at_index" ON "twitter_users" ("deleted_at");--> statement-breakpoint
ALTER TABLE "lightroom_images" ADD CONSTRAINT "lightroom_images_integration_run_id_integration_runs_id_fkey" FOREIGN KEY ("integration_run_id") REFERENCES "integration_runs"("id");--> statement-breakpoint
ALTER TABLE "lightroom_images" ADD CONSTRAINT "lightroom_images_record_id_records_id_fkey" FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "lightroom_images" ADD CONSTRAINT "lightroom_images_media_id_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "airtable_attachments" ADD CONSTRAINT "airtable_attachments_extract_id_airtable_extracts_id_fkey" FOREIGN KEY ("extract_id") REFERENCES "airtable_extracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "airtable_attachments" ADD CONSTRAINT "airtable_attachments_media_id_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "airtable_creators" ADD CONSTRAINT "airtable_creators_integration_run_id_integration_runs_id_fkey" FOREIGN KEY ("integration_run_id") REFERENCES "integration_runs"("id");--> statement-breakpoint
ALTER TABLE "airtable_creators" ADD CONSTRAINT "airtable_creators_record_id_records_id_fkey" FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "airtable_extract_connections" ADD CONSTRAINT "airtable_extract_connections_from_extract_fk" FOREIGN KEY ("from_extract_id") REFERENCES "airtable_extracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "airtable_extract_connections" ADD CONSTRAINT "airtable_extract_connections_to_extract_fk" FOREIGN KEY ("to_extract_id") REFERENCES "airtable_extracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "airtable_extract_creators" ADD CONSTRAINT "airtable_extract_creators_extract_id_airtable_extracts_id_fkey" FOREIGN KEY ("extract_id") REFERENCES "airtable_extracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "airtable_extract_creators" ADD CONSTRAINT "airtable_extract_creators_creator_id_airtable_creators_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "airtable_creators"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "airtable_extract_spaces" ADD CONSTRAINT "airtable_extract_spaces_extract_id_airtable_extracts_id_fkey" FOREIGN KEY ("extract_id") REFERENCES "airtable_extracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "airtable_extract_spaces" ADD CONSTRAINT "airtable_extract_spaces_space_id_airtable_spaces_id_fkey" FOREIGN KEY ("space_id") REFERENCES "airtable_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "airtable_extracts" ADD CONSTRAINT "airtable_extracts_format_id_airtable_formats_id_fkey" FOREIGN KEY ("format_id") REFERENCES "airtable_formats"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "airtable_extracts" ADD CONSTRAINT "airtable_extracts_parent_id_airtable_extracts_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "airtable_extracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "airtable_extracts" ADD CONSTRAINT "airtable_extracts_integration_run_id_integration_runs_id_fkey" FOREIGN KEY ("integration_run_id") REFERENCES "integration_runs"("id");--> statement-breakpoint
ALTER TABLE "airtable_extracts" ADD CONSTRAINT "airtable_extracts_record_id_records_id_fkey" FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "airtable_formats" ADD CONSTRAINT "airtable_formats_integration_run_id_integration_runs_id_fkey" FOREIGN KEY ("integration_run_id") REFERENCES "integration_runs"("id");--> statement-breakpoint
ALTER TABLE "airtable_formats" ADD CONSTRAINT "airtable_formats_record_id_records_id_fkey" FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "airtable_spaces" ADD CONSTRAINT "airtable_spaces_integration_run_id_integration_runs_id_fkey" FOREIGN KEY ("integration_run_id") REFERENCES "integration_runs"("id");--> statement-breakpoint
ALTER TABLE "airtable_spaces" ADD CONSTRAINT "airtable_spaces_record_id_records_id_fkey" FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "browsing_history" ADD CONSTRAINT "browsing_history_integration_run_id_integration_runs_id_fkey" FOREIGN KEY ("integration_run_id") REFERENCES "integration_runs"("id");--> statement-breakpoint
ALTER TABLE "feed_entries" ADD CONSTRAINT "feed_entries_feed_id_feeds_id_fkey" FOREIGN KEY ("feed_id") REFERENCES "feeds"("id");--> statement-breakpoint
ALTER TABLE "feed_entries" ADD CONSTRAINT "feed_entries_record_id_records_id_fkey" FOREIGN KEY ("record_id") REFERENCES "records"("id");--> statement-breakpoint
ALTER TABLE "feed_entries" ADD CONSTRAINT "feed_entries_integration_run_id_integration_runs_id_fkey" FOREIGN KEY ("integration_run_id") REFERENCES "integration_runs"("id");--> statement-breakpoint
ALTER TABLE "feeds" ADD CONSTRAINT "feeds_owner_id_records_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "records"("id");--> statement-breakpoint
ALTER TABLE "github_commit_changes" ADD CONSTRAINT "github_commit_changes_commit_id_github_commits_id_fkey" FOREIGN KEY ("commit_id") REFERENCES "github_commits"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "github_commits" ADD CONSTRAINT "github_commits_repository_id_github_repositories_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "github_repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "github_commits" ADD CONSTRAINT "github_commits_integration_run_id_integration_runs_id_fkey" FOREIGN KEY ("integration_run_id") REFERENCES "integration_runs"("id");--> statement-breakpoint
ALTER TABLE "github_repositories" ADD CONSTRAINT "github_repositories_owner_id_github_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "github_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD CONSTRAINT "github_repositories_integration_run_id_integration_runs_id_fkey" FOREIGN KEY ("integration_run_id") REFERENCES "integration_runs"("id");--> statement-breakpoint
ALTER TABLE "github_repositories" ADD CONSTRAINT "github_repositories_record_id_records_id_fkey" FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "github_users" ADD CONSTRAINT "github_users_integration_run_id_integration_runs_id_fkey" FOREIGN KEY ("integration_run_id") REFERENCES "integration_runs"("id");--> statement-breakpoint
ALTER TABLE "github_users" ADD CONSTRAINT "github_users_record_id_records_id_fkey" FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_record_id_records_id_fkey" FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_version_of_media_id_media_id_fkey" FOREIGN KEY ("version_of_media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "raindrop_bookmark_tags" ADD CONSTRAINT "raindrop_bookmark_tags_bookmark_id_raindrop_bookmarks_id_fkey" FOREIGN KEY ("bookmark_id") REFERENCES "raindrop_bookmarks"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "raindrop_bookmark_tags" ADD CONSTRAINT "raindrop_bookmark_tags_tag_id_raindrop_tags_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "raindrop_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "raindrop_bookmarks" ADD CONSTRAINT "raindrop_bookmarks_collection_id_raindrop_collections_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "raindrop_collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "raindrop_bookmarks" ADD CONSTRAINT "raindrop_bookmarks_integration_run_id_integration_runs_id_fkey" FOREIGN KEY ("integration_run_id") REFERENCES "integration_runs"("id");--> statement-breakpoint
ALTER TABLE "raindrop_bookmarks" ADD CONSTRAINT "raindrop_bookmarks_record_id_records_id_fkey" FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "raindrop_collections" ADD CONSTRAINT "raindrop_collections_parent_id_raindrop_collections_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "raindrop_collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "raindrop_collections" ADD CONSTRAINT "raindrop_collections_RartR9WGeuKw_fkey" FOREIGN KEY ("integration_run_id") REFERENCES "integration_runs"("id");--> statement-breakpoint
ALTER TABLE "raindrop_collections" ADD CONSTRAINT "raindrop_collections_record_id_records_id_fkey" FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "raindrop_highlights" ADD CONSTRAINT "raindrop_highlights_bookmark_id_raindrop_bookmarks_id_fkey" FOREIGN KEY ("bookmark_id") REFERENCES "raindrop_bookmarks"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "raindrop_highlights" ADD CONSTRAINT "raindrop_highlights_record_id_records_id_fkey" FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "raindrop_images" ADD CONSTRAINT "raindrop_images_bookmark_id_raindrop_bookmarks_id_fkey" FOREIGN KEY ("bookmark_id") REFERENCES "raindrop_bookmarks"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "raindrop_images" ADD CONSTRAINT "raindrop_images_media_id_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "raindrop_tags" ADD CONSTRAINT "raindrop_tags_record_id_records_id_fkey" FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "readwise_authors" ADD CONSTRAINT "readwise_authors_record_id_records_id_fkey" FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "readwise_document_tags" ADD CONSTRAINT "readwise_document_tags_document_id_readwise_documents_id_fkey" FOREIGN KEY ("document_id") REFERENCES "readwise_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "readwise_document_tags" ADD CONSTRAINT "readwise_document_tags_tag_id_readwise_tags_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "readwise_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "readwise_documents" ADD CONSTRAINT "readwise_documents_author_id_readwise_authors_id_fkey" FOREIGN KEY ("author_id") REFERENCES "readwise_authors"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "readwise_documents" ADD CONSTRAINT "readwise_documents_parent_id_readwise_documents_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "readwise_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "readwise_documents" ADD CONSTRAINT "readwise_documents_integration_run_id_integration_runs_id_fkey" FOREIGN KEY ("integration_run_id") REFERENCES "integration_runs"("id");--> statement-breakpoint
ALTER TABLE "readwise_documents" ADD CONSTRAINT "readwise_documents_record_id_records_id_fkey" FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "readwise_tags" ADD CONSTRAINT "readwise_tags_record_id_records_id_fkey" FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "elo_matchups" ADD CONSTRAINT "elo_matchups_record_a_id_records_id_fkey" FOREIGN KEY ("record_a_id") REFERENCES "records"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "elo_matchups" ADD CONSTRAINT "elo_matchups_record_b_id_records_id_fkey" FOREIGN KEY ("record_b_id") REFERENCES "records"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "elo_matchups" ADD CONSTRAINT "elo_matchups_winner_id_records_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "records"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_source_id_records_id_fkey" FOREIGN KEY ("source_id") REFERENCES "records"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_target_id_records_id_fkey" FOREIGN KEY ("target_id") REFERENCES "records"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "twitter_media" ADD CONSTRAINT "twitter_media_tweet_id_twitter_tweets_id_fkey" FOREIGN KEY ("tweet_id") REFERENCES "twitter_tweets"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "twitter_media" ADD CONSTRAINT "twitter_media_media_id_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "twitter_tweets" ADD CONSTRAINT "twitter_tweets_user_id_twitter_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "twitter_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "twitter_tweets" ADD CONSTRAINT "twitter_tweets_quoted_tweet_id_twitter_tweets_id_fkey" FOREIGN KEY ("quoted_tweet_id") REFERENCES "twitter_tweets"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "twitter_tweets" ADD CONSTRAINT "twitter_tweets_in_reply_to_tweet_id_twitter_tweets_id_fkey" FOREIGN KEY ("in_reply_to_tweet_id") REFERENCES "twitter_tweets"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "twitter_tweets" ADD CONSTRAINT "twitter_tweets_integration_run_id_integration_runs_id_fkey" FOREIGN KEY ("integration_run_id") REFERENCES "integration_runs"("id");--> statement-breakpoint
ALTER TABLE "twitter_tweets" ADD CONSTRAINT "twitter_tweets_record_id_records_id_fkey" FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "twitter_users" ADD CONSTRAINT "twitter_users_integration_run_id_integration_runs_id_fkey" FOREIGN KEY ("integration_run_id") REFERENCES "integration_runs"("id");--> statement-breakpoint
ALTER TABLE "twitter_users" ADD CONSTRAINT "twitter_users_record_id_records_id_fkey" FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE SET NULL ON UPDATE CASCADE;