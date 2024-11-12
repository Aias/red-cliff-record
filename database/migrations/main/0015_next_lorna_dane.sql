ALTER TYPE "public"."commit_change_status" ADD VALUE 'copied';--> statement-breakpoint
ALTER TYPE "public"."commit_change_status" ADD VALUE 'changed';--> statement-breakpoint
ALTER TYPE "public"."commit_change_status" ADD VALUE 'unchanged';--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_url_bookmarkedAt_unique" UNIQUE("url","bookmarked_at");