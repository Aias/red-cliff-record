CREATE TABLE "raindrop_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"bookmark_id" integer NOT NULL,
	"media_id" integer,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "airtable_attachments" DROP CONSTRAINT "airtable_attachments_extract_id_airtable_extracts_id_fk";
--> statement-breakpoint
ALTER TABLE "raindrop_bookmarks" DROP CONSTRAINT "raindrop_bookmarks_media_id_media_id_fk";
--> statement-breakpoint
DROP INDEX "raindrop_bookmarks_media_id_index";--> statement-breakpoint
ALTER TABLE "airtable_attachments" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "raindrop_images" ADD CONSTRAINT "raindrop_images_bookmark_id_raindrop_bookmarks_id_fk" FOREIGN KEY ("bookmark_id") REFERENCES "public"."raindrop_bookmarks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "raindrop_images" ADD CONSTRAINT "raindrop_images_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "raindrop_images_bookmark_id_index" ON "raindrop_images" USING btree ("bookmark_id");--> statement-breakpoint
CREATE INDEX "raindrop_images_media_id_index" ON "raindrop_images" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "raindrop_images_deleted_at_index" ON "raindrop_images" USING btree ("deleted_at");--> statement-breakpoint
ALTER TABLE "airtable_attachments" ADD CONSTRAINT "airtable_attachments_extract_id_airtable_extracts_id_fk" FOREIGN KEY ("extract_id") REFERENCES "public"."airtable_extracts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "airtable_attachments_media_id_index" ON "airtable_attachments" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "airtable_attachments_deleted_at_index" ON "airtable_attachments" USING btree ("deleted_at");--> statement-breakpoint

-- Insert data from raindrop_bookmarks into raindrop_images where cover_image_url is not null
INSERT INTO "raindrop_images" ("url", "bookmark_id", "media_id", "created_at", "updated_at")
SELECT "cover_image_url", "id", "media_id", "created_at", "updated_at"
FROM "raindrop_bookmarks"
WHERE "cover_image_url" IS NOT NULL;
--> statement-breakpoint

ALTER TABLE "raindrop_bookmarks" DROP COLUMN "cover_image_url";--> statement-breakpoint
ALTER TABLE "raindrop_bookmarks" DROP COLUMN "media_id";