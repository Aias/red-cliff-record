ALTER TABLE "github"."stars"
ADD COLUMN "starred_at" timestamp
with
	time zone NOT NULL;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stars_starred_at_index" ON "github"."stars" USING btree ("starred_at");