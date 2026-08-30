ALTER TABLE "records" ADD COLUMN "curated_at" timestamp with time zone;--> statement-breakpoint
UPDATE "records" SET "curated_at" = "updated_at" WHERE "is_curated" = true;