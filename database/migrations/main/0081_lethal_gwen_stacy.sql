CREATE INDEX IF NOT EXISTS "github_commit_changes_commit_id_index" ON "integrations"."github_commit_changes" USING btree ("commit_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_commit_changes_filename_index" ON "integrations"."github_commit_changes" USING btree ("filename");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_commits_repository_id_index" ON "integrations"."github_commits" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_commits_sha_index" ON "integrations"."github_commits" USING btree ("sha");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_repositories_node_id_index" ON "integrations"."github_repositories" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_users_login_index" ON "integrations"."github_users" USING btree ("login");