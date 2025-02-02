ALTER TYPE "public"."media_format" RENAME TO "media_type";--> statement-breakpoint
ALTER TABLE "media" RENAME COLUMN "mime_type" TO "content_type_string";--> statement-breakpoint
DROP INDEX "media_mime_type_index";--> statement-breakpoint
ALTER TABLE "media" ALTER COLUMN "format" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "media" ALTER COLUMN "format" SET DEFAULT 'octet-stream';--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "type" "media_type" DEFAULT 'application' NOT NULL;--> statement-breakpoint
CREATE INDEX "media_type_index" ON "media" USING btree ("type");