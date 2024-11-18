ALTER TABLE "twitter"."tweets" RENAME COLUMN "content" TO "text";--> statement-breakpoint
ALTER TABLE "twitter"."tweets" DROP CONSTRAINT "tweets_url_bookmarkedAt_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "tweets_url_index";--> statement-breakpoint
DROP INDEX IF EXISTS "tweets_created_at_index";--> statement-breakpoint
ALTER TABLE "twitter"."tweets" DROP COLUMN IF EXISTS "url";