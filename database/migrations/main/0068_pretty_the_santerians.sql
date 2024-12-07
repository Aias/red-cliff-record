ALTER TABLE "integrations"."twitter_tweets"
RENAME COLUMN "posted_at" TO "content_created_at";

--> statement-breakpoint
ALTER TABLE "integrations"."twitter_tweets"
ALTER COLUMN "content_created_at"
DROP NOT NULL,
ALTER COLUMN "content_created_at"
DROP DEFAULT;

--> statement-breakpoint
ALTER TABLE "integrations"."arc_browsing_history"
ALTER COLUMN "page_title"
DROP NOT NULL;

--> statement-breakpoint
ALTER TABLE "integrations"."adobe_lightroom_images"
ADD COLUMN "content_created_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."adobe_lightroom_images"
ADD COLUMN "content_updated_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."airtable_attachments"
ADD COLUMN "content_created_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."airtable_attachments"
ADD COLUMN "content_updated_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."airtable_creators"
ADD COLUMN "content_created_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."airtable_creators"
ADD COLUMN "content_updated_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extracts"
ADD COLUMN "content_created_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extracts"
ADD COLUMN "content_updated_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."airtable_spaces"
ADD COLUMN "content_created_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."airtable_spaces"
ADD COLUMN "content_updated_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."github_commits"
ADD COLUMN "content_created_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."github_commits"
ADD COLUMN "content_updated_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."github_stars"
ADD COLUMN "content_created_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."github_stars"
ADD COLUMN "content_updated_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_collections"
ADD COLUMN "content_created_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_collections"
ADD COLUMN "content_updated_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_raindrops"
ADD COLUMN "content_created_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_raindrops"
ADD COLUMN "content_updated_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."readwise_documents"
ADD COLUMN "content_created_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."readwise_documents"
ADD COLUMN "content_updated_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."twitter_media"
ADD COLUMN "content_created_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."twitter_media"
ADD COLUMN "content_updated_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."twitter_tweets"
ADD COLUMN "content_updated_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."twitter_users"
ADD COLUMN "content_created_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."twitter_users"
ADD COLUMN "content_updated_at" timestamp
with
	time zone;