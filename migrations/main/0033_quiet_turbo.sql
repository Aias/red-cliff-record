CREATE INDEX "records_text_embedding_index" ON "records" USING hnsw ("text_embedding" vector_cosine_ops);--> statement-breakpoint
ALTER TABLE "github_commits" DROP COLUMN "text_embedding";