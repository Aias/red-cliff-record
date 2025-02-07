ALTER TABLE "raindrop_bookmark_tags" ALTER COLUMN "bookmark_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "raindrop_bookmark_tags" ALTER COLUMN "tag_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "summary" text;