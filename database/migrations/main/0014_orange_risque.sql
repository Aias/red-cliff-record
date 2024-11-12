CREATE TYPE "public"."commit_change_status" AS ENUM('added', 'modified', 'removed', 'renamed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commit_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"status" "commit_change_status" NOT NULL,
	"patch" text NOT NULL,
	"commit_id" integer NOT NULL,
	"changes" integer,
	"additions" integer,
	"deletions" integer,
	"updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commits" (
	"id" serial PRIMARY KEY NOT NULL,
	"sha" text NOT NULL,
	"message" text NOT NULL,
	"repository" text NOT NULL,
	"url" text NOT NULL,
	"committer" text,
	"commit_date" timestamp NOT NULL,
	"integration_run_id" integer NOT NULL,
	"changes" integer,
	"additions" integer,
	"deletions" integer,
	"updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commit_changes" ADD CONSTRAINT "commit_changes_commit_id_commits_id_fk" FOREIGN KEY ("commit_id") REFERENCES "public"."commits"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commits" ADD CONSTRAINT "commits_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
