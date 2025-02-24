CREATE TYPE "public"."record_type" AS ENUM('agent', 'abstraction', 'record', 'event', 'object', 'place', 'assemblage');--> statement-breakpoint
ALTER TYPE "public"."creator_role_type" RENAME TO "creator_role";--> statement-breakpoint

CREATE TABLE "records_temp" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "record_type" NOT NULL,
	"title" text NOT NULL,
	"sense" text,
	"abbreviation" text,
	"url" text,
	"avatar_url" text,
	"summary" text,
	"content" text,
	"notes" text,
	"parent_id" integer,
	"child_order" text DEFAULT 'a0' NOT NULL,
	"transclude_id" integer,
	"rating" integer DEFAULT 0 NOT NULL,
	"is_index_node" boolean DEFAULT false NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"needs_curation" boolean DEFAULT false NOT NULL,
	"reminder_at" timestamp with time zone,
	"sources" "integration_type"[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"text_embedding" vector(768)
);

INSERT INTO records_temp (
    id,
    type,
    title,
    sense,
    abbreviation,
    url,
    avatar_url,
    summary,
    content,
    notes,
    transclude_id,
    rating,
    is_index_node,
    is_private,
    needs_curation,
    sources,
    created_at,
    updated_at,
    content_created_at,
    content_updated_at
)
SELECT
    id,
    CASE 
        WHEN main_type = 'entity' THEN 'agent'
        WHEN main_type = 'category' THEN 'abstraction'
        ELSE 'object'
    END::record_type as type,
    name as title,
    sense,
    short_name as abbreviation,
    canonical_url as url,
    canonical_media_url as avatar_url,
    notes as summary,
    NULL as content,
    NULL as notes,
    alias_of as transclude_id,
    0 as rating,
    true as is_index_node,
    is_private,
    needs_curation,
    sources,
    created_at,
    updated_at,
    content_created_at,
    content_updated_at
FROM indices;

--> statement-breakpoint
ALTER TABLE "index_relations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "indices" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "record_media" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "records" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Drop foreign key relationships
ALTER TABLE "lightroom_images" DROP CONSTRAINT "lightroom_images_record_id_records_id_fk"; --> statement-breakpoint
ALTER TABLE "airtable_creators" DROP CONSTRAINT "airtable_creators_index_entry_id_indices_id_fk"; --> statement-breakpoint
ALTER TABLE "airtable_extracts" DROP CONSTRAINT "airtable_extracts_record_id_records_id_fk"; --> statement-breakpoint
ALTER TABLE "airtable_formats" DROP CONSTRAINT "airtable_formats_index_entry_id_indices_id_fk"; --> statement-breakpoint
ALTER TABLE "airtable_spaces" DROP CONSTRAINT "airtable_spaces_index_entry_id_indices_id_fk"; --> statement-breakpoint
ALTER TABLE "github_repositories" DROP CONSTRAINT "github_repositories_record_id_records_id_fk"; --> statement-breakpoint
ALTER TABLE "github_users" DROP CONSTRAINT "github_users_index_entry_id_indices_id_fk"; --> statement-breakpoint
ALTER TABLE "raindrop_bookmarks" DROP CONSTRAINT "raindrop_bookmarks_record_id_records_id_fk"; --> statement-breakpoint
ALTER TABLE "raindrop_collections" DROP CONSTRAINT "raindrop_collections_index_entry_id_indices_id_fk"; --> statement-breakpoint
ALTER TABLE "raindrop_tags" DROP CONSTRAINT "raindrop_tags_index_entry_id_indices_id_fk"; --> statement-breakpoint
ALTER TABLE "readwise_authors" DROP CONSTRAINT "readwise_authors_index_entry_id_indices_id_fk"; --> statement-breakpoint
ALTER TABLE "readwise_documents" DROP CONSTRAINT "readwise_documents_record_id_records_id_fk"; --> statement-breakpoint
ALTER TABLE "readwise_tags" DROP CONSTRAINT "readwise_tags_index_entry_id_indices_id_fk"; --> statement-breakpoint
ALTER TABLE "record_categories" DROP CONSTRAINT "record_categories_record_id_records_id_fk"; --> statement-breakpoint
ALTER TABLE "record_categories" DROP CONSTRAINT "record_categories_category_id_indices_id_fk"; --> statement-breakpoint
ALTER TABLE "record_creators" DROP CONSTRAINT "record_creators_record_id_records_id_fk"; --> statement-breakpoint
ALTER TABLE "record_creators" DROP CONSTRAINT "record_creators_entity_id_indices_id_fk"; --> statement-breakpoint
ALTER TABLE "record_relations" DROP CONSTRAINT "record_relations_source_id_records_id_fk"; --> statement-breakpoint
ALTER TABLE "record_relations" DROP CONSTRAINT "record_relations_target_id_records_id_fk"; --> statement-breakpoint
ALTER TABLE "twitter_tweets" DROP CONSTRAINT "twitter_tweets_record_id_records_id_fk"; --> statement-breakpoint
ALTER TABLE "twitter_users" DROP CONSTRAINT "twitter_users_index_entry_id_indices_id_fk"; --> statement-breakpoint

ALTER TABLE "record_categories" DROP CONSTRAINT "record_categories_record_id_category_id_type_unique";--> statement-breakpoint
ALTER TABLE "record_creators" DROP CONSTRAINT "record_creators_record_id_entity_id_role_unique";--> statement-breakpoint

-- Drop indices
DROP INDEX "airtable_creators_index_entry_id_index";--> statement-breakpoint
DROP INDEX "airtable_formats_index_entry_id_index";--> statement-breakpoint
DROP INDEX "airtable_spaces_index_entry_id_index";--> statement-breakpoint
DROP INDEX "github_users_index_entry_id_index";--> statement-breakpoint
DROP INDEX "media_type_index";--> statement-breakpoint
DROP INDEX "media_format_index";--> statement-breakpoint
DROP INDEX "media_needs_curation_index";--> statement-breakpoint
DROP INDEX "raindrop_collections_index_entry_id_index";--> statement-breakpoint
DROP INDEX "raindrop_tags_index_entry_id_index";--> statement-breakpoint
DROP INDEX "record_creators_entity_id_index";--> statement-breakpoint
DROP INDEX "twitter_users_index_entry_id_index";--> statement-breakpoint

-- Rename and add columns
ALTER TABLE "airtable_creators" RENAME COLUMN "index_entry_id" TO "record_id";--> statement-breakpoint
ALTER TABLE "airtable_formats" RENAME COLUMN "index_entry_id" TO "record_id";--> statement-breakpoint
ALTER TABLE "airtable_spaces" RENAME COLUMN "index_entry_id" TO "record_id";--> statement-breakpoint
ALTER TABLE "github_users" RENAME COLUMN "index_entry_id" TO "record_id";--> statement-breakpoint
ALTER TABLE "raindrop_collections" RENAME COLUMN "index_entry_id" TO "record_id";--> statement-breakpoint
ALTER TABLE "raindrop_tags" RENAME COLUMN "index_entry_id" TO "record_id";--> statement-breakpoint
ALTER TABLE "readwise_authors" RENAME COLUMN "index_entry_id" TO "record_id";--> statement-breakpoint
ALTER TABLE "readwise_tags" RENAME COLUMN "index_entry_id" TO "record_id";--> statement-breakpoint
ALTER TABLE "record_creators" RENAME COLUMN "entity_id" TO "creator_id";--> statement-breakpoint
ALTER TABLE "twitter_users" RENAME COLUMN "index_entry_id" TO "record_id";--> statement-breakpoint

ALTER TABLE "record_categories" RENAME COLUMN "type" TO "category_type";--> statement-breakpoint
ALTER TABLE "record_creators" RENAME COLUMN "role" TO "creator_role";--> statement-breakpoint

ALTER TABLE "media" ADD COLUMN "record_id" integer;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "caption" text;--> statement-breakpoint
ALTER TABLE "record_categories" ADD COLUMN "order" text DEFAULT 'a0' NOT NULL;--> statement-breakpoint
ALTER TABLE "record_categories" ADD COLUMN "notes" text;--> statement-breakpoint

-- Recreate foreign key constraints
ALTER TABLE "records_temp" ADD CONSTRAINT "records_temp_parent_id_records_temp_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."records_temp"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "records_temp" ADD CONSTRAINT "records_temp_transclude_id_records_temp_id_fk" FOREIGN KEY ("transclude_id") REFERENCES "public"."records_temp"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lightroom_images" ADD CONSTRAINT "lightroom_images_record_id_records_temp_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records_temp"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "airtable_creators" ADD CONSTRAINT "airtable_creators_record_id_records_temp_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records_temp"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "airtable_extracts" ADD CONSTRAINT "airtable_extracts_record_id_records_temp_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records_temp"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "airtable_formats" ADD CONSTRAINT "airtable_formats_record_id_records_temp_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records_temp"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "airtable_spaces" ADD CONSTRAINT "airtable_spaces_record_id_records_temp_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records_temp"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD CONSTRAINT "github_repositories_record_id_records_temp_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records_temp"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "github_users" ADD CONSTRAINT "github_users_record_id_records_temp_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records_temp"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_record_id_records_temp_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records_temp"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "raindrop_bookmarks" ADD CONSTRAINT "raindrop_bookmarks_record_id_records_temp_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records_temp"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "raindrop_collections" ADD CONSTRAINT "raindrop_collections_record_id_records_temp_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records_temp"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "raindrop_tags" ADD CONSTRAINT "raindrop_tags_record_id_records_temp_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records_temp"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "readwise_authors" ADD CONSTRAINT "readwise_authors_record_id_records_temp_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records_temp"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "readwise_documents" ADD CONSTRAINT "readwise_documents_record_id_records_temp_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records_temp"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "readwise_tags" ADD CONSTRAINT "readwise_tags_record_id_records_temp_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records_temp"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "record_categories" ADD CONSTRAINT "record_categories_record_id_records_temp_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records_temp"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "record_categories" ADD CONSTRAINT "record_categories_category_id_records_temp_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."records_temp"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "record_creators" ADD CONSTRAINT "record_creators_record_id_records_temp_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records_temp"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "record_creators" ADD CONSTRAINT "record_creators_creator_id_records_temp_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."records_temp"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "record_relations" ADD CONSTRAINT "record_relations_source_id_records_temp_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."records_temp"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "record_relations" ADD CONSTRAINT "record_relations_target_id_records_temp_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."records_temp"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "twitter_tweets" ADD CONSTRAINT "twitter_tweets_record_id_records_temp_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records_temp"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "twitter_users" ADD CONSTRAINT "twitter_users_record_id_records_temp_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records_temp"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint

DROP TABLE "index_relations" CASCADE;--> statement-breakpoint
DROP TABLE "indices" CASCADE;--> statement-breakpoint
DROP TABLE "record_media" CASCADE;--> statement-breakpoint
DROP TABLE "records" CASCADE;--> statement-breakpoint

CREATE INDEX "airtable_creators_record_id_index" ON "airtable_creators" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "airtable_formats_record_id_index" ON "airtable_formats" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "airtable_spaces_record_id_index" ON "airtable_spaces" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "github_users_record_id_index" ON "github_users" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "media_record_id_index" ON "media" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "media_type_format_content_type_string_index" ON "media" USING btree ("type","format","content_type_string");--> statement-breakpoint
CREATE INDEX "media_url_index" ON "media" USING btree ("url");--> statement-breakpoint
CREATE INDEX "idx_records_content_search" ON "media" USING gin ("caption" gin_trgm_ops, "alt_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "raindrop_collections_record_id_index" ON "raindrop_collections" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "raindrop_tags_record_id_index" ON "raindrop_tags" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "record_creators_creator_id_index" ON "record_creators" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "twitter_users_record_id_index" ON "twitter_users" USING btree ("record_id");--> statement-breakpoint

ALTER TABLE "media" DROP COLUMN "content_created_at";--> statement-breakpoint
ALTER TABLE "media" DROP COLUMN "content_updated_at";--> statement-breakpoint
ALTER TABLE "media" DROP COLUMN "needs_curation";--> statement-breakpoint
ALTER TABLE "media" DROP COLUMN "is_private";--> statement-breakpoint
ALTER TABLE "media" DROP COLUMN "sources";--> statement-breakpoint

ALTER TABLE "record_categories" ADD CONSTRAINT "record_categories_record_id_category_id_category_type_unique" UNIQUE("record_id","category_id","category_type");--> statement-breakpoint
ALTER TABLE "record_creators" ADD CONSTRAINT "record_creators_record_id_creator_id_creator_role_unique" UNIQUE("record_id","creator_id","creator_role");--> statement-breakpoint

ALTER TABLE "public"."record_categories" ALTER COLUMN "category_type" DROP DEFAULT;
ALTER TABLE "public"."record_categories" ALTER COLUMN "category_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."categorization_type";--> statement-breakpoint
CREATE TYPE "public"."categorization_type" AS ENUM('about', 'instance_of');--> statement-breakpoint
ALTER TABLE "public"."record_categories" ALTER COLUMN "category_type" SET DATA TYPE "public"."categorization_type" USING "category_type"::"public"."categorization_type";--> statement-breakpoint
ALTER TABLE "public"."record_categories" ALTER COLUMN "category_type" SET DEFAULT 'about'::"categorization_type";

DROP TYPE "public"."index_main_type";--> statement-breakpoint
DROP TYPE "public"."index_relation_type";--> statement-breakpoint
DROP TYPE "public"."flag";--> statement-breakpoint
DROP TYPE "public"."child_record_type";