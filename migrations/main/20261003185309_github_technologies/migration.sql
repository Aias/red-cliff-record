CREATE TABLE "github_commit_technologies" (
	"commit_id" text,
	"technology_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "github_commit_technologies_pkey" PRIMARY KEY("commit_id","technology_id")
);
--> statement-breakpoint
CREATE TABLE "github_technologies" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL UNIQUE,
	"record_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "github_commit_technologies_technology_id_index" ON "github_commit_technologies" ("technology_id");--> statement-breakpoint
CREATE INDEX "github_technologies_record_id_index" ON "github_technologies" ("record_id");--> statement-breakpoint
ALTER TABLE "github_commit_technologies" ADD CONSTRAINT "github_commit_technologies_commit_id_github_commits_id_fkey" FOREIGN KEY ("commit_id") REFERENCES "github_commits"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "github_commit_technologies" ADD CONSTRAINT "github_commit_technologies_DTYExnsDtgsU_fkey" FOREIGN KEY ("technology_id") REFERENCES "github_technologies"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "github_technologies" ADD CONSTRAINT "github_technologies_record_id_records_id_fkey" FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
INSERT INTO github_technologies (name)
SELECT DISTINCT t.name
FROM github_commits c
CROSS JOIN LATERAL unnest(c.technologies) AS t(name);--> statement-breakpoint
INSERT INTO github_commit_technologies (commit_id, technology_id)
SELECT DISTINCT c.id, gt.id
FROM github_commits c
CROSS JOIN LATERAL unnest(c.technologies) AS t(name)
JOIN github_technologies gt ON gt.name = t.name;