CREATE TYPE "public"."run_type" AS ENUM('full', 'incremental');--> statement-breakpoint
ALTER TABLE "integration_runs" ADD COLUMN "type" "run_type" NOT NULL;