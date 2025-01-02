CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA "operations";
--> statement-breakpoint
CREATE SCHEMA "integrations";
--> statement-breakpoint
CREATE TYPE "public"."categorization_type" AS ENUM('about', 'file_under');--> statement-breakpoint
CREATE TYPE "public"."creator_role_type" AS ENUM('creator', 'author', 'editor', 'contributor', 'via', 'participant', 'interviewer', 'interviewee', 'subject', 'mentioned');--> statement-breakpoint
CREATE TYPE "public"."flag" AS ENUM('important', 'favorite', 'draft', 'follow_up', 'review', 'outdated');--> statement-breakpoint
CREATE TYPE "public"."index_main_type" AS ENUM('entity', 'category ', 'format');--> statement-breakpoint
CREATE TYPE "public"."index_relation_type" AS ENUM('related_to', 'opposite_of', 'part_of');--> statement-breakpoint
CREATE TYPE "public"."media_format" AS ENUM('image', 'video', 'audio', 'text', 'application', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."record_relation_type" AS ENUM('primary_source', 'quoted_from', 'copied_from', 'derived_from', 'part_of', 'references', 'similar_to', 'responds_to', 'contradicts', 'supports');--> statement-breakpoint
CREATE TYPE "public"."record_type" AS ENUM('resource', 'bookmark', 'object', 'document', 'abstraction', 'extracted', 'event');--> statement-breakpoint
CREATE TYPE "public"."timepoint_type" AS ENUM('instant', 'minute', 'hour', 'day', 'week', 'month', 'quarter', 'year', 'decade', 'century');--> statement-breakpoint
CREATE TYPE "operations"."integration_status" AS ENUM('success', 'fail', 'in_progress');--> statement-breakpoint
CREATE TYPE "operations"."integration_type" AS ENUM('ai_chat', 'airtable', 'browser_history', 'crawler', 'github', 'lightroom', 'manual', 'raindrop', 'readwise', 'twitter');--> statement-breakpoint
CREATE TYPE "operations"."run_type" AS ENUM('seed', 'sync');--> statement-breakpoint
CREATE TYPE "integrations"."browser" AS ENUM('arc', 'chrome', 'firefox', 'safari', 'edge');--> statement-breakpoint
CREATE TYPE "integrations"."github_commit_change_status" AS ENUM('added', 'modified', 'removed', 'renamed', 'copied', 'changed', 'unchanged');--> statement-breakpoint
CREATE TYPE "integrations"."github_commit_types" AS ENUM('feature', 'enhancement', 'bugfix', 'refactor', 'documentation', 'style', 'chore', 'test', 'build');--> statement-breakpoint
CREATE TYPE "integrations"."readwise_category" AS ENUM('article', 'email', 'rss', 'highlight', 'note', 'pdf', 'epub', 'tweet', 'video');--> statement-breakpoint
CREATE TYPE "integrations"."readwise_location" AS ENUM('new', 'later', 'shortlist', 'archive', 'feed');--> statement-breakpoint
CREATE TABLE "index_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"short_name" text,
	"sense" text,
	"notes" text,
	"private" boolean DEFAULT false NOT NULL,
	"main_type" "index_main_type" NOT NULL,
	"sub_type" text,
	"canonical_page_id" integer,
	"canonical_media_id" integer,
	"alias_of" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "index_entry_idx" UNIQUE("name","sense","main_type")
);
--> statement-breakpoint
CREATE TABLE "index_relations" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"target_id" integer NOT NULL,
	"type" "index_relation_type" DEFAULT 'related_to' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "index_relation_unique_idx" UNIQUE("source_id","target_id","type")
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"location_type" text DEFAULT 'Place' NOT NULL,
	"description" text,
	"coordinates" geometry(point) NOT NULL,
	"bounding_box" geometry(MultiPolygon, 4326),
	"source_platform" text,
	"source_data" json,
	"map_page_id" integer,
	"map_image_id" integer,
	"address" text,
	"timezone" text,
	"population" integer,
	"elevation" integer,
	"parent_location_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "location_name_type_parent_idx" UNIQUE("name","location_type","parent_location_id")
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"format" "media_format" NOT NULL,
	"mime_type" text NOT NULL,
	"title" text,
	"alt_text" text,
	"file_size" integer,
	"width" integer,
	"height" integer,
	"version_of_media_id" integer,
	"source_page_id" integer,
	"metadata" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_url_idx" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "record_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"record_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"type" "categorization_type" NOT NULL,
	"primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "record_category_unique_idx" UNIQUE("record_id","category_id","type")
);
--> statement-breakpoint
CREATE TABLE "record_creators" (
	"id" serial PRIMARY KEY NOT NULL,
	"record_id" integer NOT NULL,
	"entity_id" integer NOT NULL,
	"role" "creator_role_type" NOT NULL,
	"order" text DEFAULT 'a0' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "record_creator_unique_idx" UNIQUE("record_id","entity_id","role")
);
--> statement-breakpoint
CREATE TABLE "record_media" (
	"id" serial PRIMARY KEY NOT NULL,
	"record_id" integer NOT NULL,
	"media_id" integer NOT NULL,
	"caption" text,
	"order" text DEFAULT 'a0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "record_media_unique_idx" UNIQUE("record_id","media_id")
);
--> statement-breakpoint
CREATE TABLE "record_relations" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"target_id" integer NOT NULL,
	"type" "record_relation_type" NOT NULL,
	"order" text DEFAULT 'a0' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "record_relation_unique_idx" UNIQUE("source_id","target_id","type")
);
--> statement-breakpoint
CREATE TABLE "record_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"record_id" integer NOT NULL,
	"source_id" integer NOT NULL,
	"order" text DEFAULT 'a0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "record_source_unique_idx" UNIQUE("record_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "record_timepoints" (
	"id" serial PRIMARY KEY NOT NULL,
	"record_id" integer NOT NULL,
	"timepoint_id" integer NOT NULL,
	"label" text,
	"order" text DEFAULT 'a0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "records" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text,
	"content" text,
	"type" "record_type" NOT NULL,
	"format_id" integer,
	"private" boolean DEFAULT false NOT NULL,
	"flags" "flag"[],
	"needs_curation" boolean DEFAULT true NOT NULL,
	"location_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_source_id" integer NOT NULL,
	"to_source_id" integer NOT NULL,
	"metadata" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_connection_unique_idx" UNIQUE("from_source_id","to_source_id")
);
--> statement-breakpoint
CREATE TABLE "source_contents" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"content_html" text NOT NULL,
	"content_markdown" text,
	"metadata" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"domain" text GENERATED ALWAYS AS (LOWER(regexp_replace("sources"."url", '^https?://([^/]+).*$', '\1'))) STORED,
	"title" text,
	"origin" "operations"."integration_type" DEFAULT 'manual' NOT NULL,
	"should_crawl" boolean DEFAULT true NOT NULL,
	"last_crawl_date" timestamp with time zone,
	"last_successful_crawl_date" timestamp with time zone,
	"last_http_status" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_url_idx" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "timepoints" (
	"id" serial PRIMARY KEY NOT NULL,
	"start_date" date NOT NULL,
	"start_time" time,
	"start_instant" timestamp with time zone NOT NULL,
	"start_granularity" timepoint_type NOT NULL,
	"end_date" date,
	"end_time" time,
	"end_instant" timestamp with time zone,
	"end_granularity" timepoint_type,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operations"."integration_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"integration_type" "operations"."integration_type" NOT NULL,
	"run_type" "operations"."run_type" DEFAULT 'sync' NOT NULL,
	"status" "operations"."integration_status" DEFAULT 'in_progress' NOT NULL,
	"message" text,
	"run_start_time" timestamp with time zone NOT NULL,
	"run_end_time" timestamp with time zone,
	"entries_created" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations"."adobe_lightroom_images" (
	"id" text PRIMARY KEY NOT NULL,
	"url_2048" text NOT NULL,
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
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations"."airtable_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"filename" text NOT NULL,
	"size" integer,
	"type" text,
	"width" integer,
	"height" integer,
	"extract_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations"."airtable_creators" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'Individual' NOT NULL,
	"primary_project" text,
	"website" text,
	"professions" text[],
	"organizations" text[],
	"nationalities" text[],
	"integration_run_id" integer NOT NULL,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations"."airtable_extract_connections" (
	"from_extract_id" text NOT NULL,
	"to_extract_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "airtable_extract_connections_from_extract_id_to_extract_id_pk" PRIMARY KEY("from_extract_id","to_extract_id")
);
--> statement-breakpoint
CREATE TABLE "integrations"."airtable_extract_creators" (
	"extract_id" text NOT NULL,
	"creator_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "airtable_extract_creators_extract_id_creator_id_pk" PRIMARY KEY("extract_id","creator_id")
);
--> statement-breakpoint
CREATE TABLE "integrations"."airtable_extract_spaces" (
	"extract_id" text NOT NULL,
	"space_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "airtable_extract_spaces_extract_id_space_id_pk" PRIMARY KEY("extract_id","space_id")
);
--> statement-breakpoint
CREATE TABLE "integrations"."airtable_extracts" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"format" text DEFAULT 'Fragment' NOT NULL,
	"source" text,
	"michelin_stars" integer,
	"content" text,
	"notes" text,
	"attachment_caption" text,
	"parent_id" text,
	"lexicographical_order" text DEFAULT 'a0' NOT NULL,
	"integration_run_id" integer NOT NULL,
	"published_at" timestamp with time zone,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations"."airtable_spaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"full_name" text,
	"icon" text,
	"description" text,
	"integration_run_id" integer NOT NULL,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations"."arc_browsing_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"view_time" timestamp with time zone NOT NULL,
	"browser" "integrations"."browser" DEFAULT 'arc' NOT NULL,
	"hostname" text,
	"view_epoch_microseconds" bigint,
	"view_duration" integer,
	"duration_since_last_view" integer,
	"url" text NOT NULL,
	"page_title" text,
	"search_terms" text,
	"related_searches" text,
	"integration_run_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations"."arc_browsing_history_omit_list" (
	"pattern" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations"."github_commit_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"status" "integrations"."github_commit_change_status" NOT NULL,
	"patch" text NOT NULL,
	"commit_id" text NOT NULL,
	"changes" integer,
	"additions" integer,
	"deletions" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations"."github_commits" (
	"node_id" text PRIMARY KEY NOT NULL,
	"sha" text NOT NULL,
	"message" text NOT NULL,
	"repository_id" integer NOT NULL,
	"html_url" text NOT NULL,
	"commit_type" "integrations"."github_commit_types",
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
CREATE TABLE "integrations"."github_repositories" (
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
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "github_repositories_node_id_unique" UNIQUE("node_id")
);
--> statement-breakpoint
CREATE TABLE "integrations"."github_users" (
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
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "github_users_node_id_unique" UNIQUE("node_id")
);
--> statement-breakpoint
CREATE TABLE "integrations"."raindrop_collections" (
	"id" integer PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"parent_id" integer,
	"color_hex" text,
	"cover_url" text,
	"raindrop_count" integer,
	"integration_run_id" integer NOT NULL,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations"."raindrop_raindrops" (
	"id" integer PRIMARY KEY NOT NULL,
	"link_url" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text,
	"note" text,
	"type" text,
	"cover_image_url" text,
	"tags" text[],
	"important" boolean DEFAULT false NOT NULL,
	"domain" text,
	"collection_id" integer,
	"integration_run_id" integer NOT NULL,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "raindrop_raindrops_link_url_created_at_unique" UNIQUE("link_url","created_at")
);
--> statement-breakpoint
CREATE TABLE "integrations"."readwise_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text,
	"source_url" text,
	"title" text,
	"author" text,
	"source" text,
	"content" text,
	"category" "integrations"."readwise_category",
	"location" "integrations"."readwise_location",
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
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations"."twitter_media" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text,
	"url" text,
	"media_url" text,
	"tweet_id" text NOT NULL,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations"."twitter_tweets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"text" text,
	"quoted_tweet_id" text,
	"integration_run_id" integer NOT NULL,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations"."twitter_users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text,
	"display_name" text,
	"description" text,
	"location" text,
	"url" text,
	"external_url" text,
	"profile_image_url" text,
	"profile_banner_url" text,
	"integration_run_id" integer NOT NULL,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "index_entries" ADD CONSTRAINT "index_entries_canonical_page_id_sources_id_fk" FOREIGN KEY ("canonical_page_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "index_entries" ADD CONSTRAINT "index_entries_canonical_media_id_media_id_fk" FOREIGN KEY ("canonical_media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "index_entries" ADD CONSTRAINT "index_entries_alias_of_index_entries_id_fk" FOREIGN KEY ("alias_of") REFERENCES "public"."index_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "index_relations" ADD CONSTRAINT "index_relations_source_id_index_entries_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."index_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "index_relations" ADD CONSTRAINT "index_relations_target_id_index_entries_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."index_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_map_page_id_sources_id_fk" FOREIGN KEY ("map_page_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_map_image_id_media_id_fk" FOREIGN KEY ("map_image_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_location_id_locations_id_fk" FOREIGN KEY ("parent_location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_source_page_id_sources_id_fk" FOREIGN KEY ("source_page_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_version_of_media_id_media_id_fk" FOREIGN KEY ("version_of_media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_categories" ADD CONSTRAINT "record_categories_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_categories" ADD CONSTRAINT "record_categories_category_id_index_entries_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."index_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_creators" ADD CONSTRAINT "record_creators_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_creators" ADD CONSTRAINT "record_creators_entity_id_index_entries_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."index_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_media" ADD CONSTRAINT "record_media_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_media" ADD CONSTRAINT "record_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_relations" ADD CONSTRAINT "record_relations_source_id_records_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_relations" ADD CONSTRAINT "record_relations_target_id_records_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_sources" ADD CONSTRAINT "record_sources_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_sources" ADD CONSTRAINT "record_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_timepoints" ADD CONSTRAINT "record_timepoints_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_timepoints" ADD CONSTRAINT "record_timepoints_timepoint_id_timepoints_id_fk" FOREIGN KEY ("timepoint_id") REFERENCES "public"."timepoints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_format_id_index_entries_id_fk" FOREIGN KEY ("format_id") REFERENCES "public"."index_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_connections" ADD CONSTRAINT "source_connections_from_source_id_sources_id_fk" FOREIGN KEY ("from_source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_connections" ADD CONSTRAINT "source_connections_to_source_id_sources_id_fk" FOREIGN KEY ("to_source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_contents" ADD CONSTRAINT "source_contents_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."adobe_lightroom_images" ADD CONSTRAINT "adobe_lightroom_images_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "operations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."airtable_attachments" ADD CONSTRAINT "airtable_attachments_extract_id_airtable_extracts_id_fk" FOREIGN KEY ("extract_id") REFERENCES "integrations"."airtable_extracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."airtable_creators" ADD CONSTRAINT "airtable_creators_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "operations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_connections" ADD CONSTRAINT "airtable_extract_connections_from_extract_id_airtable_extracts_id_fk" FOREIGN KEY ("from_extract_id") REFERENCES "integrations"."airtable_extracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_connections" ADD CONSTRAINT "airtable_extract_connections_to_extract_id_airtable_extracts_id_fk" FOREIGN KEY ("to_extract_id") REFERENCES "integrations"."airtable_extracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_creators" ADD CONSTRAINT "airtable_extract_creators_extract_id_airtable_extracts_id_fk" FOREIGN KEY ("extract_id") REFERENCES "integrations"."airtable_extracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_creators" ADD CONSTRAINT "airtable_extract_creators_creator_id_airtable_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "integrations"."airtable_creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_spaces" ADD CONSTRAINT "airtable_extract_spaces_extract_id_airtable_extracts_id_fk" FOREIGN KEY ("extract_id") REFERENCES "integrations"."airtable_extracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_spaces" ADD CONSTRAINT "airtable_extract_spaces_space_id_airtable_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "integrations"."airtable_spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extracts" ADD CONSTRAINT "airtable_extracts_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "operations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extracts" ADD CONSTRAINT "airtable_extracts_parent_id_airtable_extracts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "integrations"."airtable_extracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."airtable_spaces" ADD CONSTRAINT "airtable_spaces_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "operations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."arc_browsing_history" ADD CONSTRAINT "arc_browsing_history_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "operations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."github_commit_changes" ADD CONSTRAINT "github_commit_changes_commit_id_github_commits_node_id_fk" FOREIGN KEY ("commit_id") REFERENCES "integrations"."github_commits"("node_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."github_commits" ADD CONSTRAINT "github_commits_repository_id_github_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "integrations"."github_repositories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."github_commits" ADD CONSTRAINT "github_commits_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "operations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."github_repositories" ADD CONSTRAINT "github_repositories_owner_id_github_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "integrations"."github_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."github_repositories" ADD CONSTRAINT "github_repositories_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "operations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."github_users" ADD CONSTRAINT "github_users_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "operations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_collections" ADD CONSTRAINT "raindrop_collections_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "operations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_collections" ADD CONSTRAINT "raindrop_collections_parent_id_raindrop_collections_id_fk" FOREIGN KEY ("parent_id") REFERENCES "integrations"."raindrop_collections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_raindrops" ADD CONSTRAINT "raindrop_raindrops_collection_id_raindrop_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "integrations"."raindrop_collections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_raindrops" ADD CONSTRAINT "raindrop_raindrops_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "operations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."readwise_documents" ADD CONSTRAINT "readwise_documents_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "operations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."readwise_documents" ADD CONSTRAINT "readwise_documents_parent_id_readwise_documents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "integrations"."readwise_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."twitter_media" ADD CONSTRAINT "twitter_media_tweet_id_twitter_tweets_id_fk" FOREIGN KEY ("tweet_id") REFERENCES "integrations"."twitter_tweets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."twitter_tweets" ADD CONSTRAINT "twitter_tweets_user_id_twitter_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "integrations"."twitter_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."twitter_tweets" ADD CONSTRAINT "twitter_tweets_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "operations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."twitter_tweets" ADD CONSTRAINT "twitter_tweets_quoted_tweet_id_twitter_tweets_id_fk" FOREIGN KEY ("quoted_tweet_id") REFERENCES "integrations"."twitter_tweets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations"."twitter_users" ADD CONSTRAINT "twitter_users_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "operations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "type_subtype_idx" ON "index_entries" USING btree ("main_type","sub_type");--> statement-breakpoint
CREATE INDEX "canonical_page_idx" ON "index_entries" USING btree ("canonical_page_id");--> statement-breakpoint
CREATE INDEX "canonical_media_idx" ON "index_entries" USING btree ("canonical_media_id");--> statement-breakpoint
CREATE INDEX "location_map_page_idx" ON "locations" USING btree ("map_page_id");--> statement-breakpoint
CREATE INDEX "location_map_image_idx" ON "locations" USING btree ("map_image_id");--> statement-breakpoint
CREATE INDEX "location_coordinates_idx" ON "locations" USING gist ("coordinates");--> statement-breakpoint
CREATE INDEX "location_bounding_box_idx" ON "locations" USING gist ("bounding_box");--> statement-breakpoint
CREATE INDEX "location_type_idx" ON "locations" USING btree ("location_type");--> statement-breakpoint
CREATE INDEX "location_parent_idx" ON "locations" USING btree ("parent_location_id");--> statement-breakpoint
CREATE INDEX "media_format_idx" ON "media" USING btree ("format");--> statement-breakpoint
CREATE INDEX "media_mime_type_idx" ON "media" USING btree ("mime_type");--> statement-breakpoint
CREATE INDEX "media_source_idx" ON "media" USING btree ("source_page_id");--> statement-breakpoint
CREATE INDEX "media_version_idx" ON "media" USING btree ("version_of_media_id");--> statement-breakpoint
CREATE INDEX "record_category_record_idx" ON "record_categories" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "record_category_category_idx" ON "record_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "record_creator_record_idx" ON "record_creators" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "record_creator_entity_idx" ON "record_creators" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "record_media_record_idx" ON "record_media" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "record_media_media_idx" ON "record_media" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "record_relation_source_idx" ON "record_relations" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "record_relation_target_idx" ON "record_relations" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "record_source_record_idx" ON "record_sources" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "record_source_source_idx" ON "record_sources" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "record_timepoint_record_idx" ON "record_timepoints" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "record_timepoint_timepoint_idx" ON "record_timepoints" USING btree ("timepoint_id");--> statement-breakpoint
CREATE INDEX "record_type_idx" ON "records" USING btree ("type");--> statement-breakpoint
CREATE INDEX "record_format_idx" ON "records" USING btree ("format_id");--> statement-breakpoint
CREATE INDEX "record_location_idx" ON "records" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "source_connection_source_idx" ON "source_connections" USING btree ("from_source_id");--> statement-breakpoint
CREATE INDEX "source_connection_target_idx" ON "source_connections" USING btree ("to_source_id");--> statement-breakpoint
CREATE INDEX "source_content_source_idx" ON "source_contents" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "source_domain_idx" ON "sources" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "crawl_status_idx" ON "sources" USING btree ("last_crawl_date","last_http_status");--> statement-breakpoint
CREATE INDEX "timepoint_start_date_idx" ON "timepoints" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "timepoint_start_instant_idx" ON "timepoints" USING btree ("start_instant");--> statement-breakpoint
CREATE INDEX "timepoint_start_granularity_idx" ON "timepoints" USING btree ("start_granularity");--> statement-breakpoint
CREATE INDEX "timepoint_end_date_idx" ON "timepoints" USING btree ("end_date");--> statement-breakpoint
CREATE INDEX "timepoint_end_instant_idx" ON "timepoints" USING btree ("end_instant");--> statement-breakpoint
CREATE INDEX "timepoint_end_granularity_idx" ON "timepoints" USING btree ("end_granularity");--> statement-breakpoint
CREATE INDEX "integration_runs_integration_type_index" ON "operations"."integration_runs" USING btree ("integration_type");--> statement-breakpoint
CREATE INDEX "adobe_lightroom_images_integration_run_id_index" ON "integrations"."adobe_lightroom_images" USING btree ("integration_run_id");--> statement-breakpoint
CREATE INDEX "adobe_lightroom_images_capture_date_index" ON "integrations"."adobe_lightroom_images" USING btree ("capture_date");--> statement-breakpoint
CREATE INDEX "arc_browsing_history_integration_run_id_index" ON "integrations"."arc_browsing_history" USING btree ("integration_run_id");--> statement-breakpoint
CREATE INDEX "arc_browsing_history_view_time_index" ON "integrations"."arc_browsing_history" USING btree ("view_time");--> statement-breakpoint
CREATE INDEX "arc_browsing_history_url_idx" ON "integrations"."arc_browsing_history" USING btree ("url");--> statement-breakpoint
CREATE INDEX "arc_browsing_history_view_epoch_microseconds_index" ON "integrations"."arc_browsing_history" USING btree ("view_epoch_microseconds");--> statement-breakpoint
CREATE INDEX "arc_browsing_history_hostname_index" ON "integrations"."arc_browsing_history" USING btree ("hostname");--> statement-breakpoint
CREATE INDEX "github_commit_changes_commit_id_index" ON "integrations"."github_commit_changes" USING btree ("commit_id");--> statement-breakpoint
CREATE INDEX "github_commit_changes_filename_index" ON "integrations"."github_commit_changes" USING btree ("filename");--> statement-breakpoint
CREATE INDEX "github_commits_repository_id_index" ON "integrations"."github_commits" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "github_commits_sha_index" ON "integrations"."github_commits" USING btree ("sha");--> statement-breakpoint
CREATE INDEX "github_repositories_owner_id_index" ON "integrations"."github_repositories" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "github_repositories_node_id_index" ON "integrations"."github_repositories" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "github_users_login_index" ON "integrations"."github_users" USING btree ("login");--> statement-breakpoint
CREATE INDEX "raindrop_collections_parent_id_index" ON "integrations"."raindrop_collections" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "raindrop_raindrops_integration_run_id_index" ON "integrations"."raindrop_raindrops" USING btree ("integration_run_id");--> statement-breakpoint
CREATE INDEX "raindrop_raindrops_link_url_index" ON "integrations"."raindrop_raindrops" USING btree ("link_url");--> statement-breakpoint
CREATE INDEX "raindrop_raindrops_created_at_index" ON "integrations"."raindrop_raindrops" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "readwise_documents_integration_run_id_index" ON "integrations"."readwise_documents" USING btree ("integration_run_id");--> statement-breakpoint
CREATE INDEX "readwise_documents_url_index" ON "integrations"."readwise_documents" USING btree ("url");--> statement-breakpoint
CREATE INDEX "readwise_documents_created_at_index" ON "integrations"."readwise_documents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "readwise_documents_parent_id_index" ON "integrations"."readwise_documents" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "twitter_tweets_integration_run_id_index" ON "integrations"."twitter_tweets" USING btree ("integration_run_id");--> statement-breakpoint
CREATE MATERIALIZED VIEW "integrations"."arc_browsing_history_daily" AS (select DATE("view_time" AT TIME ZONE CURRENT_SETTING('timezone')) as "date", "url" as "url", "page_title" as "page_title", "hostname" as "hostname", SUM(COALESCE("view_duration", 0)) as "total_duration", MIN("view_time") as "first_visit", MAX("view_time") as "last_visit", COUNT(*) as "visit_count" from "integrations"."arc_browsing_history" group by DATE("integrations"."arc_browsing_history"."view_time" AT TIME ZONE CURRENT_SETTING('timezone')), "integrations"."arc_browsing_history"."url", "integrations"."arc_browsing_history"."page_title", "integrations"."arc_browsing_history"."hostname");