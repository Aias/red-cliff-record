CREATE EXTENSION vector;

ALTER TYPE "operations"."integration_type" ADD VALUE 'embeddings' BEFORE 'github';--> statement-breakpoint
CREATE TABLE "embeddings" (
	"id" serial PRIMARY KEY NOT NULL,
	"embedding" vector(768) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integrations"."readwise_documents" ADD COLUMN "embedding_id" integer;--> statement-breakpoint
ALTER TABLE "integrations"."readwise_documents" ADD CONSTRAINT "readwise_documents_embedding_id_embeddings_id_fk" FOREIGN KEY ("embedding_id") REFERENCES "public"."embeddings"("id") ON DELETE set null ON UPDATE cascade;