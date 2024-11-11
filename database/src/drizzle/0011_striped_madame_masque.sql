ALTER TABLE "browsing_history" ADD COLUMN "hostname" text;--> statement-breakpoint
ALTER TABLE "browsing_history" ADD COLUMN "view_epoch_microseconds" numeric(20, 0);

UPDATE "browsing_history" SET "hostname" = 'Nicks-MacBook-Air.local';
