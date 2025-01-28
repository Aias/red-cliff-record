ALTER TABLE "integrations"."airtable_creators" ADD COLUMN "embedding_id" integer;--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extracts" ADD COLUMN "embedding_id" integer;--> statement-breakpoint
ALTER TABLE "integrations"."airtable_spaces" ADD COLUMN "embedding_id" integer;--> statement-breakpoint
ALTER TABLE "integrations"."github_repositories" ADD COLUMN "embedding_id" integer;--> statement-breakpoint
ALTER TABLE "integrations"."github_users" ADD COLUMN "embedding_id" integer;--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_bookmarks" ADD COLUMN "embedding_id" integer;--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_collections" ADD COLUMN "embedding_id" integer;--> statement-breakpoint
ALTER TABLE "integrations"."twitter_tweets" ADD COLUMN "embedding_id" integer;--> statement-breakpoint
ALTER TABLE "integrations"."twitter_users" ADD COLUMN "embedding_id" integer;--> statement-breakpoint
ALTER TABLE "integrations"."airtable_creators" ADD CONSTRAINT "airtable_creators_embedding_id_embeddings_id_fk" FOREIGN KEY ("embedding_id") REFERENCES "public"."embeddings"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extracts" ADD CONSTRAINT "airtable_extracts_embedding_id_embeddings_id_fk" FOREIGN KEY ("embedding_id") REFERENCES "public"."embeddings"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."airtable_spaces" ADD CONSTRAINT "airtable_spaces_embedding_id_embeddings_id_fk" FOREIGN KEY ("embedding_id") REFERENCES "public"."embeddings"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."github_repositories" ADD CONSTRAINT "github_repositories_embedding_id_embeddings_id_fk" FOREIGN KEY ("embedding_id") REFERENCES "public"."embeddings"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."github_users" ADD CONSTRAINT "github_users_embedding_id_embeddings_id_fk" FOREIGN KEY ("embedding_id") REFERENCES "public"."embeddings"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_bookmarks" ADD CONSTRAINT "raindrop_bookmarks_embedding_id_embeddings_id_fk" FOREIGN KEY ("embedding_id") REFERENCES "public"."embeddings"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_collections" ADD CONSTRAINT "raindrop_collections_embedding_id_embeddings_id_fk" FOREIGN KEY ("embedding_id") REFERENCES "public"."embeddings"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."twitter_tweets" ADD CONSTRAINT "twitter_tweets_embedding_id_embeddings_id_fk" FOREIGN KEY ("embedding_id") REFERENCES "public"."embeddings"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."twitter_users" ADD CONSTRAINT "twitter_users_embedding_id_embeddings_id_fk" FOREIGN KEY ("embedding_id") REFERENCES "public"."embeddings"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "airtable_creators_embedding_id_index" ON "integrations"."airtable_creators" USING btree ("embedding_id");--> statement-breakpoint
CREATE INDEX "airtable_extracts_embedding_id_index" ON "integrations"."airtable_extracts" USING btree ("embedding_id");--> statement-breakpoint
CREATE INDEX "airtable_spaces_embedding_id_index" ON "integrations"."airtable_spaces" USING btree ("embedding_id");--> statement-breakpoint
CREATE INDEX "github_users_embedding_id_index" ON "integrations"."github_users" USING btree ("embedding_id");--> statement-breakpoint
CREATE INDEX "raindrop_bookmarks_embedding_id_index" ON "integrations"."raindrop_bookmarks" USING btree ("embedding_id");--> statement-breakpoint
CREATE INDEX "raindrop_collections_embedding_id_index" ON "integrations"."raindrop_collections" USING btree ("embedding_id");--> statement-breakpoint
CREATE INDEX "twitter_tweets_embedding_id_index" ON "integrations"."twitter_tweets" USING btree ("embedding_id");--> statement-breakpoint
CREATE INDEX "twitter_users_embedding_id_index" ON "integrations"."twitter_users" USING btree ("embedding_id");