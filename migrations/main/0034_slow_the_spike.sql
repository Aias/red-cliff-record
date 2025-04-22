CREATE TYPE "public"."predicate_type" AS ENUM('creation', 'containment', 'description', 'association', 'reference', 'identity');--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "slug" text;--> statement-breakpoint
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "predicates_slug_unique" UNIQUE("slug")
);
-- Insert seed data for records
INSERT INTO "records" ("slug", "title", "type") VALUES
('nick-trombley', 'Nick Trombley', 'entity');

-- Insert seed data for predicates
-- Note: inverse_slug is inserted as text here and the foreign key constraint handles linking by slug.
INSERT INTO "predicates" ("slug", "name", "type", "role", "inverse_slug") VALUES
('created_by', 'created by', 'creation', 'creator', 'created'),
('created', 'created', 'creation', 'creator', 'created_by'),
('via', 'via', 'creation', 'via', NULL),
('edited_by', 'edited by', 'creation', 'editor', NULL),
('contained_by', 'contained by', 'containment', NULL, 'contains'),
('contains', 'contains', 'containment', NULL, 'contained_by'),
('quotes', 'quotes', 'containment', NULL, NULL),
('transcludes', 'transcludes', 'containment', NULL, NULL),
('about', 'about', 'description', NULL, NULL),
('tagged_with', 'tagged with', 'description', NULL, NULL),
('references', 'references', 'reference', NULL, 'referenced_by'),
('referenced_by', 'referenced by', 'reference', NULL, 'references'),
('related_to', 'related to', 'association', NULL, 'related_to'),
('example_of', 'example of', 'association', NULL, 'examples'),
('examples', 'examples', 'association', NULL, 'example_of'),
('has_format', 'has format', 'identity', NULL, 'format_of'),
('format_of', 'format of', 'identity', NULL, 'has_format'),
('instance_of', 'instance of', 'identity', NULL, 'has_instance'),
('has_instance', 'has instance', 'identity', NULL, 'instance_of'),
('same_as', 'same as', 'identity', NULL, 'same_as');

-- Migrate data from old columns/tables to the new links table

-- 1. Migrate records.format_id -> links (has_format)
INSERT INTO "links" ("source_id", "target_id", "predicate_id")
SELECT
    r.id AS source_id,
    r.format_id AS target_id,
    (SELECT p.id FROM predicates p WHERE p.slug = 'has_format') AS predicate_id
FROM "records" r
WHERE r.format_id IS NOT NULL;

-- 2. Migrate records.parent_id -> links (contained_by or quotes)
INSERT INTO "links" ("source_id", "target_id", "predicate_id")
SELECT
    r.id AS source_id,
    r.parent_id AS target_id,
    CASE
        WHEN r.child_type = 'quotes' THEN (SELECT p.id FROM predicates p WHERE p.slug = 'quotes')
        ELSE (SELECT p.id FROM predicates p WHERE p.slug = 'contained_by')
    END AS predicate_id
FROM "records" r
WHERE r.parent_id IS NOT NULL;

-- 2b. Migrate records.transclude_id -> links (transcludes)
INSERT INTO "links" ("source_id", "target_id", "predicate_id")
SELECT
    r.id AS source_id,
    r.transclude_id AS target_id,
    (SELECT p.id FROM predicates p WHERE p.slug = 'transcludes') AS predicate_id
FROM "records" r
WHERE r.transclude_id IS NOT NULL;

-- 3. Migrate record_creators -> links (created_by)
INSERT INTO "links" ("source_id", "target_id", "predicate_id", "notes", "created_at", "updated_at")
SELECT
    rc.record_id AS source_id,
    rc.creator_id AS target_id,
    (SELECT p.id FROM predicates p WHERE p.slug = 'created_by') AS predicate_id,
    rc.notes,
    rc.created_at,
    rc.updated_at
FROM "record_creators" rc;

-- 4. Migrate record_relations -> links (tagged_with or related_to)
INSERT INTO "links" ("source_id", "target_id", "predicate_id", "notes", "created_at", "updated_at")
SELECT
    rr.source_id AS source_id,
    rr.target_id AS target_id,
    CASE
        WHEN rr.type = 'tagged' THEN (SELECT p.id FROM predicates p WHERE p.slug = 'tagged_with')
        ELSE (SELECT p.id FROM predicates p WHERE p.slug = 'related_to')
    END AS predicate_id,
    rr.notes,
    rr.created_at,
    rr.updated_at
FROM "record_relations" rr;
--> statement-breakpoint
ALTER TABLE "record_creators" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "record_relations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "record_creators" CASCADE;--> statement-breakpoint
DROP TABLE "record_relations" CASCADE;--> statement-breakpoint
ALTER TABLE "records" DROP CONSTRAINT "records_format_id_records_id_fk";
--> statement-breakpoint
ALTER TABLE "records" DROP CONSTRAINT "records_parent_id_records_id_fk";
--> statement-breakpoint
ALTER TABLE "records" DROP CONSTRAINT "records_transclude_id_records_id_fk";
--> statement-breakpoint
DROP INDEX "records_parent_id_index";--> statement-breakpoint
DROP INDEX "records_format_id_index";--> statement-breakpoint
DROP INDEX "records_transclude_id_index";--> statement-breakpoint
DROP INDEX "records_is_index_node_index";--> statement-breakpoint
DROP INDEX "records_is_format_index";--> statement-breakpoint
ALTER TABLE "records" ALTER COLUMN "rating" SET DATA TYPE smallint;--> statement-breakpoint

ALTER TABLE "links" ADD CONSTRAINT "links_source_id_records_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_target_id_records_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_predicate_id_predicates_id_fk" FOREIGN KEY ("predicate_id") REFERENCES "public"."predicates"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "predicates" ADD CONSTRAINT "predicates_inverse_slug_predicates_slug_fk" FOREIGN KEY ("inverse_slug") REFERENCES "public"."predicates"("slug") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "links_source_id_index" ON "links" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "links_target_id_index" ON "links" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "links_predicate_id_index" ON "links" USING btree ("predicate_id");--> statement-breakpoint
CREATE INDEX "predicates_slug_index" ON "predicates" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "predicates_type_index" ON "predicates" USING btree ("type");--> statement-breakpoint
CREATE INDEX "predicates_role_index" ON "predicates" USING btree ("role");--> statement-breakpoint
CREATE INDEX "predicates_inverse_slug_index" ON "predicates" USING btree ("inverse_slug");--> statement-breakpoint
CREATE INDEX "records_slug_index" ON "records" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "records" DROP COLUMN "format_id";--> statement-breakpoint
ALTER TABLE "records" DROP COLUMN "parent_id";--> statement-breakpoint
ALTER TABLE "records" DROP COLUMN "child_order";--> statement-breakpoint
ALTER TABLE "records" DROP COLUMN "child_type";--> statement-breakpoint
ALTER TABLE "records" DROP COLUMN "transclude_id";--> statement-breakpoint
ALTER TABLE "records" DROP COLUMN "is_index_node";--> statement-breakpoint
ALTER TABLE "records" DROP COLUMN "is_format";--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_slug_unique" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "public"."records" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."record_type";--> statement-breakpoint
CREATE TYPE "public"."record_type" AS ENUM('entity', 'concept', 'artifact');--> statement-breakpoint
ALTER TABLE "public"."records" ALTER COLUMN "type" SET DATA TYPE "public"."record_type" USING "type"::"public"."record_type";--> statement-breakpoint
DROP TYPE "public"."child_type";--> statement-breakpoint
DROP TYPE "public"."creator_role";--> statement-breakpoint
DROP TYPE "public"."record_relation_type";