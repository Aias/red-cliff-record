DROP INDEX IF EXISTS "bookmarks_starred_index";--> statement-breakpoint
ALTER TABLE "bookmarks" RENAME COLUMN "starred" TO "important";--> statement-breakpoint
ALTER TABLE "bookmarks" ADD COLUMN "creator" text;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD COLUMN "bookmarked_at" timestamp DEFAULT now() NOT NULL;