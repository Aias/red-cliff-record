CREATE TYPE "integrations"."twitter_media_type" AS ENUM('photo', 'video', 'animated_gif');--> statement-breakpoint
ALTER TABLE "integrations"."twitter_media" RENAME COLUMN "url" TO "tweet_url";--> statement-breakpoint
ALTER TABLE "integrations"."twitter_media"
  ALTER COLUMN "type" SET DATA TYPE "integrations"."twitter_media_type"
  USING "type"::"integrations"."twitter_media_type";  -- explicit cast

ALTER TABLE "integrations"."twitter_media" ALTER COLUMN "type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "integrations"."twitter_media" ALTER COLUMN "media_url" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "embedding" vector(768);--> statement-breakpoint
ALTER TABLE "media" DROP COLUMN "metadata";--> statement-breakpoint
ALTER TABLE "integrations"."twitter_media" ADD CONSTRAINT "twitter_media_media_url_unique" UNIQUE("media_url");