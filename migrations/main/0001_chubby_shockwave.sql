ALTER TABLE "arc_browsing_history" RENAME TO "browsing_history";--> statement-breakpoint
ALTER TABLE "arc_browsing_history_omit_list" RENAME TO "browsing_history_omit_list";--> statement-breakpoint
ALTER TABLE "browsing_history" DROP CONSTRAINT "arc_browsing_history_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "arc_browsing_history_integration_run_id_index";--> statement-breakpoint
DROP INDEX IF EXISTS "arc_browsing_history_view_time_index";--> statement-breakpoint
DROP INDEX IF EXISTS "arc_browsing_history_url_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "arc_browsing_history_view_epoch_microseconds_index";--> statement-breakpoint
DROP INDEX IF EXISTS "arc_browsing_history_hostname_index";--> statement-breakpoint
DROP INDEX IF EXISTS "browsing_history_integration_run_id_index";--> statement-breakpoint
DROP INDEX IF EXISTS "browsing_history_view_time_index";--> statement-breakpoint
DROP INDEX IF EXISTS "browsing_history_url_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "browsing_history_view_epoch_microseconds_index";--> statement-breakpoint
DROP INDEX IF EXISTS "browsing_history_hostname_index";--> statement-breakpoint
ALTER TABLE "browsing_history" ADD CONSTRAINT "browsing_history_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "browsing_history_integration_run_id_index" ON "browsing_history" USING btree ("integration_run_id");--> statement-breakpoint
CREATE INDEX "browsing_history_view_time_index" ON "browsing_history" USING btree ("view_time");--> statement-breakpoint
CREATE INDEX "browsing_history_url_idx" ON "browsing_history" USING btree ("url");--> statement-breakpoint
CREATE INDEX "browsing_history_view_epoch_microseconds_index" ON "browsing_history" USING btree ("view_epoch_microseconds");--> statement-breakpoint
CREATE INDEX "browsing_history_hostname_index" ON "browsing_history" USING btree ("hostname");