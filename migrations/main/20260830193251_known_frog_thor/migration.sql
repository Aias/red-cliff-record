DROP INDEX "records_is_curated_index";--> statement-breakpoint
ALTER TABLE "records" DROP COLUMN "is_curated";--> statement-breakpoint
CREATE INDEX "idx_records_curated_recency" ON "records" ("type","curated_at" DESC,"id" DESC) WHERE "curated_at" is not null;