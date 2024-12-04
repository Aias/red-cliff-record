ALTER TYPE "public"."record_type" ADD VALUE 'event';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "record_timepoints" (
	"id" serial PRIMARY KEY NOT NULL,
	"record_id" integer NOT NULL,
	"timepoint_id" integer NOT NULL,
	"label" text,
	"order" text DEFAULT 'a0' NOT NULL,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "events" CASCADE;--> statement-breakpoint
ALTER TABLE "timepoints" ALTER COLUMN "start_time" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "timepoints" ALTER COLUMN "end_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "timepoints" ALTER COLUMN "end_time" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "timepoints" ALTER COLUMN "end_instant" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "location_id" integer;--> statement-breakpoint
ALTER TABLE "timepoints" ADD COLUMN "start_granularity" timepoint_type NOT NULL;--> statement-breakpoint
ALTER TABLE "timepoints" ADD COLUMN "end_granularity" timepoint_type;--> statement-breakpoint
ALTER TABLE "timepoints" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "timepoints" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "record_timepoints" ADD CONSTRAINT "record_timepoints_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "record_timepoints" ADD CONSTRAINT "record_timepoints_timepoint_id_timepoints_id_fk" FOREIGN KEY ("timepoint_id") REFERENCES "public"."timepoints"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "record_timepoint_record_idx" ON "record_timepoints" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "record_timepoint_timepoint_idx" ON "record_timepoints" USING btree ("timepoint_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "records" ADD CONSTRAINT "records_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "record_location_idx" ON "records" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timepoint_start_date_idx" ON "timepoints" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timepoint_start_instant_idx" ON "timepoints" USING btree ("start_instant");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timepoint_start_granularity_idx" ON "timepoints" USING btree ("start_granularity");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timepoint_end_date_idx" ON "timepoints" USING btree ("end_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timepoint_end_instant_idx" ON "timepoints" USING btree ("end_instant");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timepoint_end_granularity_idx" ON "timepoints" USING btree ("end_granularity");--> statement-breakpoint
ALTER TABLE "timepoints" DROP COLUMN IF EXISTS "type";--> statement-breakpoint
ALTER TABLE "public"."timepoints" ALTER COLUMN "start_granularity" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "public"."timepoints" ALTER COLUMN "end_granularity" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."timepoint_type";--> statement-breakpoint
CREATE TYPE "public"."timepoint_type" AS ENUM('instant', 'minute', 'hour', 'day', 'week', 'month', 'quarter', 'year', 'decade', 'century');--> statement-breakpoint
ALTER TABLE "public"."timepoints" ALTER COLUMN "start_granularity" SET DATA TYPE "public"."timepoint_type" USING "start_granularity"::"public"."timepoint_type";--> statement-breakpoint
ALTER TABLE "public"."timepoints" ALTER COLUMN "end_granularity" SET DATA TYPE "public"."timepoint_type" USING "end_granularity"::"public"."timepoint_type";--> statement-breakpoint
DROP TYPE "public"."certainty_type";--> statement-breakpoint
DROP TYPE "public"."event_type";