DROP INDEX "integrations"."airtable_creator_archived_at_idx";

--> statement-breakpoint
DROP INDEX "integrations"."airtable_creator_index_entry_id_idx";

--> statement-breakpoint
DROP INDEX "integrations"."airtable_extract_archived_at_idx";

--> statement-breakpoint
DROP INDEX "integrations"."airtable_extract_record_id_idx";

--> statement-breakpoint
DROP INDEX "integrations"."airtable_space_archived_at_idx";

--> statement-breakpoint
DROP INDEX "integrations"."airtable_space_index_entry_id_idx";

--> statement-breakpoint
ALTER TABLE "integrations"."github_repositories"
ADD COLUMN "archived_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."github_repositories"
ADD COLUMN "record_id" integer;

--> statement-breakpoint
ALTER TABLE "integrations"."github_users"
ADD COLUMN "archived_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."github_users"
ADD COLUMN "index_entry_id" integer;

--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_raindrops"
ADD COLUMN "archived_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_raindrops"
ADD COLUMN "record_id" integer;

--> statement-breakpoint
ALTER TABLE "integrations"."readwise_documents"
ADD COLUMN "archived_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."readwise_documents"
ADD COLUMN "record_id" integer;

--> statement-breakpoint
ALTER TABLE "integrations"."twitter_tweets"
ADD COLUMN "archived_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."twitter_tweets"
ADD COLUMN "record_id" integer;

--> statement-breakpoint
ALTER TABLE "integrations"."twitter_users"
ADD COLUMN "archived_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."twitter_users"
ADD COLUMN "index_entry_id" integer;

--> statement-breakpoint
ALTER TABLE "integrations"."github_repositories" ADD CONSTRAINT "github_repositories_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records" ("id") ON DELETE set null ON UPDATE cascade;

--> statement-breakpoint
ALTER TABLE "integrations"."github_users" ADD CONSTRAINT "github_users_index_entry_id_index_entries_id_fk" FOREIGN KEY ("index_entry_id") REFERENCES "public"."index_entries" ("id") ON DELETE set null ON UPDATE cascade;

--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_raindrops" ADD CONSTRAINT "raindrop_raindrops_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records" ("id") ON DELETE set null ON UPDATE cascade;

--> statement-breakpoint
ALTER TABLE "integrations"."readwise_documents" ADD CONSTRAINT "readwise_documents_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records" ("id") ON DELETE set null ON UPDATE cascade;

--> statement-breakpoint
ALTER TABLE "integrations"."twitter_tweets" ADD CONSTRAINT "twitter_tweets_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records" ("id") ON DELETE set null ON UPDATE cascade;

--> statement-breakpoint
ALTER TABLE "integrations"."twitter_users" ADD CONSTRAINT "twitter_users_index_entry_id_index_entries_id_fk" FOREIGN KEY ("index_entry_id") REFERENCES "public"."index_entries" ("id") ON DELETE set null ON UPDATE cascade;

--> statement-breakpoint
CREATE INDEX "airtable_creators_archived_at_index" ON "integrations"."airtable_creators" USING btree ("archived_at");

--> statement-breakpoint
CREATE INDEX "airtable_creators_index_entry_id_index" ON "integrations"."airtable_creators" USING btree ("index_entry_id");

--> statement-breakpoint
CREATE INDEX "airtable_extracts_archived_at_index" ON "integrations"."airtable_extracts" USING btree ("archived_at");

--> statement-breakpoint
CREATE INDEX "airtable_extracts_record_id_index" ON "integrations"."airtable_extracts" USING btree ("record_id");

--> statement-breakpoint
CREATE INDEX "airtable_spaces_archived_at_index" ON "integrations"."airtable_spaces" USING btree ("archived_at");

--> statement-breakpoint
CREATE INDEX "airtable_spaces_index_entry_id_index" ON "integrations"."airtable_spaces" USING btree ("index_entry_id");

--> statement-breakpoint
CREATE INDEX "github_repositories_archived_at_index" ON "integrations"."github_repositories" USING btree ("archived_at");

--> statement-breakpoint
CREATE INDEX "github_repositories_record_id_index" ON "integrations"."github_repositories" USING btree ("record_id");

--> statement-breakpoint
CREATE INDEX "github_users_archived_at_index" ON "integrations"."github_users" USING btree ("archived_at");

--> statement-breakpoint
CREATE INDEX "github_users_index_entry_id_index" ON "integrations"."github_users" USING btree ("index_entry_id");

--> statement-breakpoint
CREATE INDEX "raindrop_raindrops_archived_at_index" ON "integrations"."raindrop_raindrops" USING btree ("archived_at");

--> statement-breakpoint
CREATE INDEX "raindrop_raindrops_record_id_index" ON "integrations"."raindrop_raindrops" USING btree ("record_id");

--> statement-breakpoint
CREATE INDEX "readwise_documents_archived_at_index" ON "integrations"."readwise_documents" USING btree ("archived_at");

--> statement-breakpoint
CREATE INDEX "readwise_documents_record_id_index" ON "integrations"."readwise_documents" USING btree ("record_id");

--> statement-breakpoint
CREATE INDEX "twitter_tweets_archived_at_index" ON "integrations"."twitter_tweets" USING btree ("archived_at");

--> statement-breakpoint
CREATE INDEX "twitter_tweets_record_id_index" ON "integrations"."twitter_tweets" USING btree ("record_id");

--> statement-breakpoint
CREATE INDEX "twitter_users_archived_at_index" ON "integrations"."twitter_users" USING btree ("archived_at");

--> statement-breakpoint
CREATE INDEX "twitter_users_index_entry_id_index" ON "integrations"."twitter_users" USING btree ("index_entry_id");