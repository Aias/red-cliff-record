ALTER TABLE "integrations"."raindrop_collections" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_collections" ADD COLUMN "index_entry_id" integer;--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_collections" ADD CONSTRAINT "raindrop_collections_index_entry_id_index_entries_id_fk" FOREIGN KEY ("index_entry_id") REFERENCES "public"."index_entries"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "raindrop_collections_archived_at_index" ON "integrations"."raindrop_collections" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "raindrop_collections_index_entry_id_index" ON "integrations"."raindrop_collections" USING btree ("index_entry_id");