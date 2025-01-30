ALTER TABLE "embeddings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "indices" ADD COLUMN "embedding" vector(768);--> statement-breakpoint
ALTER TABLE "integrations"."airtable_creators" ADD COLUMN "embedding" vector(768);--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extracts" ADD COLUMN "embedding" vector(768);--> statement-breakpoint
ALTER TABLE "integrations"."airtable_spaces" ADD COLUMN "embedding" vector(768);--> statement-breakpoint
ALTER TABLE "integrations"."github_commits" ADD COLUMN "embedding" vector(768);--> statement-breakpoint
ALTER TABLE "integrations"."github_repositories" ADD COLUMN "embedding" vector(768);--> statement-breakpoint
ALTER TABLE "integrations"."github_users" ADD COLUMN "embedding" vector(768);--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_bookmarks" ADD COLUMN "embedding" vector(768);--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_collections" ADD COLUMN "embedding" vector(768);--> statement-breakpoint
ALTER TABLE "integrations"."readwise_documents" ADD COLUMN "embedding" vector(768);--> statement-breakpoint
ALTER TABLE "integrations"."twitter_tweets" ADD COLUMN "embedding" vector(768);--> statement-breakpoint
ALTER TABLE "integrations"."twitter_users" ADD COLUMN "embedding" vector(768);--> statement-breakpoint

-- Transfer data from embeddings table to respective tables
UPDATE "indices" SET "embedding" = e.embedding FROM "embeddings" e WHERE e.id = "indices"."embedding_id";--> statement-breakpoint
UPDATE "integrations"."airtable_creators" SET "embedding" = e.embedding FROM "embeddings" e WHERE e.id = "embedding_id";--> statement-breakpoint
UPDATE "integrations"."airtable_extracts" SET "embedding" = e.embedding FROM "embeddings" e WHERE e.id = "embedding_id";--> statement-breakpoint
UPDATE "integrations"."airtable_spaces" SET "embedding" = e.embedding FROM "embeddings" e WHERE e.id = "embedding_id";--> statement-breakpoint
UPDATE "integrations"."github_commits" SET "embedding" = e.embedding FROM "embeddings" e WHERE e.id = "embedding_id";--> statement-breakpoint
UPDATE "integrations"."github_repositories" SET "embedding" = e.embedding FROM "embeddings" e WHERE e.id = "embedding_id";--> statement-breakpoint
UPDATE "integrations"."github_users" SET "embedding" = e.embedding FROM "embeddings" e WHERE e.id = "embedding_id";--> statement-breakpoint
UPDATE "integrations"."raindrop_bookmarks" SET "embedding" = e.embedding FROM "embeddings" e WHERE e.id = "embedding_id";--> statement-breakpoint
UPDATE "integrations"."raindrop_collections" SET "embedding" = e.embedding FROM "embeddings" e WHERE e.id = "embedding_id";--> statement-breakpoint
UPDATE "integrations"."readwise_documents" SET "embedding" = e.embedding FROM "embeddings" e WHERE e.id = "embedding_id";--> statement-breakpoint
UPDATE "integrations"."twitter_tweets" SET "embedding" = e.embedding FROM "embeddings" e WHERE e.id = "embedding_id";--> statement-breakpoint
UPDATE "integrations"."twitter_users" SET "embedding" = e.embedding FROM "embeddings" e WHERE e.id = "embedding_id";--> statement-breakpoint

ALTER TABLE "indices" DROP CONSTRAINT "indices_embedding_id_embeddings_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_creators" DROP CONSTRAINT "airtable_creators_embedding_id_embeddings_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extracts" DROP CONSTRAINT "airtable_extracts_embedding_id_embeddings_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_spaces" DROP CONSTRAINT "airtable_spaces_embedding_id_embeddings_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."github_commits" DROP CONSTRAINT "github_commits_embedding_id_embeddings_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."github_repositories" DROP CONSTRAINT "github_repositories_embedding_id_embeddings_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."github_users" DROP CONSTRAINT "github_users_embedding_id_embeddings_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_bookmarks" DROP CONSTRAINT "raindrop_bookmarks_embedding_id_embeddings_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_collections" DROP CONSTRAINT "raindrop_collections_embedding_id_embeddings_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."readwise_documents" DROP CONSTRAINT "readwise_documents_embedding_id_embeddings_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."twitter_tweets" DROP CONSTRAINT "twitter_tweets_embedding_id_embeddings_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."twitter_users" DROP CONSTRAINT "twitter_users_embedding_id_embeddings_id_fk";
--> statement-breakpoint
DROP INDEX "integrations"."airtable_creators_embedding_id_index";--> statement-breakpoint
DROP INDEX "integrations"."airtable_extracts_embedding_id_index";--> statement-breakpoint
DROP INDEX "integrations"."airtable_spaces_embedding_id_index";--> statement-breakpoint
DROP INDEX "integrations"."github_users_embedding_id_index";--> statement-breakpoint
DROP INDEX "integrations"."raindrop_bookmarks_embedding_id_index";--> statement-breakpoint
DROP INDEX "integrations"."raindrop_collections_embedding_id_index";--> statement-breakpoint
DROP INDEX "integrations"."twitter_tweets_embedding_id_index";--> statement-breakpoint
DROP INDEX "integrations"."twitter_users_embedding_id_index";--> statement-breakpoint
ALTER TABLE "indices" DROP COLUMN "embedding_id";--> statement-breakpoint
ALTER TABLE "integrations"."airtable_creators" DROP COLUMN "embedding_id";--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extracts" DROP COLUMN "embedding_id";--> statement-breakpoint
ALTER TABLE "integrations"."airtable_spaces" DROP COLUMN "embedding_id";--> statement-breakpoint
ALTER TABLE "integrations"."github_commits" DROP COLUMN "embedding_id";--> statement-breakpoint
ALTER TABLE "integrations"."github_repositories" DROP COLUMN "embedding_id";--> statement-breakpoint
ALTER TABLE "integrations"."github_users" DROP COLUMN "embedding_id";--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_bookmarks" DROP COLUMN "embedding_id";--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_collections" DROP COLUMN "embedding_id";--> statement-breakpoint
ALTER TABLE "integrations"."readwise_documents" DROP COLUMN "embedding_id";--> statement-breakpoint
ALTER TABLE "integrations"."twitter_tweets" DROP COLUMN "embedding_id";--> statement-breakpoint
ALTER TABLE "integrations"."twitter_users" DROP COLUMN "embedding_id";
DROP TABLE "embeddings" CASCADE;--> statement-breakpoint