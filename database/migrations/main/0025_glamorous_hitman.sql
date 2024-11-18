CREATE SCHEMA "twitter";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "twitter"."media" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text,
	"url" text,
	"media_url" text,
	"tweet_id" text NOT NULL,
	"updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "twitter"."tweets" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"user_id" text NOT NULL,
	"content" text,
	"quoted_tweet_id" text,
	"integration_run_id" integer NOT NULL,
	"bookmarked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tweets_url_bookmarkedAt_unique" UNIQUE("url","bookmarked_at")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "twitter"."users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text,
	"display_name" text,
	"description" text,
	"url" text,
	"external_url" text,
	"profile_image_url" text,
	"profile_banner_url" text,
	"updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "twitter"."media" ADD CONSTRAINT "media_tweet_id_tweets_id_fk" FOREIGN KEY ("tweet_id") REFERENCES "twitter"."tweets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "twitter"."tweets" ADD CONSTRAINT "tweets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "twitter"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "twitter"."tweets" ADD CONSTRAINT "tweets_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "integrations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "twitter"."tweets" ADD CONSTRAINT "tweets_quoted_tweet_id_tweets_id_fk" FOREIGN KEY ("quoted_tweet_id") REFERENCES "twitter"."tweets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tweets_integration_run_id_index" ON "twitter"."tweets" USING btree ("integration_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tweets_url_index" ON "twitter"."tweets" USING btree ("url");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tweets_created_at_index" ON "twitter"."tweets" USING btree ("created_at");