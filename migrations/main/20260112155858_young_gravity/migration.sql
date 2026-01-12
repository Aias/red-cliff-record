ALTER TABLE "twitter_tweets" ADD COLUMN "in_reply_to_tweet_id" text;--> statement-breakpoint
ALTER TABLE "twitter_tweets" ADD COLUMN "conversation_id" text;--> statement-breakpoint
ALTER TABLE "twitter_tweets" ADD CONSTRAINT "twitter_tweets_in_reply_to_tweet_id_twitter_tweets_id_fkey" FOREIGN KEY ("in_reply_to_tweet_id") REFERENCES "twitter_tweets"("id") ON DELETE SET NULL ON UPDATE CASCADE;