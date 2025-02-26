ALTER TABLE "records" RENAME COLUMN "needs_curation" TO "is_curated";--> statement-breakpoint
DROP INDEX "records_needs_curation_index";--> statement-breakpoint
UPDATE "records" SET "is_curated" = NOT "is_curated";--> statement-breakpoint
CREATE INDEX "records_is_curated_index" ON "records" USING btree ("is_curated");