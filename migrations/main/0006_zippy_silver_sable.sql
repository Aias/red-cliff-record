CREATE TYPE "public"."raindrop_type" AS ENUM('link', 'document', 'video', 'image', 'audio', 'article');--> statement-breakpoint
CREATE TABLE "raindrop_bookmark_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"bookmark_id" integer,
	"tag_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "raindrop_bookmark_tags_bookmark_id_tag_id_unique" UNIQUE("bookmark_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "raindrop_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "raindrop_tags_tag_unique" UNIQUE("tag")
);
--> statement-breakpoint
ALTER TABLE "readwise_authors" DROP CONSTRAINT "readwise_authors_name_unique";--> statement-breakpoint
DROP INDEX "readwise_documents_url_index";--> statement-breakpoint
ALTER TABLE "raindrop_bookmarks" ALTER COLUMN "type" SET DATA TYPE raindrop_type USING "type"::raindrop_type;--> statement-breakpoint
ALTER TABLE "readwise_documents" ALTER COLUMN "url" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "readwise_authors" ADD COLUMN "domain" text;--> statement-breakpoint
ALTER TABLE "raindrop_bookmark_tags" ADD CONSTRAINT "raindrop_bookmark_tags_bookmark_id_raindrop_bookmarks_id_fk" FOREIGN KEY ("bookmark_id") REFERENCES "public"."raindrop_bookmarks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "raindrop_bookmark_tags" ADD CONSTRAINT "raindrop_bookmark_tags_tag_id_raindrop_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."raindrop_tags"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "raindrop_bookmark_tags_bookmark_id_index" ON "raindrop_bookmark_tags" USING btree ("bookmark_id");--> statement-breakpoint
CREATE INDEX "raindrop_bookmark_tags_tag_id_index" ON "raindrop_bookmark_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "readwise_authors_name_index" ON "readwise_authors" USING btree ("name");--> statement-breakpoint
CREATE INDEX "readwise_authors_domain_index" ON "readwise_authors" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "readwise_documents_source_url_index" ON "readwise_documents" USING btree ("source_url");--> statement-breakpoint
ALTER TABLE "readwise_authors" ADD CONSTRAINT "readwise_authors_name_domain_unique" UNIQUE("name","domain");