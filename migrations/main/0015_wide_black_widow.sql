CREATE TABLE "airtable_formats" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"index_entry_id" integer,
	"integration_run_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "airtable_formats_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "airtable_extracts" RENAME COLUMN "format" TO "format_string";--> statement-breakpoint
ALTER TABLE "airtable_extracts" ADD COLUMN "format_id" integer;--> statement-breakpoint
ALTER TABLE "airtable_formats" ADD CONSTRAINT "airtable_formats_index_entry_id_indices_id_fk" FOREIGN KEY ("index_entry_id") REFERENCES "public"."indices"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "airtable_formats" ADD CONSTRAINT "airtable_formats_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "airtable_formats_index_entry_id_index" ON "airtable_formats" USING btree ("index_entry_id");--> statement-breakpoint
ALTER TABLE "airtable_extracts" ADD CONSTRAINT "airtable_extracts_format_id_airtable_formats_id_fk" FOREIGN KEY ("format_id") REFERENCES "public"."airtable_formats"("id") ON DELETE set null ON UPDATE cascade;