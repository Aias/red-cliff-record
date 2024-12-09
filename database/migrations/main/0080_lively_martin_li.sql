ALTER TABLE "integrations"."github_commits"
DROP CONSTRAINT "github_commits_repository_id_sha_unique";

--> statement-breakpoint
ALTER TABLE "integrations"."github_commits"
ADD COLUMN "committed_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."github_commits"
DROP COLUMN IF EXISTS "content_updated_at";

--> statement-breakpoint
ALTER TABLE "integrations"."github_commits" ADD CONSTRAINT "github_commits_sha_unique" UNIQUE ("sha");