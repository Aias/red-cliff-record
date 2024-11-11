CREATE TYPE "public"."browser" AS ENUM('arc', 'chrome', 'firefox', 'safari', 'edge');--> statement-breakpoint
ALTER TABLE "browsing_history" ADD COLUMN "browser" "browser" DEFAULT 'arc' NOT NULL;