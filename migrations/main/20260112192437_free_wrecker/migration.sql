DROP INDEX "browsing_history_hostname_index";--> statement-breakpoint
DROP INDEX "links_source_id_index";--> statement-breakpoint
DROP INDEX "links_target_id_index";--> statement-breakpoint
DROP INDEX "records_rating_index";--> statement-breakpoint
DROP INDEX "records_is_private_index";--> statement-breakpoint
CREATE INDEX "twitter_media_tweet_id_index" ON "twitter_media" ("tweet_id");--> statement-breakpoint
CREATE INDEX "twitter_tweets_user_id_index" ON "twitter_tweets" ("user_id");