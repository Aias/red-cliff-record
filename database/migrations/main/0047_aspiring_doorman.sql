CREATE TYPE "public"."certainty_type" AS ENUM('fixed', 'estimated', 'target', 'tentative', 'milestone');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('project', 'milestone', 'holiday', 'meeting', 'deadline', 'reminder', 'recurring', 'event');--> statement-breakpoint
CREATE TYPE "public"."timepoint_type" AS ENUM('instant', 'second', 'minute', 'hour', 'day', 'week', 'month', 'quarter', 'year', 'custom');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"type" "event_type" DEFAULT 'event' NOT NULL,
	"timepoint" integer NOT NULL,
	"timepoint_certainty" "certainty_type" DEFAULT 'fixed' NOT NULL,
	"secondary_timepoint" integer,
	"secondary_timepoint_certainty" "certainty_type",
	"parent_event_id" integer,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "timepoints" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" timepoint_type NOT NULL,
	"start_date" date NOT NULL,
	"start_time" time NOT NULL,
	"start_instant" timestamp with time zone NOT NULL,
	"end_date" date NOT NULL,
	"end_time" time NOT NULL,
	"end_instant" timestamp with time zone NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_timepoint_timepoints_id_fk" FOREIGN KEY ("timepoint") REFERENCES "public"."timepoints"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_secondary_timepoint_timepoints_id_fk" FOREIGN KEY ("secondary_timepoint") REFERENCES "public"."timepoints"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_parent_event_id_events_id_fk" FOREIGN KEY ("parent_event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
