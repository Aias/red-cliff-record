ALTER TABLE "integrations"."github_commits" DROP CONSTRAINT "github_commits_committer_id_github_users_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."github_commits" DROP CONSTRAINT "github_commits_author_id_github_users_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."github_commits" DROP COLUMN IF EXISTS "committer_id";--> statement-breakpoint
ALTER TABLE "integrations"."github_commits" DROP COLUMN IF EXISTS "author_id";