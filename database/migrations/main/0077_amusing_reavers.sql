ALTER TABLE "integrations"."github_repositories" ADD COLUMN "starred_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "integrations"."github_users" ADD COLUMN "partial" boolean NOT NULL;--> statement-breakpoint
ALTER TABLE "integrations"."github_repositories" DROP COLUMN IF EXISTS "starred";