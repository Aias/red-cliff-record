ALTER TABLE "integration_runs" ADD COLUMN "run_end_time" timestamp;--> statement-breakpoint
ALTER TABLE "integration_runs" DROP COLUMN IF EXISTS "run_duration";