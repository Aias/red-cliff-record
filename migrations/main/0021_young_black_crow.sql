ALTER TABLE "records_temp" RENAME TO "records";--> statement-breakpoint
ALTER TABLE "lightroom_images" DROP CONSTRAINT "lightroom_images_record_id_records_temp_id_fk";
--> statement-breakpoint
ALTER TABLE "airtable_creators" DROP CONSTRAINT "airtable_creators_record_id_records_temp_id_fk";
--> statement-breakpoint
ALTER TABLE "airtable_extracts" DROP CONSTRAINT "airtable_extracts_record_id_records_temp_id_fk";
--> statement-breakpoint
ALTER TABLE "airtable_formats" DROP CONSTRAINT "airtable_formats_record_id_records_temp_id_fk";
--> statement-breakpoint
ALTER TABLE "airtable_spaces" DROP CONSTRAINT "airtable_spaces_record_id_records_temp_id_fk";
--> statement-breakpoint
ALTER TABLE "github_repositories" DROP CONSTRAINT "github_repositories_record_id_records_temp_id_fk";
--> statement-breakpoint
ALTER TABLE "github_users" DROP CONSTRAINT "github_users_record_id_records_temp_id_fk";
--> statement-breakpoint
ALTER TABLE "media" DROP CONSTRAINT "media_record_id_records_temp_id_fk";
--> statement-breakpoint
ALTER TABLE "raindrop_bookmarks" DROP CONSTRAINT "raindrop_bookmarks_record_id_records_temp_id_fk";
--> statement-breakpoint
ALTER TABLE "raindrop_collections" DROP CONSTRAINT "raindrop_collections_record_id_records_temp_id_fk";
--> statement-breakpoint
ALTER TABLE "raindrop_tags" DROP CONSTRAINT "raindrop_tags_record_id_records_temp_id_fk";
--> statement-breakpoint
ALTER TABLE "readwise_authors" DROP CONSTRAINT "readwise_authors_record_id_records_temp_id_fk";
--> statement-breakpoint
ALTER TABLE "readwise_documents" DROP CONSTRAINT "readwise_documents_record_id_records_temp_id_fk";
--> statement-breakpoint
ALTER TABLE "readwise_tags" DROP CONSTRAINT "readwise_tags_record_id_records_temp_id_fk";
--> statement-breakpoint
ALTER TABLE "record_categories" DROP CONSTRAINT "record_categories_record_id_records_temp_id_fk";
--> statement-breakpoint
ALTER TABLE "record_categories" DROP CONSTRAINT "record_categories_category_id_records_temp_id_fk";
--> statement-breakpoint
ALTER TABLE "record_creators" DROP CONSTRAINT "record_creators_record_id_records_temp_id_fk";
--> statement-breakpoint
ALTER TABLE "record_creators" DROP CONSTRAINT "record_creators_creator_id_records_temp_id_fk";
--> statement-breakpoint
ALTER TABLE "record_relations" DROP CONSTRAINT "record_relations_source_id_records_temp_id_fk";
--> statement-breakpoint
ALTER TABLE "record_relations" DROP CONSTRAINT "record_relations_target_id_records_temp_id_fk";
--> statement-breakpoint
ALTER TABLE "records" DROP CONSTRAINT "records_temp_parent_id_records_temp_id_fk";
--> statement-breakpoint
ALTER TABLE "records" DROP CONSTRAINT "records_temp_transclude_id_records_temp_id_fk";
--> statement-breakpoint
ALTER TABLE "twitter_tweets" DROP CONSTRAINT "twitter_tweets_record_id_records_temp_id_fk";
--> statement-breakpoint
ALTER TABLE "twitter_users" DROP CONSTRAINT "twitter_users_record_id_records_temp_id_fk";
--> statement-breakpoint
DROP INDEX "idx_records_content_search";--> statement-breakpoint
ALTER TABLE "lightroom_images" ADD CONSTRAINT "lightroom_images_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "airtable_creators" ADD CONSTRAINT "airtable_creators_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "airtable_extracts" ADD CONSTRAINT "airtable_extracts_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "airtable_formats" ADD CONSTRAINT "airtable_formats_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "airtable_spaces" ADD CONSTRAINT "airtable_spaces_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD CONSTRAINT "github_repositories_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "github_users" ADD CONSTRAINT "github_users_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "raindrop_bookmarks" ADD CONSTRAINT "raindrop_bookmarks_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "raindrop_collections" ADD CONSTRAINT "raindrop_collections_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "raindrop_tags" ADD CONSTRAINT "raindrop_tags_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "readwise_authors" ADD CONSTRAINT "readwise_authors_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "readwise_documents" ADD CONSTRAINT "readwise_documents_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "readwise_tags" ADD CONSTRAINT "readwise_tags_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "record_categories" ADD CONSTRAINT "record_categories_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "record_categories" ADD CONSTRAINT "record_categories_category_id_records_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "record_creators" ADD CONSTRAINT "record_creators_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "record_creators" ADD CONSTRAINT "record_creators_creator_id_records_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "record_relations" ADD CONSTRAINT "record_relations_source_id_records_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "record_relations" ADD CONSTRAINT "record_relations_target_id_records_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_parent_id_records_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_transclude_id_records_id_fk" FOREIGN KEY ("transclude_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "twitter_tweets" ADD CONSTRAINT "twitter_tweets_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "twitter_users" ADD CONSTRAINT "twitter_users_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_media_content_search" ON "media" USING gin ("caption" gin_trgm_ops, "alt_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "records_type_title_url_index" ON "records" USING btree ("type","title","url");--> statement-breakpoint
CREATE INDEX "records_parent_id_index" ON "records" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "records_transclude_id_index" ON "records" USING btree ("transclude_id");--> statement-breakpoint
CREATE INDEX "idx_records_content_search" ON "records" USING gin ("title" gin_trgm_ops, "abbreviation" gin_trgm_ops, "sense" gin_trgm_ops, "url" gin_trgm_ops, "summary" gin_trgm_ops, "content" gin_trgm_ops, "notes" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "records_rating_index" ON "records" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "records_is_index_node_index" ON "records" USING btree ("is_index_node");--> statement-breakpoint
CREATE INDEX "records_is_private_index" ON "records" USING btree ("is_private");--> statement-breakpoint
CREATE INDEX "records_needs_curation_index" ON "records" USING btree ("needs_curation");