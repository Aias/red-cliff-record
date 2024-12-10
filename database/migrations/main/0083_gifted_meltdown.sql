CREATE TYPE "integrations"."github_commit_types" AS ENUM('feature', 'enhancement', 'bugfix', 'refactor', 'documentation', 'style', 'chore', 'test', 'build');--> statement-breakpoint
ALTER TABLE "integrations"."github_commits" ADD COLUMN "commit_type" "integrations"."github_commit_types";--> statement-breakpoint
ALTER TABLE "integrations"."github_commits" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "integrations"."github_commits" ADD COLUMN "technologies" text[];