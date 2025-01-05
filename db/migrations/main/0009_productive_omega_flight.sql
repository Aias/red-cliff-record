--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_raindrops"
RENAME TO "raindrop_bookmarks";

ALTER TABLE "integrations"."raindrop_bookmarks"
DROP CONSTRAINT "raindrop_raindrops_link_url_created_at_unique";

--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_bookmarks"
DROP CONSTRAINT "raindrop_raindrops_collection_id_raindrop_collections_id_fk";

--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_bookmarks"
DROP CONSTRAINT "raindrop_raindrops_integration_run_id_integration_runs_id_fk";

--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_bookmarks"
DROP CONSTRAINT "raindrop_raindrops_record_id_records_id_fk";

--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_bookmarks"
DROP CONSTRAINT "raindrop_raindrops_media_id_media_id_fk";

--> statement-breakpoint
DROP INDEX "integrations"."raindrop_raindrops_integration_run_id_index";

--> statement-breakpoint
DROP INDEX "integrations"."raindrop_raindrops_link_url_index";

--> statement-breakpoint
DROP INDEX "integrations"."raindrop_raindrops_created_at_index";

--> statement-breakpoint
DROP INDEX "integrations"."raindrop_raindrops_archived_at_index";

--> statement-breakpoint
DROP INDEX "integrations"."raindrop_raindrops_record_id_index";

--> statement-breakpoint
DROP INDEX "integrations"."raindrop_raindrops_media_id_index";

--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_bookmarks" ADD CONSTRAINT "raindrop_bookmarks_collection_id_raindrop_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "integrations"."raindrop_collections" ("id") ON DELETE set null ON UPDATE cascade;

--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_bookmarks" ADD CONSTRAINT "raindrop_bookmarks_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "operations"."integration_runs" ("id") ON DELETE no action ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_bookmarks" ADD CONSTRAINT "raindrop_bookmarks_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records" ("id") ON DELETE set null ON UPDATE cascade;

--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_bookmarks" ADD CONSTRAINT "raindrop_bookmarks_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media" ("id") ON DELETE set null ON UPDATE cascade;

--> statement-breakpoint
CREATE INDEX "raindrop_bookmarks_integration_run_id_index" ON "integrations"."raindrop_bookmarks" USING btree ("integration_run_id");

--> statement-breakpoint
CREATE INDEX "raindrop_bookmarks_link_url_index" ON "integrations"."raindrop_bookmarks" USING btree ("link_url");

--> statement-breakpoint
CREATE INDEX "raindrop_bookmarks_created_at_index" ON "integrations"."raindrop_bookmarks" USING btree ("created_at");

--> statement-breakpoint
CREATE INDEX "raindrop_bookmarks_archived_at_index" ON "integrations"."raindrop_bookmarks" USING btree ("archived_at");

--> statement-breakpoint
CREATE INDEX "raindrop_bookmarks_record_id_index" ON "integrations"."raindrop_bookmarks" USING btree ("record_id");

--> statement-breakpoint
CREATE INDEX "raindrop_bookmarks_media_id_index" ON "integrations"."raindrop_bookmarks" USING btree ("media_id");

--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_bookmarks" ADD CONSTRAINT "raindrop_bookmarks_link_url_created_at_unique" UNIQUE ("link_url", "created_at");