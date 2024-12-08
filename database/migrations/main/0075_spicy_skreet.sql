

CREATE TABLE IF NOT EXISTS "integrations"."github_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"actor" json,
	"repo" json,
	"payload" json,
	"public" boolean DEFAULT false NOT NULL,
	"integration_run_id" integer NOT NULL,
	"content_created_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integrations"."github_repositories" (
	"id" integer PRIMARY KEY NOT NULL,
	"node_id" text NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"owner_id" integer NOT NULL,
	"readme" text,
	"private" boolean NOT NULL,
	"html_url" text NOT NULL,
	"homepage_url" text,
	"license_name" text,
	"description" text,
	"language" text,
	"topics" text[],
	"starred" boolean DEFAULT false NOT NULL,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "github_repositories_node_id_unique" UNIQUE("node_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integrations"."github_users" (
	"id" integer PRIMARY KEY NOT NULL,
	"node_id" text NOT NULL,
	"login" text NOT NULL,
	"avatar_url" text,
	"html_url" text NOT NULL,
	"type" text NOT NULL,
	"name" text,
	"company" text,
	"blog" text,
	"location" text,
	"email" text,
	"bio" text,
	"twitter_username" text,
	"followers" integer,
	"following" integer,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "github_users_node_id_unique" UNIQUE("node_id")
);
--> statement-breakpoint
ALTER TABLE "integrations"."github_stars" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "integrations"."github_stars" CASCADE;--> statement-breakpoint
ALTER TABLE "integrations"."github_commits" RENAME COLUMN "id" TO "node_id";
ALTER TABLE "integrations"."github_commits" RENAME COLUMN "repository" TO "repository_id";--> statement-breakpoint
ALTER TABLE "integrations"."github_commits" RENAME COLUMN "url" TO "html_url";--> statement-breakpoint
ALTER TABLE "integrations"."github_commits" RENAME COLUMN "committer" TO "committer_id";--> statement-breakpoint
ALTER TABLE "integrations"."github_commit_changes" DROP CONSTRAINT "github_commit_changes_commit_id_github_commits_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."github_commits" ALTER COLUMN "node_id" SET DATA TYPE text;
ALTER TABLE "integrations"."github_commits" ALTER COLUMN "repository_id" SET DATA TYPE integer USING repository_id::integer;
ALTER TABLE "integrations"."github_commits" ALTER COLUMN "committer_id" SET DATA TYPE integer USING committer_id::integer;
--> statement-breakpoint
ALTER TABLE "integrations"."github_commit_changes" ALTER COLUMN "commit_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "integrations"."github_commits" ADD COLUMN "author_id" integer;--> statement-breakpoint
ALTER TABLE "integrations"."twitter_users" ADD COLUMN "integration_run_id" integer;
UPDATE integrations.twitter_users AS users
SET integration_run_id = (
    SELECT tweets.integration_run_id
    FROM integrations.twitter_tweets AS tweets
    WHERE tweets.user_id = users.id
    ORDER BY tweets.created_at ASC
    LIMIT 1
)
WHERE integration_run_id IS NULL;

ALTER TABLE "integrations"."twitter_users" 
ALTER COLUMN "integration_run_id" SET NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."github_events" ADD CONSTRAINT "github_events_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "operations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."github_repositories" ADD CONSTRAINT "github_repositories_owner_id_github_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "integrations"."github_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_repositories_owner_id_index" ON "integrations"."github_repositories" USING btree ("owner_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."github_commit_changes" ADD CONSTRAINT "github_commit_changes_commit_id_github_commits_node_id_fk" FOREIGN KEY ("commit_id") REFERENCES "integrations"."github_commits"("node_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."github_commits" ADD CONSTRAINT "github_commits_repository_id_github_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "integrations"."github_repositories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."github_commits" ADD CONSTRAINT "github_commits_committer_id_github_users_id_fk" FOREIGN KEY ("committer_id") REFERENCES "integrations"."github_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."github_commits" ADD CONSTRAINT "github_commits_author_id_github_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "integrations"."github_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."twitter_users" ADD CONSTRAINT "twitter_users_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "operations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "integrations"."github_commits" DROP COLUMN IF EXISTS "commit_date";--> statement-breakpoint
ALTER TABLE "integrations"."github_commits" ADD CONSTRAINT "github_commits_sha_unique" UNIQUE("sha");
--> statement-breakpoint