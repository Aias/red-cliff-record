CREATE TABLE "readwise_authors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text,
	"index_entry_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "readwise_authors_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "readwise_document_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"tag_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "readwise_document_tags_document_id_tag_id_unique" UNIQUE("document_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "readwise_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"tag" text,
	"index_entry_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "readwise_tags_tag_unique" UNIQUE("tag")
);
--> statement-breakpoint
ALTER TABLE "readwise_documents" ADD COLUMN "author_id" integer;--> statement-breakpoint
ALTER TABLE "readwise_authors" ADD CONSTRAINT "readwise_authors_index_entry_id_indices_id_fk" FOREIGN KEY ("index_entry_id") REFERENCES "public"."indices"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "readwise_document_tags" ADD CONSTRAINT "readwise_document_tags_document_id_readwise_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."readwise_documents"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "readwise_document_tags" ADD CONSTRAINT "readwise_document_tags_tag_id_readwise_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."readwise_tags"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "readwise_tags" ADD CONSTRAINT "readwise_tags_index_entry_id_indices_id_fk" FOREIGN KEY ("index_entry_id") REFERENCES "public"."indices"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "readwise_document_tags_document_id_index" ON "readwise_document_tags" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "readwise_document_tags_tag_id_index" ON "readwise_document_tags" USING btree ("tag_id");--> statement-breakpoint
ALTER TABLE "readwise_documents" ADD CONSTRAINT "readwise_documents_author_id_readwise_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."readwise_authors"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "readwise_documents_author_id_index" ON "readwise_documents" USING btree ("author_id");