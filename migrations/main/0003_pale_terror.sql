ALTER TYPE "public"."record_type" ADD VALUE 'media' BEFORE 'abstraction';--> statement-breakpoint
ALTER TABLE "adobe_lightroom_images" RENAME TO "lightroom_images";--> statement-breakpoint
ALTER TABLE "lightroom_images" DROP CONSTRAINT "adobe_lightroom_images_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "lightroom_images" DROP CONSTRAINT "adobe_lightroom_images_record_id_records_id_fk";
--> statement-breakpoint
ALTER TABLE "lightroom_images" DROP CONSTRAINT "adobe_lightroom_images_media_id_media_id_fk";
--> statement-breakpoint
DROP INDEX "adobe_lightroom_images_integration_run_id_index";--> statement-breakpoint
DROP INDEX "adobe_lightroom_images_capture_date_index";--> statement-breakpoint
DROP INDEX "adobe_lightroom_images_record_id_index";--> statement-breakpoint
DROP INDEX "adobe_lightroom_images_media_id_index";--> statement-breakpoint
ALTER TABLE "lightroom_images" ADD CONSTRAINT "lightroom_images_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightroom_images" ADD CONSTRAINT "lightroom_images_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lightroom_images" ADD CONSTRAINT "lightroom_images_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "lightroom_images_integration_run_id_index" ON "lightroom_images" USING btree ("integration_run_id");--> statement-breakpoint
CREATE INDEX "lightroom_images_capture_date_index" ON "lightroom_images" USING btree ("capture_date");--> statement-breakpoint
CREATE INDEX "lightroom_images_record_id_index" ON "lightroom_images" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "lightroom_images_media_id_index" ON "lightroom_images" USING btree ("media_id");--> statement-breakpoint
ALTER TABLE "media" DROP COLUMN "title";