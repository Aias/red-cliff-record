ALTER TABLE "integrations"."github_commits" RENAME COLUMN "node_id" TO "id";--> statement-breakpoint
ALTER TABLE "integrations"."github_commit_changes" DROP CONSTRAINT "github_commit_changes_commit_id_github_commits_node_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."github_commit_changes" ADD CONSTRAINT "github_commit_changes_commit_id_github_commits_id_fk" FOREIGN KEY ("commit_id") REFERENCES "integrations"."github_commits"("id") ON DELETE cascade ON UPDATE cascade;