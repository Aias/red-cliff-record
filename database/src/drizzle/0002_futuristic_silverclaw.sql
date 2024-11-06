ALTER TYPE "public"."integration_status" ADD VALUE 'in_progress';

--> statement-breakpoint
ALTER TABLE "browsing_history"
ALTER COLUMN "page_title"
SET
	NOT NULL;

--> statement-breakpoint
ALTER TABLE "integration_runs"
ALTER COLUMN "status"
SET DEFAULT 'in_progress';