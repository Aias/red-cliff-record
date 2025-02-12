ALTER TABLE "readwise_authors" RENAME COLUMN "site_name" TO "origin";--> statement-breakpoint
ALTER TABLE "readwise_authors" DROP CONSTRAINT "readwise_authors_name_site_name_unique";--> statement-breakpoint
DROP INDEX "readwise_authors_site_name_index";--> statement-breakpoint
CREATE INDEX "readwise_authors_origin_index" ON "readwise_authors" USING btree ("origin");--> statement-breakpoint
ALTER TABLE "readwise_authors" ADD CONSTRAINT "readwise_authors_name_origin_unique" UNIQUE("name","origin");