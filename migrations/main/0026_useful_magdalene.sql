ALTER TABLE "media" DROP CONSTRAINT "media_url_unique";--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_url_record_id_unique" UNIQUE("url","record_id");