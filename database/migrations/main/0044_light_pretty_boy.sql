ALTER TABLE "integrations"."integration_runs" ALTER COLUMN "run_type" SET DATA TYPE text;--> statement-breakpoint
UPDATE "integrations"."integration_runs" SET "run_type" = 'seed' WHERE "run_type" = 'full';--> statement-breakpoint
UPDATE "integrations"."integration_runs" SET "run_type" = 'sync' WHERE "run_type" = 'incremental';--> statement-breakpoint
DROP TYPE "integrations"."run_type";--> statement-breakpoint
CREATE TYPE "integrations"."run_type" AS ENUM('seed', 'sync');--> statement-breakpoint
ALTER TABLE "integrations"."integration_runs" ALTER COLUMN "run_type" SET DATA TYPE "integrations"."run_type" USING "run_type"::"integrations"."run_type";
ALTER TABLE "integrations"."integration_runs" ALTER COLUMN "run_type" SET DEFAULT 'sync';--> statement-breakpoint