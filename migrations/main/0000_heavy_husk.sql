-------------------------------
-- 1. SCHEMA and EXTENSIONS
-------------------------------
CREATE SCHEMA IF NOT EXISTS "extensions";

CREATE EXTENSION IF NOT EXISTS "vector" SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_trgm" SCHEMA "extensions";

ALTER DATABASE "redcliffrecord" SET search_path = public, extensions;

-----------------------------------
-- 2. TYPES (wrapped in DO blocks)
-----------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON t.typnamespace = n.oid
     WHERE t.typname = 'index_main_type'
       AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."index_main_type" AS ENUM('entity', 'category', 'format');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON t.typnamespace = n.oid
     WHERE t.typname = 'index_relation_type'
       AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."index_relation_type" AS ENUM('related_to', 'opposite_of', 'part_of');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON t.typnamespace = n.oid
     WHERE t.typname = 'media_type'
       AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."media_type" AS ENUM('application', 'audio', 'font', 'image', 'message', 'model', 'multipart', 'text', 'video');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON t.typnamespace = n.oid
     WHERE t.typname = 'categorization_type'
       AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."categorization_type" AS ENUM('about', 'file_under');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON t.typnamespace = n.oid
     WHERE t.typname = 'creator_role_type'
       AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."creator_role_type" AS ENUM(
      'creator', 'author', 'editor', 'contributor', 'via',
      'participant', 'interviewer', 'interviewee', 'subject', 'mentioned'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON t.typnamespace = n.oid
     WHERE t.typname = 'flag'
       AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."flag" AS ENUM('important', 'favorite', 'draft', 'follow_up', 'review', 'outdated');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON t.typnamespace = n.oid
     WHERE t.typname = 'record_relation_type'
       AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."record_relation_type" AS ENUM(
      'primary_source', 'quoted_from', 'copied_from', 'derived_from',
      'part_of', 'references', 'similar_to', 'responds_to', 'contradicts', 'supports'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON t.typnamespace = n.oid
     WHERE t.typname = 'record_type'
       AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."record_type" AS ENUM(
      'resource', 'bookmark', 'object', 'document', 'abstraction', 'extracted', 'event'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON t.typnamespace = n.oid
     WHERE t.typname = 'timepoint_type'
       AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."timepoint_type" AS ENUM(
      'instant', 'minute', 'hour', 'day', 'week', 'month', 'quarter', 'year', 'decade', 'century'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON t.typnamespace = n.oid
     WHERE t.typname = 'browser'
       AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."browser" AS ENUM('arc', 'chrome', 'firefox', 'safari', 'edge');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON t.typnamespace = n.oid
     WHERE t.typname = 'github_commit_change_status'
       AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."github_commit_change_status" AS ENUM('added', 'modified', 'removed', 'renamed', 'copied', 'changed', 'unchanged');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON t.typnamespace = n.oid
     WHERE t.typname = 'github_commit_types'
       AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."github_commit_types" AS ENUM('feature', 'enhancement', 'bugfix', 'refactor', 'documentation', 'style', 'chore', 'test', 'build');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON t.typnamespace = n.oid
     WHERE t.typname = 'readwise_category'
       AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."readwise_category" AS ENUM('article', 'email', 'rss', 'highlight', 'note', 'pdf', 'epub', 'tweet', 'video');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON t.typnamespace = n.oid
     WHERE t.typname = 'readwise_location'
       AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."readwise_location" AS ENUM('new', 'later', 'shortlist', 'archive', 'feed');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON t.typnamespace = n.oid
     WHERE t.typname = 'twitter_media_type'
       AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."twitter_media_type" AS ENUM('photo', 'video', 'animated_gif');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON t.typnamespace = n.oid
     WHERE t.typname = 'integration_status'
       AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."integration_status" AS ENUM('success', 'fail', 'in_progress');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON t.typnamespace = n.oid
     WHERE t.typname = 'integration_type'
       AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."integration_type" AS ENUM(
      'ai_chat', 'airtable', 'browser_history', 'crawler', 'embeddings',
      'github', 'lightroom', 'manual', 'raindrop', 'readwise', 'twitter'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON t.typnamespace = n.oid
     WHERE t.typname = 'run_type'
       AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."run_type" AS ENUM('seed', 'sync');
  END IF;
END $$;

--------------------------------
-- 3. TABLES (use IF NOT EXISTS)
--------------------------------
CREATE TABLE IF NOT EXISTS "index_relations" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"target_id" integer NOT NULL,
	"type" "index_relation_type" DEFAULT 'related_to' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "index_relations_source_id_target_id_type_unique" UNIQUE("source_id","target_id","type")
);

CREATE TABLE IF NOT EXISTS "indices" (
	"id" serial PRIMARY KEY NOT NULL,
	"main_type" "index_main_type" NOT NULL,
	"sub_type" text,
	"name" text NOT NULL,
	"short_name" text,
	"sense" text,
	"notes" text,
	"canonical_page_id" integer,
	"canonical_url" text,
	"canonical_media_id" integer,
	"canonical_media_url" text,
	"alias_of" integer,
	"private" boolean DEFAULT false NOT NULL,
	"embedding" vector(768),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "indices_name_sense_main_type_unique" UNIQUE("name","sense","main_type")
);

CREATE TABLE IF NOT EXISTS "locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"location_type" text DEFAULT 'Place' NOT NULL,
	"description" text,
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
	CONSTRAINT "locations_name_location_type_parent_location_id_unique" UNIQUE("name","location_type","parent_location_id")
);

CREATE TABLE IF NOT EXISTS "media" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"type" "media_type" DEFAULT 'application' NOT NULL,
	"format" text DEFAULT 'octet-stream' NOT NULL,
	"content_type_string" text DEFAULT 'application/octet-stream' NOT NULL,
	"title" text,
	"alt_text" text,
	"file_size" integer,
	"width" integer,
	"height" integer,
	"version_of_media_id" integer,
	"source_page_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_url_unique" UNIQUE("url")
);

CREATE TABLE IF NOT EXISTS "record_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"record_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"type" "categorization_type" NOT NULL,
	"primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "record_categories_record_id_category_id_type_unique" UNIQUE("record_id","category_id","type")
);

CREATE TABLE IF NOT EXISTS "record_creators" (
	"id" serial PRIMARY KEY NOT NULL,
	"record_id" integer NOT NULL,
	"entity_id" integer NOT NULL,
	"role" "creator_role_type" NOT NULL,
	"order" text DEFAULT 'a0' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "record_creators_record_id_entity_id_role_unique" UNIQUE("record_id","entity_id","role")
);

CREATE TABLE IF NOT EXISTS "record_media" (
	"id" serial PRIMARY KEY NOT NULL,
	"record_id" integer NOT NULL,
	"media_id" integer NOT NULL,
	"caption" text,
	"order" text DEFAULT 'a0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "record_media_record_id_media_id_unique" UNIQUE("record_id","media_id")
);

CREATE TABLE IF NOT EXISTS "record_relations" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"target_id" integer NOT NULL,
	"type" "record_relation_type" NOT NULL,
	"order" text DEFAULT 'a0' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "record_relations_source_id_target_id_type_unique" UNIQUE("source_id","target_id","type")
);

CREATE TABLE IF NOT EXISTS "record_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"record_id" integer NOT NULL,
	"source_id" integer NOT NULL,
	"order" text DEFAULT 'a0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "record_sources_record_id_source_id_unique" UNIQUE("record_id","source_id")
);

CREATE TABLE IF NOT EXISTS "records" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text,
	"content" text,
	"type" "record_type" NOT NULL,
	"format_id" integer,
	"private" boolean DEFAULT false NOT NULL,
	"flags" "flag"[],
	"needs_curation" boolean DEFAULT true NOT NULL,
	"location_id" integer,
	"url" text,
	"embedding" vector(768),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "source_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_source_id" integer NOT NULL,
	"to_source_id" integer NOT NULL,
	"metadata" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_connections_from_source_id_to_source_id_unique" UNIQUE("from_source_id","to_source_id")
);

CREATE TABLE IF NOT EXISTS "source_contents" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"content_html" text NOT NULL,
	"content_markdown" text,
	"metadata" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"domain" text GENERATED ALWAYS AS (LOWER(regexp_replace("sources"."url", '^https?://([^/]+).*$', '\1'))) STORED,
	"title" text,
	"origin" "integration_type" DEFAULT 'manual' NOT NULL,
	"should_crawl" boolean DEFAULT true NOT NULL,
	"last_crawl_date" timestamp with time zone,
	"last_successful_crawl_date" timestamp with time zone,
	"last_http_status" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_url_unique" UNIQUE("url")
);

CREATE TABLE IF NOT EXISTS "record_timepoints" (
	"id" serial PRIMARY KEY NOT NULL,
	"record_id" integer NOT NULL,
	"timepoint_id" integer NOT NULL,
	"label" text,
	"order" text DEFAULT 'a0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "timepoints" (
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

CREATE TABLE IF NOT EXISTS "adobe_lightroom_images" (
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
	"archived_at" timestamp with time zone,
	"record_id" integer,
	"media_id" integer,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "airtable_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"filename" text NOT NULL,
	"size" integer,
	"type" text,
	"width" integer,
	"height" integer,
	"extract_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"media_id" integer
);

CREATE TABLE IF NOT EXISTS "airtable_creators" (
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"index_entry_id" integer,
	"embedding" vector(768)
);

CREATE TABLE IF NOT EXISTS "airtable_extract_connections" (
	"from_extract_id" text NOT NULL,
	"to_extract_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "airtable_extract_connections_from_extract_id_to_extract_id_pk" PRIMARY KEY("from_extract_id","to_extract_id")
);

CREATE TABLE IF NOT EXISTS "airtable_extract_creators" (
	"extract_id" text NOT NULL,
	"creator_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "airtable_extract_creators_extract_id_creator_id_pk" PRIMARY KEY("extract_id","creator_id")
);

CREATE TABLE IF NOT EXISTS "airtable_extract_spaces" (
	"extract_id" text NOT NULL,
	"space_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "airtable_extract_spaces_extract_id_space_id_pk" PRIMARY KEY("extract_id","space_id")
);

CREATE TABLE IF NOT EXISTS "airtable_extracts" (
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"record_id" integer,
	"embedding" vector(768)
);

CREATE TABLE IF NOT EXISTS "airtable_spaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"full_name" text,
	"icon" text,
	"integration_run_id" integer NOT NULL,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"index_entry_id" integer,
	"embedding" vector(768)
);

CREATE TABLE IF NOT EXISTS "arc_browsing_history" (
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "arc_browsing_history_omit_list" (
	"pattern" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "github_commit_changes" (
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

CREATE TABLE IF NOT EXISTS "github_commits" (
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
	"embedding" vector(768),
	"committed_at" timestamp with time zone,
	"content_created_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "github_commits_sha_unique" UNIQUE("sha")
);

CREATE TABLE IF NOT EXISTS "github_repositories" (
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
	"archived_at" timestamp with time zone,
	"record_id" integer,
	"embedding" vector(768),
	CONSTRAINT "github_repositories_node_id_unique" UNIQUE("node_id")
);

CREATE TABLE IF NOT EXISTS "github_users" (
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
	"archived_at" timestamp with time zone,
	"index_entry_id" integer,
	"embedding" vector(768),
	CONSTRAINT "github_users_node_id_unique" UNIQUE("node_id")
);

CREATE TABLE IF NOT EXISTS "raindrop_bookmarks" (
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
	"archived_at" timestamp with time zone,
	"record_id" integer,
	"media_id" integer,
	"embedding" vector(768),
	CONSTRAINT "raindrop_bookmarks_link_url_created_at_unique" UNIQUE("link_url","created_at")
);

CREATE TABLE IF NOT EXISTS "raindrop_collections" (
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"index_entry_id" integer,
	"embedding" vector(768)
);

CREATE TABLE IF NOT EXISTS "readwise_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text,
	"source_url" text,
	"title" text,
	"author" text,
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
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"record_id" integer,
	"media_id" integer,
	"embedding" vector(768)
);

CREATE TABLE IF NOT EXISTS "twitter_media" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "twitter_media_type" NOT NULL,
	"tweet_url" text NOT NULL,
	"media_url" text NOT NULL,
	"thumbnail_url" text,
	"tweet_id" text NOT NULL,
	"archived_at" timestamp with time zone,
	"media_id" integer,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "twitter_media_media_url_unique" UNIQUE("media_url"),
	CONSTRAINT "twitter_media_thumbnail_url_unique" UNIQUE("thumbnail_url")
);

CREATE TABLE IF NOT EXISTS "twitter_tweets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"text" text,
	"quoted_tweet_id" text,
	"integration_run_id" integer NOT NULL,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"record_id" integer,
	"embedding" vector(768)
);

CREATE TABLE IF NOT EXISTS "twitter_users" (
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
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"index_entry_id" integer,
	"embedding" vector(768)
);

CREATE TABLE IF NOT EXISTS "integration_runs" (
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

----------------------------------------
-- 4. ALTER TABLE CONSTRAINTS (DO blocks)
----------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'index_relations_source_id_indices_id_fk') THEN
    ALTER TABLE "index_relations" ADD CONSTRAINT "index_relations_source_id_indices_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."indices"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'index_relations_target_id_indices_id_fk') THEN
    ALTER TABLE "index_relations" ADD CONSTRAINT "index_relations_target_id_indices_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."indices"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'indices_canonical_page_id_sources_id_fk') THEN
    ALTER TABLE "indices" ADD CONSTRAINT "indices_canonical_page_id_sources_id_fk" FOREIGN KEY ("canonical_page_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'indices_canonical_media_id_media_id_fk') THEN
    ALTER TABLE "indices" ADD CONSTRAINT "indices_canonical_media_id_media_id_fk" FOREIGN KEY ("canonical_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'indices_alias_of_indices_id_fk') THEN
    ALTER TABLE "indices" ADD CONSTRAINT "indices_alias_of_indices_id_fk" FOREIGN KEY ("alias_of") REFERENCES "public"."indices"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'locations_map_page_id_sources_id_fk') THEN
    ALTER TABLE "locations" ADD CONSTRAINT "locations_map_page_id_sources_id_fk" FOREIGN KEY ("map_page_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'locations_map_image_id_media_id_fk') THEN
    ALTER TABLE "locations" ADD CONSTRAINT "locations_map_image_id_media_id_fk" FOREIGN KEY ("map_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'locations_parent_location_id_locations_id_fk') THEN
    ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_location_id_locations_id_fk" FOREIGN KEY ("parent_location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'media_version_of_media_id_media_id_fk') THEN
    ALTER TABLE "media" ADD CONSTRAINT "media_version_of_media_id_media_id_fk" FOREIGN KEY ("version_of_media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'media_source_page_id_sources_id_fk') THEN
    ALTER TABLE "media" ADD CONSTRAINT "media_source_page_id_sources_id_fk" FOREIGN KEY ("source_page_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'record_categories_record_id_records_id_fk') THEN
    ALTER TABLE "record_categories" ADD CONSTRAINT "record_categories_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'record_categories_category_id_indices_id_fk') THEN
    ALTER TABLE "record_categories" ADD CONSTRAINT "record_categories_category_id_indices_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."indices"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'record_creators_record_id_records_id_fk') THEN
    ALTER TABLE "record_creators" ADD CONSTRAINT "record_creators_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'record_creators_entity_id_indices_id_fk') THEN
    ALTER TABLE "record_creators" ADD CONSTRAINT "record_creators_entity_id_indices_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."indices"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'record_media_record_id_records_id_fk') THEN
    ALTER TABLE "record_media" ADD CONSTRAINT "record_media_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'record_media_media_id_media_id_fk') THEN
    ALTER TABLE "record_media" ADD CONSTRAINT "record_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'record_relations_source_id_records_id_fk') THEN
    ALTER TABLE "record_relations" ADD CONSTRAINT "record_relations_source_id_records_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'record_relations_target_id_records_id_fk') THEN
    ALTER TABLE "record_relations" ADD CONSTRAINT "record_relations_target_id_records_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'record_sources_record_id_records_id_fk') THEN
    ALTER TABLE "record_sources" ADD CONSTRAINT "record_sources_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'record_sources_source_id_sources_id_fk') THEN
    ALTER TABLE "record_sources" ADD CONSTRAINT "record_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'records_format_id_indices_id_fk') THEN
    ALTER TABLE "records" ADD CONSTRAINT "records_format_id_indices_id_fk" FOREIGN KEY ("format_id") REFERENCES "public"."indices"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'records_location_id_locations_id_fk') THEN
    ALTER TABLE "records" ADD CONSTRAINT "records_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'source_connections_from_source_id_sources_id_fk') THEN
    ALTER TABLE "source_connections" ADD CONSTRAINT "source_connections_from_source_id_sources_id_fk" FOREIGN KEY ("from_source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'source_connections_to_source_id_sources_id_fk') THEN
    ALTER TABLE "source_connections" ADD CONSTRAINT "source_connections_to_source_id_sources_id_fk" FOREIGN KEY ("to_source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'source_contents_source_id_sources_id_fk') THEN
    ALTER TABLE "source_contents" ADD CONSTRAINT "source_contents_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'record_timepoints_record_id_records_id_fk') THEN
    ALTER TABLE "record_timepoints" ADD CONSTRAINT "record_timepoints_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'record_timepoints_timepoint_id_timepoints_id_fk') THEN
    ALTER TABLE "record_timepoints" ADD CONSTRAINT "record_timepoints_timepoint_id_timepoints_id_fk" FOREIGN KEY ("timepoint_id") REFERENCES "public"."timepoints"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'adobe_lightroom_images_integration_run_id_integration_runs_id_fk') THEN
    ALTER TABLE "adobe_lightroom_images" ADD CONSTRAINT "adobe_lightroom_images_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'adobe_lightroom_images_record_id_records_id_fk') THEN
    ALTER TABLE "adobe_lightroom_images" ADD CONSTRAINT "adobe_lightroom_images_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'adobe_lightroom_images_media_id_media_id_fk') THEN
    ALTER TABLE "adobe_lightroom_images" ADD CONSTRAINT "adobe_lightroom_images_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'airtable_attachments_extract_id_airtable_extracts_id_fk') THEN
    ALTER TABLE "airtable_attachments" ADD CONSTRAINT "airtable_attachments_extract_id_airtable_extracts_id_fk" FOREIGN KEY ("extract_id") REFERENCES "public"."airtable_extracts"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'airtable_attachments_media_id_media_id_fk') THEN
    ALTER TABLE "airtable_attachments" ADD CONSTRAINT "airtable_attachments_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'airtable_creators_integration_run_id_integration_runs_id_fk') THEN
    ALTER TABLE "airtable_creators" ADD CONSTRAINT "airtable_creators_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'airtable_creators_index_entry_id_indices_id_fk') THEN
    ALTER TABLE "airtable_creators" ADD CONSTRAINT "airtable_creators_index_entry_id_indices_id_fk" FOREIGN KEY ("index_entry_id") REFERENCES "public"."indices"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'airtable_extract_connections_from_extract_id_airtable_extracts_id_fk') THEN
    ALTER TABLE "airtable_extract_connections" ADD CONSTRAINT "airtable_extract_connections_from_extract_id_airtable_extracts_id_fk" FOREIGN KEY ("from_extract_id") REFERENCES "public"."airtable_extracts"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'airtable_extract_connections_to_extract_id_airtable_extracts_id_fk') THEN
    ALTER TABLE "airtable_extract_connections" ADD CONSTRAINT "airtable_extract_connections_to_extract_id_airtable_extracts_id_fk" FOREIGN KEY ("to_extract_id") REFERENCES "public"."airtable_extracts"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'airtable_extract_creators_extract_id_airtable_extracts_id_fk') THEN
    ALTER TABLE "airtable_extract_creators" ADD CONSTRAINT "airtable_extract_creators_extract_id_airtable_extracts_id_fk" FOREIGN KEY ("extract_id") REFERENCES "public"."airtable_extracts"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'airtable_extract_creators_creator_id_airtable_creators_id_fk') THEN
    ALTER TABLE "airtable_extract_creators" ADD CONSTRAINT "airtable_extract_creators_creator_id_airtable_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."airtable_creators"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'airtable_extract_spaces_extract_id_airtable_extracts_id_fk') THEN
    ALTER TABLE "airtable_extract_spaces" ADD CONSTRAINT "airtable_extract_spaces_extract_id_airtable_extracts_id_fk" FOREIGN KEY ("extract_id") REFERENCES "public"."airtable_extracts"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'airtable_extract_spaces_space_id_airtable_spaces_id_fk') THEN
    ALTER TABLE "airtable_extract_spaces" ADD CONSTRAINT "airtable_extract_spaces_space_id_airtable_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."airtable_spaces"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'airtable_extracts_parent_id_airtable_extracts_id_fk') THEN
    ALTER TABLE "airtable_extracts" ADD CONSTRAINT "airtable_extracts_parent_id_airtable_extracts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."airtable_extracts"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'airtable_extracts_integration_run_id_integration_runs_id_fk') THEN
    ALTER TABLE "airtable_extracts" ADD CONSTRAINT "airtable_extracts_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'airtable_extracts_record_id_records_id_fk') THEN
    ALTER TABLE "airtable_extracts" ADD CONSTRAINT "airtable_extracts_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'airtable_spaces_integration_run_id_integration_runs_id_fk') THEN
    ALTER TABLE "airtable_spaces" ADD CONSTRAINT "airtable_spaces_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'airtable_spaces_index_entry_id_indices_id_fk') THEN
    ALTER TABLE "airtable_spaces" ADD CONSTRAINT "airtable_spaces_index_entry_id_indices_id_fk" FOREIGN KEY ("index_entry_id") REFERENCES "public"."indices"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'arc_browsing_history_integration_run_id_integration_runs_id_fk') THEN
    ALTER TABLE "arc_browsing_history" ADD CONSTRAINT "arc_browsing_history_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'github_commit_changes_commit_id_github_commits_id_fk') THEN
    ALTER TABLE "github_commit_changes" ADD CONSTRAINT "github_commit_changes_commit_id_github_commits_id_fk" FOREIGN KEY ("commit_id") REFERENCES "public"."github_commits"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'github_commits_repository_id_github_repositories_id_fk') THEN
    ALTER TABLE "github_commits" ADD CONSTRAINT "github_commits_repository_id_github_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'github_commits_integration_run_id_integration_runs_id_fk') THEN
    ALTER TABLE "github_commits" ADD CONSTRAINT "github_commits_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'github_repositories_owner_id_github_users_id_fk') THEN
    ALTER TABLE "github_repositories" ADD CONSTRAINT "github_repositories_owner_id_github_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."github_users"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'github_repositories_integration_run_id_integration_runs_id_fk') THEN
    ALTER TABLE "github_repositories" ADD CONSTRAINT "github_repositories_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'github_repositories_record_id_records_id_fk') THEN
    ALTER TABLE "github_repositories" ADD CONSTRAINT "github_repositories_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'github_users_integration_run_id_integration_runs_id_fk') THEN
    ALTER TABLE "github_users" ADD CONSTRAINT "github_users_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'github_users_index_entry_id_indices_id_fk') THEN
    ALTER TABLE "github_users" ADD CONSTRAINT "github_users_index_entry_id_indices_id_fk" FOREIGN KEY ("index_entry_id") REFERENCES "public"."indices"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raindrop_bookmarks_collection_id_raindrop_collections_id_fk') THEN
    ALTER TABLE "raindrop_bookmarks" ADD CONSTRAINT "raindrop_bookmarks_collection_id_raindrop_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."raindrop_collections"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raindrop_bookmarks_integration_run_id_integration_runs_id_fk') THEN
    ALTER TABLE "raindrop_bookmarks" ADD CONSTRAINT "raindrop_bookmarks_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raindrop_bookmarks_record_id_records_id_fk') THEN
    ALTER TABLE "raindrop_bookmarks" ADD CONSTRAINT "raindrop_bookmarks_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raindrop_bookmarks_media_id_media_id_fk') THEN
    ALTER TABLE "raindrop_bookmarks" ADD CONSTRAINT "raindrop_bookmarks_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raindrop_collections_parent_id_raindrop_collections_id_fk') THEN
    ALTER TABLE "raindrop_collections" ADD CONSTRAINT "raindrop_collections_parent_id_raindrop_collections_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."raindrop_collections"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raindrop_collections_integration_run_id_integration_runs_id_fk') THEN
    ALTER TABLE "raindrop_collections" ADD CONSTRAINT "raindrop_collections_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raindrop_collections_index_entry_id_indices_id_fk') THEN
    ALTER TABLE "raindrop_collections" ADD CONSTRAINT "raindrop_collections_index_entry_id_indices_id_fk" FOREIGN KEY ("index_entry_id") REFERENCES "public"."indices"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'readwise_documents_parent_id_readwise_documents_id_fk') THEN
    ALTER TABLE "readwise_documents" ADD CONSTRAINT "readwise_documents_parent_id_readwise_documents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."readwise_documents"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'readwise_documents_integration_run_id_integration_runs_id_fk') THEN
    ALTER TABLE "readwise_documents" ADD CONSTRAINT "readwise_documents_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'readwise_documents_record_id_records_id_fk') THEN
    ALTER TABLE "readwise_documents" ADD CONSTRAINT "readwise_documents_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'readwise_documents_media_id_media_id_fk') THEN
    ALTER TABLE "readwise_documents" ADD CONSTRAINT "readwise_documents_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'twitter_media_tweet_id_twitter_tweets_id_fk') THEN
    ALTER TABLE "twitter_media" ADD CONSTRAINT "twitter_media_tweet_id_twitter_tweets_id_fk" FOREIGN KEY ("tweet_id") REFERENCES "public"."twitter_tweets"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'twitter_media_media_id_media_id_fk') THEN
    ALTER TABLE "twitter_media" ADD CONSTRAINT "twitter_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'twitter_tweets_user_id_twitter_users_id_fk') THEN
    ALTER TABLE "twitter_tweets" ADD CONSTRAINT "twitter_tweets_user_id_twitter_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."twitter_users"("id") ON DELETE cascade ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'twitter_tweets_quoted_tweet_id_twitter_tweets_id_fk') THEN
    ALTER TABLE "twitter_tweets" ADD CONSTRAINT "twitter_tweets_quoted_tweet_id_twitter_tweets_id_fk" FOREIGN KEY ("quoted_tweet_id") REFERENCES "public"."twitter_tweets"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'twitter_tweets_integration_run_id_integration_runs_id_fk') THEN
    ALTER TABLE "twitter_tweets" ADD CONSTRAINT "twitter_tweets_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'twitter_tweets_record_id_records_id_fk') THEN
    ALTER TABLE "twitter_tweets" ADD CONSTRAINT "twitter_tweets_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'twitter_users_integration_run_id_integration_runs_id_fk') THEN
    ALTER TABLE "twitter_users" ADD CONSTRAINT "twitter_users_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'twitter_users_index_entry_id_indices_id_fk') THEN
    ALTER TABLE "twitter_users" ADD CONSTRAINT "twitter_users_index_entry_id_indices_id_fk" FOREIGN KEY ("index_entry_id") REFERENCES "public"."indices"("id") ON DELETE set null ON UPDATE cascade;
  END IF;
END $$;


--------------------------------
-- 5. INDEXES (using IF NOT EXISTS)
--------------------------------
CREATE INDEX IF NOT EXISTS "indices_main_type_sub_type_index" ON "indices" USING btree ("main_type","sub_type");
CREATE INDEX IF NOT EXISTS "indices_canonical_page_id_index" ON "indices" USING btree ("canonical_page_id");
CREATE INDEX IF NOT EXISTS "indices_canonical_media_id_index" ON "indices" USING btree ("canonical_media_id");
CREATE INDEX IF NOT EXISTS "locations_map_page_id_index" ON "locations" USING btree ("map_page_id");
CREATE INDEX IF NOT EXISTS "locations_map_image_id_index" ON "locations" USING btree ("map_image_id");
CREATE INDEX IF NOT EXISTS "locations_location_type_index" ON "locations" USING btree ("location_type");
CREATE INDEX IF NOT EXISTS "locations_parent_location_id_index" ON "locations" USING btree ("parent_location_id");
CREATE INDEX IF NOT EXISTS "media_type_index" ON "media" USING btree ("type");
CREATE INDEX IF NOT EXISTS "media_format_index" ON "media" USING btree ("format");
CREATE INDEX IF NOT EXISTS "media_source_page_id_index" ON "media" USING btree ("source_page_id");
CREATE INDEX IF NOT EXISTS "media_version_of_media_id_index" ON "media" USING btree ("version_of_media_id");
CREATE INDEX IF NOT EXISTS "record_categories_record_id_index" ON "record_categories" USING btree ("record_id");
CREATE INDEX IF NOT EXISTS "record_categories_category_id_index" ON "record_categories" USING btree ("category_id");
CREATE INDEX IF NOT EXISTS "record_creators_record_id_index" ON "record_creators" USING btree ("record_id");
CREATE INDEX IF NOT EXISTS "record_creators_entity_id_index" ON "record_creators" USING btree ("entity_id");
CREATE INDEX IF NOT EXISTS "record_media_record_id_index" ON "record_media" USING btree ("record_id");
CREATE INDEX IF NOT EXISTS "record_media_media_id_index" ON "record_media" USING btree ("media_id");
CREATE INDEX IF NOT EXISTS "record_relations_source_id_index" ON "record_relations" USING btree ("source_id");
CREATE INDEX IF NOT EXISTS "record_relations_target_id_index" ON "record_relations" USING btree ("target_id");
CREATE INDEX IF NOT EXISTS "record_sources_record_id_index" ON "record_sources" USING btree ("record_id");
CREATE INDEX IF NOT EXISTS "record_sources_source_id_index" ON "record_sources" USING btree ("source_id");
CREATE INDEX IF NOT EXISTS "records_type_index" ON "records" USING btree ("type");
CREATE INDEX IF NOT EXISTS "records_format_id_index" ON "records" USING btree ("format_id");
CREATE INDEX IF NOT EXISTS "records_location_id_index" ON "records" USING btree ("location_id");
CREATE INDEX IF NOT EXISTS "source_connections_from_source_id_index" ON "source_connections" USING btree ("from_source_id");
CREATE INDEX IF NOT EXISTS "source_connections_to_source_id_index" ON "source_connections" USING btree ("to_source_id");
CREATE INDEX IF NOT EXISTS "source_contents_source_id_index" ON "source_contents" USING btree ("source_id");
CREATE INDEX IF NOT EXISTS "sources_domain_index" ON "sources" USING btree ("domain");
CREATE INDEX IF NOT EXISTS "sources_last_crawl_date_last_http_status_index" ON "sources" USING btree ("last_crawl_date","last_http_status");
CREATE INDEX IF NOT EXISTS "record_timepoints_record_id_index" ON "record_timepoints" USING btree ("record_id");
CREATE INDEX IF NOT EXISTS "record_timepoints_timepoint_id_index" ON "record_timepoints" USING btree ("timepoint_id");
CREATE INDEX IF NOT EXISTS "timepoints_start_date_index" ON "timepoints" USING btree ("start_date");
CREATE INDEX IF NOT EXISTS "timepoints_start_instant_index" ON "timepoints" USING btree ("start_instant");
CREATE INDEX IF NOT EXISTS "timepoints_start_granularity_index" ON "timepoints" USING btree ("start_granularity");
CREATE INDEX IF NOT EXISTS "timepoints_end_date_index" ON "timepoints" USING btree ("end_date");
CREATE INDEX IF NOT EXISTS "timepoints_end_instant_index" ON "timepoints" USING btree ("end_instant");
CREATE INDEX IF NOT EXISTS "timepoints_end_granularity_index" ON "timepoints" USING btree ("end_granularity");
CREATE INDEX IF NOT EXISTS "adobe_lightroom_images_integration_run_id_index" ON "adobe_lightroom_images" USING btree ("integration_run_id");
CREATE INDEX IF NOT EXISTS "adobe_lightroom_images_capture_date_index" ON "adobe_lightroom_images" USING btree ("capture_date");
CREATE INDEX IF NOT EXISTS "adobe_lightroom_images_archived_at_index" ON "adobe_lightroom_images" USING btree ("archived_at");
CREATE INDEX IF NOT EXISTS "adobe_lightroom_images_record_id_index" ON "adobe_lightroom_images" USING btree ("record_id");
CREATE INDEX IF NOT EXISTS "adobe_lightroom_images_media_id_index" ON "adobe_lightroom_images" USING btree ("media_id");
CREATE INDEX IF NOT EXISTS "airtable_creators_archived_at_index" ON "airtable_creators" USING btree ("archived_at");
CREATE INDEX IF NOT EXISTS "airtable_creators_index_entry_id_index" ON "airtable_creators" USING btree ("index_entry_id");
CREATE INDEX IF NOT EXISTS "airtable_extracts_archived_at_index" ON "airtable_extracts" USING btree ("archived_at");
CREATE INDEX IF NOT EXISTS "airtable_extracts_record_id_index" ON "airtable_extracts" USING btree ("record_id");
CREATE INDEX IF NOT EXISTS "airtable_spaces_archived_at_index" ON "airtable_spaces" USING btree ("archived_at");
CREATE INDEX IF NOT EXISTS "airtable_spaces_index_entry_id_index" ON "airtable_spaces" USING btree ("index_entry_id");
CREATE INDEX IF NOT EXISTS "arc_browsing_history_integration_run_id_index" ON "arc_browsing_history" USING btree ("integration_run_id");
CREATE INDEX IF NOT EXISTS "arc_browsing_history_view_time_index" ON "arc_browsing_history" USING btree ("view_time");
CREATE INDEX IF NOT EXISTS "arc_browsing_history_url_idx" ON "arc_browsing_history" USING btree ("url");
CREATE INDEX IF NOT EXISTS "arc_browsing_history_view_epoch_microseconds_index" ON "arc_browsing_history" USING btree ("view_epoch_microseconds");
CREATE INDEX IF NOT EXISTS "arc_browsing_history_hostname_index" ON "arc_browsing_history" USING btree ("hostname");
CREATE INDEX IF NOT EXISTS "github_commit_changes_commit_id_index" ON "github_commit_changes" USING btree ("commit_id");
CREATE INDEX IF NOT EXISTS "github_commit_changes_filename_index" ON "github_commit_changes" USING btree ("filename");
CREATE INDEX IF NOT EXISTS "github_commits_repository_id_index" ON "github_commits" USING btree ("repository_id");
CREATE INDEX IF NOT EXISTS "github_commits_sha_index" ON "github_commits" USING btree ("sha");
CREATE INDEX IF NOT EXISTS "github_repositories_owner_id_index" ON "github_repositories" USING btree ("owner_id");
CREATE INDEX IF NOT EXISTS "github_repositories_node_id_index" ON "github_repositories" USING btree ("node_id");
CREATE INDEX IF NOT EXISTS "github_repositories_archived_at_index" ON "github_repositories" USING btree ("archived_at");
CREATE INDEX IF NOT EXISTS "github_repositories_record_id_index" ON "github_repositories" USING btree ("record_id");
CREATE INDEX IF NOT EXISTS "github_users_login_index" ON "github_users" USING btree ("login");
CREATE INDEX IF NOT EXISTS "github_users_archived_at_index" ON "github_users" USING btree ("archived_at");
CREATE INDEX IF NOT EXISTS "github_users_index_entry_id_index" ON "github_users" USING btree ("index_entry_id");
CREATE INDEX IF NOT EXISTS "raindrop_bookmarks_integration_run_id_index" ON "raindrop_bookmarks" USING btree ("integration_run_id");
CREATE INDEX IF NOT EXISTS "raindrop_bookmarks_link_url_index" ON "raindrop_bookmarks" USING btree ("link_url");
CREATE INDEX IF NOT EXISTS "raindrop_bookmarks_created_at_index" ON "raindrop_bookmarks" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "raindrop_bookmarks_archived_at_index" ON "raindrop_bookmarks" USING btree ("archived_at");
CREATE INDEX IF NOT EXISTS "raindrop_bookmarks_record_id_index" ON "raindrop_bookmarks" USING btree ("record_id");
CREATE INDEX IF NOT EXISTS "raindrop_bookmarks_media_id_index" ON "raindrop_bookmarks" USING btree ("media_id");
CREATE INDEX IF NOT EXISTS "raindrop_collections_parent_id_index" ON "raindrop_collections" USING btree ("parent_id");
CREATE INDEX IF NOT EXISTS "raindrop_collections_archived_at_index" ON "raindrop_collections" USING btree ("archived_at");
CREATE INDEX IF NOT EXISTS "raindrop_collections_index_entry_id_index" ON "raindrop_collections" USING btree ("index_entry_id");
CREATE INDEX IF NOT EXISTS "readwise_documents_integration_run_id_index" ON "readwise_documents" USING btree ("integration_run_id");
CREATE INDEX IF NOT EXISTS "readwise_documents_url_index" ON "readwise_documents" USING btree ("url");
CREATE INDEX IF NOT EXISTS "readwise_documents_created_at_index" ON "readwise_documents" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "readwise_documents_parent_id_index" ON "readwise_documents" USING btree ("parent_id");
CREATE INDEX IF NOT EXISTS "readwise_documents_archived_at_index" ON "readwise_documents" USING btree ("archived_at");
CREATE INDEX IF NOT EXISTS "readwise_documents_record_id_index" ON "readwise_documents" USING btree ("record_id");
CREATE INDEX IF NOT EXISTS "readwise_documents_media_id_index" ON "readwise_documents" USING btree ("media_id");
CREATE INDEX IF NOT EXISTS "twitter_media_archived_at_index" ON "twitter_media" USING btree ("archived_at");
CREATE INDEX IF NOT EXISTS "twitter_media_media_id_index" ON "twitter_media" USING btree ("media_id");
CREATE INDEX IF NOT EXISTS "twitter_tweets_integration_run_id_index" ON "twitter_tweets" USING btree ("integration_run_id");
CREATE INDEX IF NOT EXISTS "twitter_tweets_archived_at_index" ON "twitter_tweets" USING btree ("archived_at");
CREATE INDEX IF NOT EXISTS "twitter_tweets_record_id_index" ON "twitter_tweets" USING btree ("record_id");
CREATE INDEX IF NOT EXISTS "twitter_users_archived_at_index" ON "twitter_users" USING btree ("archived_at");
CREATE INDEX IF NOT EXISTS "twitter_users_index_entry_id_index" ON "twitter_users" USING btree ("index_entry_id");
CREATE INDEX IF NOT EXISTS "integration_runs_integration_type_index" ON "integration_runs" USING btree ("integration_type");
