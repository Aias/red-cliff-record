ALTER TABLE "integrations"."twitter_tweets" DROP CONSTRAINT "twitter_tweets_user_id_twitter_users_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."twitter_tweets" DROP CONSTRAINT "twitter_tweets_quoted_tweet_id_twitter_tweets_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."twitter_tweets" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "integrations"."twitter_tweets" ADD CONSTRAINT "twitter_tweets_user_id_twitter_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "integrations"."twitter_users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integrations"."twitter_tweets" ADD CONSTRAINT "twitter_tweets_quoted_tweet_id_twitter_tweets_id_fk" FOREIGN KEY ("quoted_tweet_id") REFERENCES "integrations"."twitter_tweets"("id") ON DELETE set null ON UPDATE cascade;