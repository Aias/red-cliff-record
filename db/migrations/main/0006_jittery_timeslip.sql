ALTER TABLE "index_entries" DROP CONSTRAINT "index_entry_idx";--> statement-breakpoint
ALTER TABLE "index_relations" DROP CONSTRAINT "index_relation_unique_idx";--> statement-breakpoint
ALTER TABLE "locations" DROP CONSTRAINT "location_name_type_parent_idx";--> statement-breakpoint
ALTER TABLE "media" DROP CONSTRAINT "media_url_idx";--> statement-breakpoint
ALTER TABLE "record_categories" DROP CONSTRAINT "record_category_unique_idx";--> statement-breakpoint
ALTER TABLE "record_creators" DROP CONSTRAINT "record_creator_unique_idx";--> statement-breakpoint
ALTER TABLE "record_media" DROP CONSTRAINT "record_media_unique_idx";--> statement-breakpoint
ALTER TABLE "record_relations" DROP CONSTRAINT "record_relation_unique_idx";--> statement-breakpoint
ALTER TABLE "record_sources" DROP CONSTRAINT "record_source_unique_idx";--> statement-breakpoint
ALTER TABLE "source_connections" DROP CONSTRAINT "source_connection_unique_idx";--> statement-breakpoint
ALTER TABLE "sources" DROP CONSTRAINT "source_url_idx";--> statement-breakpoint
ALTER TABLE "index_entries" DROP CONSTRAINT "index_entries_canonical_page_id_sources_id_fk";
--> statement-breakpoint
ALTER TABLE "index_entries" DROP CONSTRAINT "index_entries_canonical_media_id_media_id_fk";
--> statement-breakpoint
ALTER TABLE "index_relations" DROP CONSTRAINT "index_relations_source_id_index_entries_id_fk";
--> statement-breakpoint
ALTER TABLE "index_relations" DROP CONSTRAINT "index_relations_target_id_index_entries_id_fk";
--> statement-breakpoint
ALTER TABLE "locations" DROP CONSTRAINT "locations_map_page_id_sources_id_fk";
--> statement-breakpoint
ALTER TABLE "locations" DROP CONSTRAINT "locations_map_image_id_media_id_fk";
--> statement-breakpoint
ALTER TABLE "media" DROP CONSTRAINT "media_source_page_id_sources_id_fk";
--> statement-breakpoint
ALTER TABLE "record_categories" DROP CONSTRAINT "record_categories_record_id_records_id_fk";
--> statement-breakpoint
ALTER TABLE "record_categories" DROP CONSTRAINT "record_categories_category_id_index_entries_id_fk";
--> statement-breakpoint
ALTER TABLE "record_creators" DROP CONSTRAINT "record_creators_record_id_records_id_fk";
--> statement-breakpoint
ALTER TABLE "record_creators" DROP CONSTRAINT "record_creators_entity_id_index_entries_id_fk";
--> statement-breakpoint
ALTER TABLE "record_media" DROP CONSTRAINT "record_media_record_id_records_id_fk";
--> statement-breakpoint
ALTER TABLE "record_media" DROP CONSTRAINT "record_media_media_id_media_id_fk";
--> statement-breakpoint
ALTER TABLE "record_relations" DROP CONSTRAINT "record_relations_source_id_records_id_fk";
--> statement-breakpoint
ALTER TABLE "record_relations" DROP CONSTRAINT "record_relations_target_id_records_id_fk";
--> statement-breakpoint
ALTER TABLE "record_sources" DROP CONSTRAINT "record_sources_record_id_records_id_fk";
--> statement-breakpoint
ALTER TABLE "record_sources" DROP CONSTRAINT "record_sources_source_id_sources_id_fk";
--> statement-breakpoint
ALTER TABLE "record_timepoints" DROP CONSTRAINT "record_timepoints_record_id_records_id_fk";
--> statement-breakpoint
ALTER TABLE "record_timepoints" DROP CONSTRAINT "record_timepoints_timepoint_id_timepoints_id_fk";
--> statement-breakpoint
ALTER TABLE "records" DROP CONSTRAINT "records_format_id_index_entries_id_fk";
--> statement-breakpoint
ALTER TABLE "records" DROP CONSTRAINT "records_location_id_locations_id_fk";
--> statement-breakpoint
ALTER TABLE "source_connections" DROP CONSTRAINT "source_connections_from_source_id_sources_id_fk";
--> statement-breakpoint
ALTER TABLE "source_connections" DROP CONSTRAINT "source_connections_to_source_id_sources_id_fk";
--> statement-breakpoint
ALTER TABLE "source_contents" DROP CONSTRAINT "source_contents_source_id_sources_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_attachments" DROP CONSTRAINT "airtable_attachments_extract_id_airtable_extracts_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_connections" DROP CONSTRAINT "airtable_extract_connections_from_extract_id_airtable_extracts_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_connections" DROP CONSTRAINT "airtable_extract_connections_to_extract_id_airtable_extracts_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_creators" DROP CONSTRAINT "airtable_extract_creators_extract_id_airtable_extracts_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_creators" DROP CONSTRAINT "airtable_extract_creators_creator_id_airtable_creators_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_spaces" DROP CONSTRAINT "airtable_extract_spaces_extract_id_airtable_extracts_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_spaces" DROP CONSTRAINT "airtable_extract_spaces_space_id_airtable_spaces_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."github_commit_changes" DROP CONSTRAINT "github_commit_changes_commit_id_github_commits_node_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."github_commits" DROP CONSTRAINT "github_commits_repository_id_github_repositories_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."github_repositories" DROP CONSTRAINT "github_repositories_owner_id_github_users_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_raindrops" DROP CONSTRAINT "raindrop_raindrops_collection_id_raindrop_collections_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."twitter_media" DROP CONSTRAINT "twitter_media_tweet_id_twitter_tweets_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."twitter_tweets" DROP CONSTRAINT "twitter_tweets_user_id_twitter_users_id_fk";
--> statement-breakpoint
DROP INDEX "type_subtype_idx";--> statement-breakpoint
DROP INDEX "canonical_page_idx";--> statement-breakpoint
DROP INDEX "canonical_media_idx";--> statement-breakpoint
DROP INDEX "location_map_page_idx";--> statement-breakpoint
DROP INDEX "location_map_image_idx";--> statement-breakpoint
DROP INDEX "location_type_idx";--> statement-breakpoint
DROP INDEX "location_parent_idx";--> statement-breakpoint
DROP INDEX "media_format_idx";--> statement-breakpoint
DROP INDEX "media_mime_type_idx";--> statement-breakpoint
DROP INDEX "media_source_idx";--> statement-breakpoint
DROP INDEX "media_version_idx";--> statement-breakpoint
DROP INDEX "record_category_record_idx";--> statement-breakpoint
DROP INDEX "record_category_category_idx";--> statement-breakpoint
DROP INDEX "record_creator_record_idx";--> statement-breakpoint
DROP INDEX "record_creator_entity_idx";--> statement-breakpoint
DROP INDEX "record_media_record_idx";--> statement-breakpoint
DROP INDEX "record_media_media_idx";--> statement-breakpoint
DROP INDEX "record_relation_source_idx";--> statement-breakpoint
DROP INDEX "record_relation_target_idx";--> statement-breakpoint
DROP INDEX "record_source_record_idx";--> statement-breakpoint
DROP INDEX "record_source_source_idx";--> statement-breakpoint
DROP INDEX "record_timepoint_record_idx";--> statement-breakpoint
DROP INDEX "record_timepoint_timepoint_idx";--> statement-breakpoint
DROP INDEX "record_type_idx";--> statement-breakpoint
DROP INDEX "record_format_idx";--> statement-breakpoint
DROP INDEX "record_location_idx";--> statement-breakpoint
DROP INDEX "source_connection_source_idx";--> statement-breakpoint
DROP INDEX "source_connection_target_idx";--> statement-breakpoint
DROP INDEX "source_content_source_idx";--> statement-breakpoint
DROP INDEX "source_domain_idx";--> statement-breakpoint
DROP INDEX "crawl_status_idx";--> statement-breakpoint
DROP INDEX "timepoint_start_date_idx";--> statement-breakpoint
DROP INDEX "timepoint_start_instant_idx";--> statement-breakpoint
DROP INDEX "timepoint_start_granularity_idx";--> statement-breakpoint
DROP INDEX "timepoint_end_date_idx";--> statement-breakpoint
DROP INDEX "timepoint_end_instant_idx";--> statement-breakpoint
DROP INDEX "timepoint_end_granularity_idx";--> statement-breakpoint
ALTER TABLE "integrations"."twitter_tweets" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "index_entries" ADD CONSTRAINT "index_entries_canonical_page_id_sources_id_fk" FOREIGN KEY ("canonical_page_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "index_entries" ADD CONSTRAINT "index_entries_canonical_media_id_media_id_fk" FOREIGN KEY ("canonical_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "index_relations" ADD CONSTRAINT "index_relations_source_id_index_entries_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."index_entries"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "index_relations" ADD CONSTRAINT "index_relations_target_id_index_entries_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."index_entries"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_map_page_id_sources_id_fk" FOREIGN KEY ("map_page_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_map_image_id_media_id_fk" FOREIGN KEY ("map_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_source_page_id_sources_id_fk" FOREIGN KEY ("source_page_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "record_categories" ADD CONSTRAINT "record_categories_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "record_categories" ADD CONSTRAINT "record_categories_category_id_index_entries_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."index_entries"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "record_creators" ADD CONSTRAINT "record_creators_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "record_creators" ADD CONSTRAINT "record_creators_entity_id_index_entries_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."index_entries"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "record_media" ADD CONSTRAINT "record_media_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "record_media" ADD CONSTRAINT "record_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "record_relations" ADD CONSTRAINT "record_relations_source_id_records_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "record_relations" ADD CONSTRAINT "record_relations_target_id_records_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "record_sources" ADD CONSTRAINT "record_sources_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "record_sources" ADD CONSTRAINT "record_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "record_timepoints" ADD CONSTRAINT "record_timepoints_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "record_timepoints" ADD CONSTRAINT "record_timepoints_timepoint_id_timepoints_id_fk" FOREIGN KEY ("timepoint_id") REFERENCES "public"."timepoints"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_format_id_index_entries_id_fk" FOREIGN KEY ("format_id") REFERENCES "public"."index_entries"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "source_connections" ADD CONSTRAINT "source_connections_from_source_id_sources_id_fk" FOREIGN KEY ("from_source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "source_connections" ADD CONSTRAINT "source_connections_to_source_id_sources_id_fk" FOREIGN KEY ("to_source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "source_contents" ADD CONSTRAINT "source_contents_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."airtable_attachments" ADD CONSTRAINT "airtable_attachments_extract_id_airtable_extracts_id_fk" FOREIGN KEY ("extract_id") REFERENCES "integrations"."airtable_extracts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_connections" ADD CONSTRAINT "airtable_extract_connections_from_extract_id_airtable_extracts_id_fk" FOREIGN KEY ("from_extract_id") REFERENCES "integrations"."airtable_extracts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_connections" ADD CONSTRAINT "airtable_extract_connections_to_extract_id_airtable_extracts_id_fk" FOREIGN KEY ("to_extract_id") REFERENCES "integrations"."airtable_extracts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_creators" ADD CONSTRAINT "airtable_extract_creators_extract_id_airtable_extracts_id_fk" FOREIGN KEY ("extract_id") REFERENCES "integrations"."airtable_extracts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_creators" ADD CONSTRAINT "airtable_extract_creators_creator_id_airtable_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "integrations"."airtable_creators"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_spaces" ADD CONSTRAINT "airtable_extract_spaces_extract_id_airtable_extracts_id_fk" FOREIGN KEY ("extract_id") REFERENCES "integrations"."airtable_extracts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extract_spaces" ADD CONSTRAINT "airtable_extract_spaces_space_id_airtable_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "integrations"."airtable_spaces"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."github_commit_changes" ADD CONSTRAINT "github_commit_changes_commit_id_github_commits_node_id_fk" FOREIGN KEY ("commit_id") REFERENCES "integrations"."github_commits"("node_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."github_commits" ADD CONSTRAINT "github_commits_repository_id_github_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "integrations"."github_repositories"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."github_repositories" ADD CONSTRAINT "github_repositories_owner_id_github_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "integrations"."github_users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_raindrops" ADD CONSTRAINT "raindrop_raindrops_collection_id_raindrop_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "integrations"."raindrop_collections"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."twitter_media" ADD CONSTRAINT "twitter_media_tweet_id_twitter_tweets_id_fk" FOREIGN KEY ("tweet_id") REFERENCES "integrations"."twitter_tweets"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."twitter_tweets" ADD CONSTRAINT "twitter_tweets_user_id_twitter_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "integrations"."twitter_users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "index_entries_main_type_sub_type_index" ON "index_entries" USING btree ("main_type","sub_type");--> statement-breakpoint
CREATE INDEX "index_entries_canonical_page_id_index" ON "index_entries" USING btree ("canonical_page_id");--> statement-breakpoint
CREATE INDEX "index_entries_canonical_media_id_index" ON "index_entries" USING btree ("canonical_media_id");--> statement-breakpoint
CREATE INDEX "locations_map_page_id_index" ON "locations" USING btree ("map_page_id");--> statement-breakpoint
CREATE INDEX "locations_map_image_id_index" ON "locations" USING btree ("map_image_id");--> statement-breakpoint
CREATE INDEX "locations_location_type_index" ON "locations" USING btree ("location_type");--> statement-breakpoint
CREATE INDEX "locations_parent_location_id_index" ON "locations" USING btree ("parent_location_id");--> statement-breakpoint
CREATE INDEX "media_format_index" ON "media" USING btree ("format");--> statement-breakpoint
CREATE INDEX "media_mime_type_index" ON "media" USING btree ("mime_type");--> statement-breakpoint
CREATE INDEX "media_source_page_id_index" ON "media" USING btree ("source_page_id");--> statement-breakpoint
CREATE INDEX "media_version_of_media_id_index" ON "media" USING btree ("version_of_media_id");--> statement-breakpoint
CREATE INDEX "record_categories_record_id_index" ON "record_categories" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "record_categories_category_id_index" ON "record_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "record_creators_record_id_index" ON "record_creators" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "record_creators_entity_id_index" ON "record_creators" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "record_media_record_id_index" ON "record_media" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "record_media_media_id_index" ON "record_media" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "record_relations_source_id_index" ON "record_relations" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "record_relations_target_id_index" ON "record_relations" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "record_sources_record_id_index" ON "record_sources" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "record_sources_source_id_index" ON "record_sources" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "record_timepoints_record_id_index" ON "record_timepoints" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "record_timepoints_timepoint_id_index" ON "record_timepoints" USING btree ("timepoint_id");--> statement-breakpoint
CREATE INDEX "records_type_index" ON "records" USING btree ("type");--> statement-breakpoint
CREATE INDEX "records_format_id_index" ON "records" USING btree ("format_id");--> statement-breakpoint
CREATE INDEX "records_location_id_index" ON "records" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "source_connections_from_source_id_index" ON "source_connections" USING btree ("from_source_id");--> statement-breakpoint
CREATE INDEX "source_connections_to_source_id_index" ON "source_connections" USING btree ("to_source_id");--> statement-breakpoint
CREATE INDEX "source_contents_source_id_index" ON "source_contents" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "sources_domain_index" ON "sources" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "sources_last_crawl_date_last_http_status_index" ON "sources" USING btree ("last_crawl_date","last_http_status");--> statement-breakpoint
CREATE INDEX "timepoints_start_date_index" ON "timepoints" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "timepoints_start_instant_index" ON "timepoints" USING btree ("start_instant");--> statement-breakpoint
CREATE INDEX "timepoints_start_granularity_index" ON "timepoints" USING btree ("start_granularity");--> statement-breakpoint
CREATE INDEX "timepoints_end_date_index" ON "timepoints" USING btree ("end_date");--> statement-breakpoint
CREATE INDEX "timepoints_end_instant_index" ON "timepoints" USING btree ("end_instant");--> statement-breakpoint
CREATE INDEX "timepoints_end_granularity_index" ON "timepoints" USING btree ("end_granularity");--> statement-breakpoint
ALTER TABLE "index_entries" ADD CONSTRAINT "index_entries_name_sense_main_type_unique" UNIQUE("name","sense","main_type");--> statement-breakpoint
ALTER TABLE "index_relations" ADD CONSTRAINT "index_relations_source_id_target_id_type_unique" UNIQUE("source_id","target_id","type");--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_name_location_type_parent_location_id_unique" UNIQUE("name","location_type","parent_location_id");--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_url_unique" UNIQUE("url");--> statement-breakpoint
ALTER TABLE "record_categories" ADD CONSTRAINT "record_categories_record_id_category_id_type_unique" UNIQUE("record_id","category_id","type");--> statement-breakpoint
ALTER TABLE "record_creators" ADD CONSTRAINT "record_creators_record_id_entity_id_role_unique" UNIQUE("record_id","entity_id","role");--> statement-breakpoint
ALTER TABLE "record_media" ADD CONSTRAINT "record_media_record_id_media_id_unique" UNIQUE("record_id","media_id");--> statement-breakpoint
ALTER TABLE "record_relations" ADD CONSTRAINT "record_relations_source_id_target_id_type_unique" UNIQUE("source_id","target_id","type");--> statement-breakpoint
ALTER TABLE "record_sources" ADD CONSTRAINT "record_sources_record_id_source_id_unique" UNIQUE("record_id","source_id");--> statement-breakpoint
ALTER TABLE "source_connections" ADD CONSTRAINT "source_connections_from_source_id_to_source_id_unique" UNIQUE("from_source_id","to_source_id");--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_url_unique" UNIQUE("url");