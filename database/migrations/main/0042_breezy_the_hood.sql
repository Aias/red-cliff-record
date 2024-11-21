ALTER TABLE "adobe"."photographs" RENAME COLUMN "url" TO "url2048";--> statement-breakpoint
ALTER TABLE "adobe"."photographs" ADD COLUMN "links" json NOT NULL;