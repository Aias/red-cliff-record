ALTER TABLE "integrations"."airtable_creators"
ADD COLUMN "archived_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."airtable_creators"
ADD COLUMN "index_entry_id" integer;

--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extracts"
ADD COLUMN "archived_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extracts"
ADD COLUMN "record_id" integer;

--> statement-breakpoint
ALTER TABLE "integrations"."airtable_spaces"
ADD COLUMN "archived_at" timestamp
with
	time zone;

--> statement-breakpoint
ALTER TABLE "integrations"."airtable_spaces"
ADD COLUMN "index_entry_id" integer;

--> statement-breakpoint
ALTER TABLE "integrations"."airtable_creators" ADD CONSTRAINT "airtable_creators_index_entry_id_index_entries_id_fk" FOREIGN KEY ("index_entry_id") REFERENCES "public"."index_entries" ("id") ON DELETE set null ON UPDATE cascade;

--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extracts" ADD CONSTRAINT "airtable_extracts_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records" ("id") ON DELETE set null ON UPDATE cascade;

--> statement-breakpoint
ALTER TABLE "integrations"."airtable_spaces" ADD CONSTRAINT "airtable_spaces_index_entry_id_index_entries_id_fk" FOREIGN KEY ("index_entry_id") REFERENCES "public"."index_entries" ("id") ON DELETE set null ON UPDATE cascade;

--> statement-breakpoint
CREATE INDEX "airtable_creator_archived_at_idx" ON "integrations"."airtable_creators" USING btree ("archived_at");

--> statement-breakpoint
CREATE INDEX "airtable_creator_index_entry_id_idx" ON "integrations"."airtable_creators" USING btree ("index_entry_id");

--> statement-breakpoint
CREATE INDEX "airtable_extract_archived_at_idx" ON "integrations"."airtable_extracts" USING btree ("archived_at");

--> statement-breakpoint
CREATE INDEX "airtable_extract_record_id_idx" ON "integrations"."airtable_extracts" USING btree ("record_id");

--> statement-breakpoint
CREATE INDEX "airtable_space_archived_at_idx" ON "integrations"."airtable_spaces" USING btree ("archived_at");

--> statement-breakpoint
CREATE INDEX "airtable_space_index_entry_id_idx" ON "integrations"."airtable_spaces" USING btree ("index_entry_id");