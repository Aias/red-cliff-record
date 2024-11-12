ALTER TABLE "airtable_attachments" DROP COLUMN IF EXISTS "deleted_at";--> statement-breakpoint
ALTER TABLE "airtable_creators" DROP COLUMN IF EXISTS "deleted_at";--> statement-breakpoint
ALTER TABLE "airtable_extract_connections" DROP COLUMN IF EXISTS "deleted_at";--> statement-breakpoint
ALTER TABLE "airtable_extract_creators" DROP COLUMN IF EXISTS "deleted_at";--> statement-breakpoint
ALTER TABLE "airtable_extract_spaces" DROP COLUMN IF EXISTS "deleted_at";--> statement-breakpoint
ALTER TABLE "airtable_extracts" DROP COLUMN IF EXISTS "deleted_at";--> statement-breakpoint
ALTER TABLE "airtable_spaces" DROP COLUMN IF EXISTS "deleted_at";--> statement-breakpoint
ALTER TABLE "bookmarks" DROP COLUMN IF EXISTS "deleted_at";--> statement-breakpoint
ALTER TABLE "browsing_history" DROP COLUMN IF EXISTS "deleted_at";--> statement-breakpoint
ALTER TABLE "commit_changes" DROP COLUMN IF EXISTS "deleted_at";--> statement-breakpoint
ALTER TABLE "commits" DROP COLUMN IF EXISTS "deleted_at";--> statement-breakpoint
ALTER TABLE "integration_runs" DROP COLUMN IF EXISTS "deleted_at";