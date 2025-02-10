UPDATE "readwise_documents" SET "site_name" = NULL WHERE "author" = '';

ALTER TABLE "readwise_authors" RENAME COLUMN "domain" TO "site_name";--> statement-breakpoint
ALTER TABLE "readwise_authors" DROP CONSTRAINT "readwise_authors_name_domain_unique";--> statement-breakpoint
DROP INDEX "readwise_authors_domain_index";--> statement-breakpoint
ALTER TABLE "readwise_documents" ALTER COLUMN "site_name" SET DEFAULT 'readwise.io';--> statement-breakpoint
ALTER TABLE "readwise_documents" ALTER COLUMN "site_name" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "readwise_authors_site_name_index" ON "readwise_authors" USING btree ("site_name");--> statement-breakpoint
ALTER TABLE "readwise_authors" ADD CONSTRAINT "readwise_authors_name_site_name_unique" UNIQUE("name","site_name");