-- Step 1: Add predicate column as NULLABLE first
ALTER TABLE "links" ADD COLUMN "predicate" text;--> statement-breakpoint

-- Step 2: Populate predicate from predicates table (MUST happen before dropping predicates)
UPDATE "links" SET "predicate" = (
  SELECT "slug" FROM "predicates" WHERE "predicates"."id" = "links"."predicate_id"
);--> statement-breakpoint

-- Step 3: Now make it NOT NULL
ALTER TABLE "links" ALTER COLUMN "predicate" SET NOT NULL;--> statement-breakpoint

-- Step 4: Drop FK constraint
ALTER TABLE "links" DROP CONSTRAINT "links_predicate_id_predicates_id_fk";--> statement-breakpoint

-- Step 5: Drop old unique constraint
ALTER TABLE "links" DROP CONSTRAINT "links_source_id_target_id_predicate_id_unique";--> statement-breakpoint

-- Step 6: Drop old indexes
DROP INDEX "links_source_id_predicate_id_index";--> statement-breakpoint
DROP INDEX "links_target_id_predicate_id_index";--> statement-breakpoint
DROP INDEX "links_predicate_id_index";--> statement-breakpoint

-- Step 7: Drop predicate_id column
ALTER TABLE "links" DROP COLUMN "predicate_id";--> statement-breakpoint

-- Step 8: Now safe to drop predicates table
DROP TABLE "predicates";--> statement-breakpoint

-- Step 9: Drop the enum type
DROP TYPE "predicate_type";--> statement-breakpoint

-- Step 10: Create new indexes and constraint
ALTER TABLE "links" ADD CONSTRAINT "links_source_id_target_id_predicate_unique" UNIQUE("source_id","target_id","predicate");--> statement-breakpoint
CREATE INDEX "links_source_id_predicate_index" ON "links" ("source_id","predicate");--> statement-breakpoint
CREATE INDEX "links_target_id_predicate_index" ON "links" ("target_id","predicate");--> statement-breakpoint
CREATE INDEX "links_predicate_index" ON "links" ("predicate");
