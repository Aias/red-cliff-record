ALTER TABLE "integrations"."adobe_lightroom_images" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "integrations"."adobe_lightroom_images" ADD COLUMN "record_id" integer;--> statement-breakpoint
ALTER TABLE "integrations"."adobe_lightroom_images" ADD COLUMN "media_id" integer;--> statement-breakpoint
ALTER TABLE "integrations"."airtable_attachments" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "integrations"."airtable_attachments" ADD COLUMN "media_id" integer;--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_raindrops" ADD COLUMN "media_id" integer;--> statement-breakpoint
ALTER TABLE "integrations"."readwise_documents" ADD COLUMN "media_id" integer;--> statement-breakpoint
ALTER TABLE "integrations"."twitter_media" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "integrations"."twitter_media" ADD COLUMN "media_id" integer;--> statement-breakpoint
ALTER TABLE "integrations"."adobe_lightroom_images" ADD CONSTRAINT "adobe_lightroom_images_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."adobe_lightroom_images" ADD CONSTRAINT "adobe_lightroom_images_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."airtable_attachments" ADD CONSTRAINT "airtable_attachments_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_raindrops" ADD CONSTRAINT "raindrop_raindrops_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."readwise_documents" ADD CONSTRAINT "readwise_documents_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."twitter_media" ADD CONSTRAINT "twitter_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "adobe_lightroom_images_archived_at_index" ON "integrations"."adobe_lightroom_images" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "adobe_lightroom_images_record_id_index" ON "integrations"."adobe_lightroom_images" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "adobe_lightroom_images_media_id_index" ON "integrations"."adobe_lightroom_images" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "raindrop_raindrops_media_id_index" ON "integrations"."raindrop_raindrops" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "readwise_documents_media_id_index" ON "integrations"."readwise_documents" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "twitter_media_archived_at_index" ON "integrations"."twitter_media" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "twitter_media_media_id_index" ON "integrations"."twitter_media" USING btree ("media_id");