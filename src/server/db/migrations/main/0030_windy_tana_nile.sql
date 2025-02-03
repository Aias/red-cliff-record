ALTER TABLE "indices" DROP CONSTRAINT "indices_alias_of_indices_id_fk";
--> statement-breakpoint
ALTER TABLE "locations" DROP CONSTRAINT "locations_parent_location_id_locations_id_fk";
--> statement-breakpoint
ALTER TABLE "media" DROP CONSTRAINT "media_version_of_media_id_media_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extracts" DROP CONSTRAINT "airtable_extracts_parent_id_airtable_extracts_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_collections" DROP CONSTRAINT "raindrop_collections_parent_id_raindrop_collections_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."readwise_documents" DROP CONSTRAINT "readwise_documents_parent_id_readwise_documents_id_fk";
--> statement-breakpoint
ALTER TABLE "indices" ADD CONSTRAINT "indices_alias_of_indices_id_fk" FOREIGN KEY ("alias_of") REFERENCES "public"."indices"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_location_id_locations_id_fk" FOREIGN KEY ("parent_location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_version_of_media_id_media_id_fk" FOREIGN KEY ("version_of_media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extracts" ADD CONSTRAINT "airtable_extracts_parent_id_airtable_extracts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "integrations"."airtable_extracts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_collections" ADD CONSTRAINT "raindrop_collections_parent_id_raindrop_collections_id_fk" FOREIGN KEY ("parent_id") REFERENCES "integrations"."raindrop_collections"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."readwise_documents" ADD CONSTRAINT "readwise_documents_parent_id_readwise_documents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "integrations"."readwise_documents"("id") ON DELETE cascade ON UPDATE cascade;