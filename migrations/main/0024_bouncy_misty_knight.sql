DROP INDEX "idx_media_content_search";--> statement-breakpoint
DROP INDEX "idx_records_content_search";--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "media_caption" text;--> statement-breakpoint
CREATE INDEX "idx_records_content_search" ON "records" USING gin ("title" gin_trgm_ops,"abbreviation" gin_trgm_ops,"sense" gin_trgm_ops,"url" gin_trgm_ops,"summary" gin_trgm_ops,"content" gin_trgm_ops,"notes" gin_trgm_ops,"media_caption" gin_trgm_ops);--> statement-breakpoint
ALTER TABLE "media" DROP COLUMN "caption";