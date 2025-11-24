-------------------------------
-- 1. SCHEMA and EXTENSIONS
-------------------------------
CREATE SCHEMA IF NOT EXISTS "extensions";

CREATE EXTENSION IF NOT EXISTS "vector" SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_trgm" SCHEMA "extensions";

ALTER DATABASE "redcliffrecord" SET search_path = public, extensions;

-------------------------------
-- 2. TYPES
-------------------------------
CREATE TYPE "public"."browser" AS ENUM('arc', 'dia', 'chrome', 'firefox', 'safari', 'edge');--> statement-breakpoint
CREATE TYPE "public"."feed_source" AS ENUM('feedbin', 'feedly', 'reeder');--> statement-breakpoint
CREATE TYPE "public"."github_commit_change_status" AS ENUM('added', 'modified', 'removed', 'renamed', 'copied', 'changed', 'unchanged');--> statement-breakpoint
CREATE TYPE "public"."github_commit_types" AS ENUM('feature', 'enhancement', 'bugfix', 'refactor', 'documentation', 'style', 'chore', 'test', 'build');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('application', 'audio', 'font', 'image', 'message', 'model', 'multipart', 'text', 'video');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('success', 'fail', 'in_progress');--> statement-breakpoint
CREATE TYPE "public"."integration_type" AS ENUM('ai_chat', 'airtable', 'browser_history', 'crawler', 'embeddings', 'feedbin', 'github', 'lightroom', 'manual', 'raindrop', 'readwise', 'twitter');--> statement-breakpoint
CREATE TYPE "public"."run_type" AS ENUM('seed', 'sync');--> statement-breakpoint
CREATE TYPE "public"."raindrop_type" AS ENUM('link', 'document', 'video', 'image', 'audio', 'article');--> statement-breakpoint
CREATE TYPE "public"."readwise_category" AS ENUM('article', 'email', 'rss', 'highlight', 'note', 'pdf', 'epub', 'tweet', 'video');--> statement-breakpoint
CREATE TYPE "public"."readwise_location" AS ENUM('new', 'later', 'shortlist', 'archive', 'feed');--> statement-breakpoint
CREATE TYPE "public"."predicate_type" AS ENUM('creation', 'containment', 'description', 'association', 'reference', 'identity', 'form');--> statement-breakpoint
CREATE TYPE "public"."record_type" AS ENUM('entity', 'concept', 'artifact');--> statement-breakpoint
CREATE TYPE "public"."twitter_media_type" AS ENUM('photo', 'video', 'animated_gif');--> statement-breakpoint
CREATE TABLE "lightroom_images" (
	"id" text PRIMARY KEY NOT NULL,
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
	"id" text PRIMARY KEY NOT NULL,
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
	"id" text PRIMARY KEY NOT NULL,
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
	"from_extract_id" text NOT NULL,
	"to_extract_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "airtable_extract_connections_from_extract_id_to_extract_id_pk" PRIMARY KEY("from_extract_id","to_extract_id")
);
--> statement-breakpoint
CREATE TABLE "airtable_extract_creators" (
	"extract_id" text NOT NULL,
	"creator_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "airtable_extract_creators_extract_id_creator_id_pk" PRIMARY KEY("extract_id","creator_id")
);
--> statement-breakpoint
CREATE TABLE "airtable_extract_spaces" (
	"extract_id" text NOT NULL,
	"space_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "airtable_extract_spaces_extract_id_space_id_pk" PRIMARY KEY("extract_id","space_id")
);
--> statement-breakpoint
CREATE TABLE "airtable_extracts" (
	"id" text PRIMARY KEY NOT NULL,
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
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"integration_run_id" integer NOT NULL,
	"record_id" integer,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "airtable_formats_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "airtable_spaces" (
	"id" text PRIMARY KEY NOT NULL,
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
	"id" serial PRIMARY KEY NOT NULL,
	"view_time" timestamp with time zone NOT NULL,
	"browser" "browser" DEFAULT 'arc' NOT NULL,
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
	"pattern" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_entries" (
	"id" bigint PRIMARY KEY NOT NULL,
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"text_embedding" vector(768)
);
--> statement-breakpoint
CREATE TABLE "feeds" (
	"id" bigint PRIMARY KEY NOT NULL,
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
	"id" serial PRIMARY KEY NOT NULL,
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
	"id" text PRIMARY KEY NOT NULL,
	"sha" text NOT NULL,
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "github_commits_sha_unique" UNIQUE("sha")
);
--> statement-breakpoint
CREATE TABLE "github_repositories" (
	"id" integer PRIMARY KEY NOT NULL,
	"node_id" text NOT NULL,
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "github_repositories_node_id_unique" UNIQUE("node_id")
);
--> statement-breakpoint
CREATE TABLE "github_users" (
	"id" integer PRIMARY KEY NOT NULL,
	"login" text NOT NULL,
	"node_id" text NOT NULL,
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "github_users_node_id_unique" UNIQUE("node_id")
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" serial PRIMARY KEY NOT NULL,
	"record_id" integer,
	"url" text NOT NULL,
	"alt_text" text,
	"type" "media_type" DEFAULT 'application' NOT NULL,
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
	"id" serial PRIMARY KEY NOT NULL,
	"integration_type" "integration_type" NOT NULL,
	"run_type" "run_type" DEFAULT 'sync' NOT NULL,
	"status" "integration_status" DEFAULT 'in_progress' NOT NULL,
	"message" text,
	"run_start_time" timestamp with time zone NOT NULL,
	"run_end_time" timestamp with time zone,
	"entries_created" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raindrop_bookmark_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"bookmark_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "raindrop_bookmark_tags_bookmark_id_tag_id_unique" UNIQUE("bookmark_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "raindrop_bookmarks" (
	"id" integer PRIMARY KEY NOT NULL,
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
	"id" integer PRIMARY KEY NOT NULL,
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
CREATE TABLE "raindrop_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"bookmark_id" integer NOT NULL,
	"media_id" integer,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raindrop_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"tag" text NOT NULL,
	"record_id" integer,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "raindrop_tags_tag_unique" UNIQUE("tag")
);
--> statement-breakpoint
CREATE TABLE "readwise_authors" (
	"id" serial PRIMARY KEY NOT NULL,
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
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"tag_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "readwise_document_tags_document_id_tag_id_unique" UNIQUE("document_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "readwise_documents" (
	"id" text PRIMARY KEY NOT NULL,
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
	"id" serial PRIMARY KEY NOT NULL,
	"tag" text NOT NULL,
	"record_id" integer,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "readwise_tags_tag_unique" UNIQUE("tag")
);
--> statement-breakpoint
CREATE TABLE "links" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"target_id" integer NOT NULL,
	"predicate_id" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "links_source_id_target_id_predicate_id_unique" UNIQUE("source_id","target_id","predicate_id")
);
--> statement-breakpoint
CREATE TABLE "predicates" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"type" "predicate_type" NOT NULL,
	"role" text,
	"inverse_slug" text,
	"canonical" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "predicates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "records" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text,
	"type" "record_type" DEFAULT 'artifact' NOT NULL,
	"title" text,
	"sense" text,
	"abbreviation" text,
	"url" text,
	"avatar_url" text,
	"summary" text,
	"content" text,
	"notes" text,
	"media_caption" text,
	"rating" smallint DEFAULT 0 NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"is_curated" boolean DEFAULT false NOT NULL,
	"reminder_at" timestamp with time zone,
	"sources" "integration_type"[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"text_embedding" vector(768),
	CONSTRAINT "records_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "twitter_media" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "twitter_media_type" NOT NULL,
	"tweet_url" text NOT NULL,
	"media_url" text NOT NULL,
	"thumbnail_url" text,
	"tweet_id" text NOT NULL,
	"media_id" integer,
	"deleted_at" timestamp with time zone,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "twitter_media_media_url_unique" UNIQUE("media_url"),
	CONSTRAINT "twitter_media_thumbnail_url_unique" UNIQUE("thumbnail_url")
);
--> statement-breakpoint
CREATE TABLE "twitter_tweets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"text" text,
	"quoted_tweet_id" text,
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
	"id" text PRIMARY KEY NOT NULL,
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
ALTER TABLE "lightroom_images" ADD CONSTRAINT "lightroom_images_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightroom_images" ADD CONSTRAINT "lightroom_images_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lightroom_images" ADD CONSTRAINT "lightroom_images_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "airtable_attachments" ADD CONSTRAINT "airtable_attachments_extract_id_airtable_extracts_id_fk" FOREIGN KEY ("extract_id") REFERENCES "public"."airtable_extracts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "airtable_attachments" ADD CONSTRAINT "airtable_attachments_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "airtable_creators" ADD CONSTRAINT "airtable_creators_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "airtable_creators" ADD CONSTRAINT "airtable_creators_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "airtable_extract_connections" ADD CONSTRAINT "airtable_extract_connections_from_extract_fk" FOREIGN KEY ("from_extract_id") REFERENCES "public"."airtable_extracts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "airtable_extract_connections" ADD CONSTRAINT "airtable_extract_connections_to_extract_fk" FOREIGN KEY ("to_extract_id") REFERENCES "public"."airtable_extracts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "airtable_extract_creators" ADD CONSTRAINT "airtable_extract_creators_extract_id_airtable_extracts_id_fk" FOREIGN KEY ("extract_id") REFERENCES "public"."airtable_extracts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "airtable_extract_creators" ADD CONSTRAINT "airtable_extract_creators_creator_id_airtable_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."airtable_creators"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "airtable_extract_spaces" ADD CONSTRAINT "airtable_extract_spaces_extract_id_airtable_extracts_id_fk" FOREIGN KEY ("extract_id") REFERENCES "public"."airtable_extracts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "airtable_extract_spaces" ADD CONSTRAINT "airtable_extract_spaces_space_id_airtable_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."airtable_spaces"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "airtable_extracts" ADD CONSTRAINT "airtable_extracts_format_id_airtable_formats_id_fk" FOREIGN KEY ("format_id") REFERENCES "public"."airtable_formats"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "airtable_extracts" ADD CONSTRAINT "airtable_extracts_parent_id_airtable_extracts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."airtable_extracts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "airtable_extracts" ADD CONSTRAINT "airtable_extracts_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "airtable_extracts" ADD CONSTRAINT "airtable_extracts_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "airtable_formats" ADD CONSTRAINT "airtable_formats_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "airtable_formats" ADD CONSTRAINT "airtable_formats_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "airtable_spaces" ADD CONSTRAINT "airtable_spaces_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "airtable_spaces" ADD CONSTRAINT "airtable_spaces_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "browsing_history" ADD CONSTRAINT "browsing_history_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_entries" ADD CONSTRAINT "feed_entries_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_entries" ADD CONSTRAINT "feed_entries_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_entries" ADD CONSTRAINT "feed_entries_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feeds" ADD CONSTRAINT "feeds_owner_id_records_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_commit_changes" ADD CONSTRAINT "github_commit_changes_commit_id_github_commits_id_fk" FOREIGN KEY ("commit_id") REFERENCES "public"."github_commits"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "github_commits" ADD CONSTRAINT "github_commits_repository_id_github_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "github_commits" ADD CONSTRAINT "github_commits_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD CONSTRAINT "github_repositories_owner_id_github_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."github_users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD CONSTRAINT "github_repositories_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD CONSTRAINT "github_repositories_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "github_users" ADD CONSTRAINT "github_users_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_users" ADD CONSTRAINT "github_users_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_version_of_media_id_media_id_fk" FOREIGN KEY ("version_of_media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "raindrop_bookmark_tags" ADD CONSTRAINT "raindrop_bookmark_tags_bookmark_id_raindrop_bookmarks_id_fk" FOREIGN KEY ("bookmark_id") REFERENCES "public"."raindrop_bookmarks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "raindrop_bookmark_tags" ADD CONSTRAINT "raindrop_bookmark_tags_tag_id_raindrop_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."raindrop_tags"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "raindrop_bookmarks" ADD CONSTRAINT "raindrop_bookmarks_collection_id_raindrop_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."raindrop_collections"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "raindrop_bookmarks" ADD CONSTRAINT "raindrop_bookmarks_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raindrop_bookmarks" ADD CONSTRAINT "raindrop_bookmarks_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "raindrop_collections" ADD CONSTRAINT "raindrop_collections_parent_id_raindrop_collections_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."raindrop_collections"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "raindrop_collections" ADD CONSTRAINT "raindrop_collections_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raindrop_collections" ADD CONSTRAINT "raindrop_collections_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "raindrop_images" ADD CONSTRAINT "raindrop_images_bookmark_id_raindrop_bookmarks_id_fk" FOREIGN KEY ("bookmark_id") REFERENCES "public"."raindrop_bookmarks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "raindrop_images" ADD CONSTRAINT "raindrop_images_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "raindrop_tags" ADD CONSTRAINT "raindrop_tags_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "readwise_authors" ADD CONSTRAINT "readwise_authors_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "readwise_document_tags" ADD CONSTRAINT "readwise_document_tags_document_id_readwise_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."readwise_documents"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "readwise_document_tags" ADD CONSTRAINT "readwise_document_tags_tag_id_readwise_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."readwise_tags"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "readwise_documents" ADD CONSTRAINT "readwise_documents_author_id_readwise_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."readwise_authors"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "readwise_documents" ADD CONSTRAINT "readwise_documents_parent_id_readwise_documents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."readwise_documents"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "readwise_documents" ADD CONSTRAINT "readwise_documents_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readwise_documents" ADD CONSTRAINT "readwise_documents_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "readwise_tags" ADD CONSTRAINT "readwise_tags_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_source_id_records_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_target_id_records_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_predicate_id_predicates_id_fk" FOREIGN KEY ("predicate_id") REFERENCES "public"."predicates"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "predicates" ADD CONSTRAINT "predicates_inverse_slug_predicates_slug_fk" FOREIGN KEY ("inverse_slug") REFERENCES "public"."predicates"("slug") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "twitter_media" ADD CONSTRAINT "twitter_media_tweet_id_twitter_tweets_id_fk" FOREIGN KEY ("tweet_id") REFERENCES "public"."twitter_tweets"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "twitter_media" ADD CONSTRAINT "twitter_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "twitter_tweets" ADD CONSTRAINT "twitter_tweets_user_id_twitter_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."twitter_users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "twitter_tweets" ADD CONSTRAINT "twitter_tweets_quoted_tweet_id_twitter_tweets_id_fk" FOREIGN KEY ("quoted_tweet_id") REFERENCES "public"."twitter_tweets"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "twitter_tweets" ADD CONSTRAINT "twitter_tweets_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "twitter_tweets" ADD CONSTRAINT "twitter_tweets_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "twitter_users" ADD CONSTRAINT "twitter_users_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "twitter_users" ADD CONSTRAINT "twitter_users_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "lightroom_images_record_id_index" ON "lightroom_images" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "lightroom_images_media_id_index" ON "lightroom_images" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "lightroom_images_deleted_at_index" ON "lightroom_images" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "airtable_attachments_media_id_index" ON "airtable_attachments" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "airtable_attachments_deleted_at_index" ON "airtable_attachments" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "airtable_creators_record_id_index" ON "airtable_creators" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "airtable_creators_deleted_at_index" ON "airtable_creators" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "airtable_extracts_record_id_index" ON "airtable_extracts" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "airtable_extracts_deleted_at_index" ON "airtable_extracts" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "airtable_formats_record_id_index" ON "airtable_formats" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "airtable_formats_deleted_at_index" ON "airtable_formats" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "airtable_spaces_record_id_index" ON "airtable_spaces" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "airtable_spaces_deleted_at_index" ON "airtable_spaces" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "browsing_history_integration_run_id_index" ON "browsing_history" USING btree ("integration_run_id");--> statement-breakpoint
CREATE INDEX "browsing_history_view_time_index" ON "browsing_history" USING btree ("view_time");--> statement-breakpoint
CREATE INDEX "browsing_history_url_idx" ON "browsing_history" USING btree ("url");--> statement-breakpoint
CREATE INDEX "browsing_history_view_epoch_microseconds_index" ON "browsing_history" USING btree ("view_epoch_microseconds");--> statement-breakpoint
CREATE INDEX "browsing_history_hostname_index" ON "browsing_history" USING btree ("hostname");--> statement-breakpoint
CREATE INDEX "feed_entries_feed_id_index" ON "feed_entries" USING btree ("feed_id");--> statement-breakpoint
CREATE INDEX "feed_entries_record_id_index" ON "feed_entries" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "feed_entries_integration_run_id_index" ON "feed_entries" USING btree ("integration_run_id");--> statement-breakpoint
CREATE INDEX "feed_entries_url_index" ON "feed_entries" USING btree ("url");--> statement-breakpoint
CREATE INDEX "feeds_feed_url_index" ON "feeds" USING btree ("feed_url");--> statement-breakpoint
CREATE INDEX "feeds_site_url_index" ON "feeds" USING btree ("site_url");--> statement-breakpoint
CREATE INDEX "feeds_owner_id_index" ON "feeds" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "github_commit_changes_commit_id_index" ON "github_commit_changes" USING btree ("commit_id");--> statement-breakpoint
CREATE INDEX "github_commit_changes_filename_index" ON "github_commit_changes" USING btree ("filename");--> statement-breakpoint
CREATE INDEX "github_commits_repository_id_index" ON "github_commits" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "github_commits_sha_index" ON "github_commits" USING btree ("sha");--> statement-breakpoint
CREATE INDEX "github_repositories_owner_id_index" ON "github_repositories" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "github_repositories_node_id_index" ON "github_repositories" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "github_repositories_record_id_index" ON "github_repositories" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "github_repositories_deleted_at_index" ON "github_repositories" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "github_users_login_index" ON "github_users" USING btree ("login");--> statement-breakpoint
CREATE INDEX "github_users_record_id_index" ON "github_users" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "github_users_deleted_at_index" ON "github_users" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "media_record_id_index" ON "media" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "media_type_format_content_type_string_index" ON "media" USING btree ("type","format","content_type_string");--> statement-breakpoint
CREATE INDEX "media_url_index" ON "media" USING btree ("url");--> statement-breakpoint
CREATE INDEX "media_version_of_media_id_index" ON "media" USING btree ("version_of_media_id");--> statement-breakpoint
CREATE INDEX "integration_runs_integration_type_index" ON "integration_runs" USING btree ("integration_type");--> statement-breakpoint
CREATE INDEX "raindrop_bookmark_tags_bookmark_id_index" ON "raindrop_bookmark_tags" USING btree ("bookmark_id");--> statement-breakpoint
CREATE INDEX "raindrop_bookmark_tags_tag_id_index" ON "raindrop_bookmark_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "raindrop_bookmarks_created_at_index" ON "raindrop_bookmarks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "raindrop_bookmarks_record_id_index" ON "raindrop_bookmarks" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "raindrop_bookmarks_deleted_at_index" ON "raindrop_bookmarks" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "raindrop_collections_parent_id_index" ON "raindrop_collections" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "raindrop_collections_record_id_index" ON "raindrop_collections" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "raindrop_collections_deleted_at_index" ON "raindrop_collections" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "raindrop_images_bookmark_id_index" ON "raindrop_images" USING btree ("bookmark_id");--> statement-breakpoint
CREATE INDEX "raindrop_images_media_id_index" ON "raindrop_images" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "raindrop_images_deleted_at_index" ON "raindrop_images" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "raindrop_tags_tag_index" ON "raindrop_tags" USING btree ("tag");--> statement-breakpoint
CREATE INDEX "raindrop_tags_record_id_index" ON "raindrop_tags" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "raindrop_tags_deleted_at_index" ON "raindrop_tags" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "readwise_authors_name_index" ON "readwise_authors" USING btree ("name");--> statement-breakpoint
CREATE INDEX "readwise_authors_origin_index" ON "readwise_authors" USING btree ("origin");--> statement-breakpoint
CREATE INDEX "readwise_authors_deleted_at_index" ON "readwise_authors" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "readwise_document_tags_document_id_index" ON "readwise_document_tags" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "readwise_document_tags_tag_id_index" ON "readwise_document_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "readwise_documents_parent_id_index" ON "readwise_documents" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "readwise_documents_record_id_index" ON "readwise_documents" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "readwise_documents_author_id_index" ON "readwise_documents" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "readwise_documents_deleted_at_index" ON "readwise_documents" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "readwise_tags_deleted_at_index" ON "readwise_tags" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "links_source_id_predicate_id_index" ON "links" USING btree ("source_id","predicate_id");--> statement-breakpoint
CREATE INDEX "links_target_id_predicate_id_index" ON "links" USING btree ("target_id","predicate_id");--> statement-breakpoint
CREATE INDEX "links_source_id_index" ON "links" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "links_target_id_index" ON "links" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "links_predicate_id_index" ON "links" USING btree ("predicate_id");--> statement-breakpoint
CREATE INDEX "predicates_id_type_index" ON "predicates" USING btree ("id","type");--> statement-breakpoint
CREATE INDEX "predicates_slug_index" ON "predicates" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "predicates_type_index" ON "predicates" USING btree ("type");--> statement-breakpoint
CREATE INDEX "predicates_role_index" ON "predicates" USING btree ("role");--> statement-breakpoint
CREATE INDEX "predicates_canonical_index" ON "predicates" USING btree ("canonical");--> statement-breakpoint
CREATE INDEX "predicates_inverse_slug_index" ON "predicates" USING btree ("inverse_slug");--> statement-breakpoint
CREATE INDEX "predicates_type_canonical_index" ON "predicates" USING btree ("type","canonical");--> statement-breakpoint
CREATE INDEX "records_type_title_url_index" ON "records" USING btree ("type","title","url");--> statement-breakpoint
CREATE INDEX "records_slug_index" ON "records" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_records_content_search" ON "records" USING gin ("title" gin_trgm_ops,"abbreviation" gin_trgm_ops,"sense" gin_trgm_ops,"url" gin_trgm_ops,"summary" gin_trgm_ops,"content" gin_trgm_ops,"notes" gin_trgm_ops,"media_caption" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_records_sources" ON "records" USING gin ("sources");--> statement-breakpoint
CREATE INDEX "records_created_at_index" ON "records" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "records_updated_at_index" ON "records" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "records_rating_index" ON "records" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "records_is_private_index" ON "records" USING btree ("is_private");--> statement-breakpoint
CREATE INDEX "records_is_curated_index" ON "records" USING btree ("is_curated");--> statement-breakpoint
CREATE INDEX "records_text_embedding_index" ON "records" USING hnsw ("text_embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "twitter_media_media_id_index" ON "twitter_media" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "twitter_tweets_integration_run_id_index" ON "twitter_tweets" USING btree ("integration_run_id");--> statement-breakpoint
CREATE INDEX "twitter_tweets_record_id_index" ON "twitter_tweets" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "twitter_tweets_deleted_at_index" ON "twitter_tweets" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "twitter_users_record_id_index" ON "twitter_users" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "twitter_users_deleted_at_index" ON "twitter_users" USING btree ("deleted_at");