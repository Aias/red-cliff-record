ALTER TABLE "index_entries" RENAME TO "indices";--> statement-breakpoint
ALTER TABLE "indices" DROP CONSTRAINT "index_entries_name_sense_main_type_unique";--> statement-breakpoint
ALTER TABLE "indices" DROP CONSTRAINT "index_entries_canonical_page_id_sources_id_fk";
--> statement-breakpoint
ALTER TABLE "indices" DROP CONSTRAINT "index_entries_canonical_media_id_media_id_fk";
--> statement-breakpoint
ALTER TABLE "indices" DROP CONSTRAINT "index_entries_alias_of_index_entries_id_fk";
--> statement-breakpoint
ALTER TABLE "index_relations" DROP CONSTRAINT "index_relations_source_id_index_entries_id_fk";
--> statement-breakpoint
ALTER TABLE "index_relations" DROP CONSTRAINT "index_relations_target_id_index_entries_id_fk";
--> statement-breakpoint
ALTER TABLE "record_categories" DROP CONSTRAINT "record_categories_category_id_index_entries_id_fk";
--> statement-breakpoint
ALTER TABLE "record_creators" DROP CONSTRAINT "record_creators_entity_id_index_entries_id_fk";
--> statement-breakpoint
ALTER TABLE "records" DROP CONSTRAINT "records_format_id_index_entries_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_creators" DROP CONSTRAINT "airtable_creators_index_entry_id_index_entries_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_spaces" DROP CONSTRAINT "airtable_spaces_index_entry_id_index_entries_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."github_users" DROP CONSTRAINT "github_users_index_entry_id_index_entries_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_collections" DROP CONSTRAINT "raindrop_collections_index_entry_id_index_entries_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."twitter_users" DROP CONSTRAINT "twitter_users_index_entry_id_index_entries_id_fk";
--> statement-breakpoint
DROP INDEX "index_entries_main_type_sub_type_index";--> statement-breakpoint
DROP INDEX "index_entries_canonical_page_id_index";--> statement-breakpoint
DROP INDEX "index_entries_canonical_media_id_index";--> statement-breakpoint
ALTER TABLE "indices" ADD CONSTRAINT "indices_canonical_page_id_sources_id_fk" FOREIGN KEY ("canonical_page_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "indices" ADD CONSTRAINT "indices_canonical_media_id_media_id_fk" FOREIGN KEY ("canonical_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "indices" ADD CONSTRAINT "indices_alias_of_indices_id_fk" FOREIGN KEY ("alias_of") REFERENCES "public"."indices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "index_relations" ADD CONSTRAINT "index_relations_source_id_indices_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."indices"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "index_relations" ADD CONSTRAINT "index_relations_target_id_indices_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."indices"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "record_categories" ADD CONSTRAINT "record_categories_category_id_indices_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."indices"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "record_creators" ADD CONSTRAINT "record_creators_entity_id_indices_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."indices"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_format_id_indices_id_fk" FOREIGN KEY ("format_id") REFERENCES "public"."indices"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."airtable_creators" ADD CONSTRAINT "airtable_creators_index_entry_id_indices_id_fk" FOREIGN KEY ("index_entry_id") REFERENCES "public"."indices"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."airtable_spaces" ADD CONSTRAINT "airtable_spaces_index_entry_id_indices_id_fk" FOREIGN KEY ("index_entry_id") REFERENCES "public"."indices"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."github_users" ADD CONSTRAINT "github_users_index_entry_id_indices_id_fk" FOREIGN KEY ("index_entry_id") REFERENCES "public"."indices"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_collections" ADD CONSTRAINT "raindrop_collections_index_entry_id_indices_id_fk" FOREIGN KEY ("index_entry_id") REFERENCES "public"."indices"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."twitter_users" ADD CONSTRAINT "twitter_users_index_entry_id_indices_id_fk" FOREIGN KEY ("index_entry_id") REFERENCES "public"."indices"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "indices_main_type_sub_type_index" ON "indices" USING btree ("main_type","sub_type");--> statement-breakpoint
CREATE INDEX "indices_canonical_page_id_index" ON "indices" USING btree ("canonical_page_id");--> statement-breakpoint
CREATE INDEX "indices_canonical_media_id_index" ON "indices" USING btree ("canonical_media_id");--> statement-breakpoint
ALTER TABLE "indices" ADD CONSTRAINT "indices_name_sense_main_type_unique" UNIQUE("name","sense","main_type");