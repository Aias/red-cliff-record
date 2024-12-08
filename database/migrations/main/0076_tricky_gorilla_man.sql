ALTER TABLE "integrations"."github_repositories" ADD COLUMN "integration_run_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "integrations"."github_users" ADD COLUMN "integration_run_id" integer NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."github_repositories" ADD CONSTRAINT "github_repositories_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "operations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."github_users" ADD CONSTRAINT "github_users_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "operations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
