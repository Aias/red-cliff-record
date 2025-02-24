DROP INDEX "airtable_creators_archived_at_index";--> statement-breakpoint
DROP INDEX "airtable_spaces_archived_at_index";--> statement-breakpoint
DROP INDEX "github_users_archived_at_index";--> statement-breakpoint
ALTER TABLE "airtable_attachments" DROP COLUMN "archived_at";--> statement-breakpoint
ALTER TABLE "airtable_creators" DROP COLUMN "archived_at";--> statement-breakpoint
ALTER TABLE "airtable_spaces" DROP COLUMN "archived_at";--> statement-breakpoint
ALTER TABLE "github_users" DROP COLUMN "archived_at";