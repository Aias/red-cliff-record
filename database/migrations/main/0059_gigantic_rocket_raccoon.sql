ALTER TABLE "twitter"."media" RENAME TO "twitter_media";--> statement-breakpoint
ALTER TABLE "twitter"."users" RENAME TO "twitter_users";--> statement-breakpoint
ALTER TABLE "twitter"."twitter_media" DROP CONSTRAINT "media_tweet_id_tweets_id_fk";
--> statement-breakpoint
ALTER TABLE "twitter"."tweets" DROP CONSTRAINT "tweets_user_id_users_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "twitter"."twitter_media" ADD CONSTRAINT "twitter_media_tweet_id_tweets_id_fk" FOREIGN KEY ("tweet_id") REFERENCES "twitter"."tweets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "twitter"."tweets" ADD CONSTRAINT "tweets_user_id_twitter_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "twitter"."twitter_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
