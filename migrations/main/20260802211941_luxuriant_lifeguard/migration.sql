ALTER TABLE "records" ADD COLUMN "text_embedded_at" timestamp with time zone;--> statement-breakpoint
-- A null text_embedded_at means an embedding regeneration is pending; rows
-- whose vector predates the column would otherwise all read as pending.
-- Stamp them with updated_at as the best available approximation.
UPDATE "records"
SET "text_embedded_at" = "updated_at"
WHERE "text_embedding" IS NOT NULL;