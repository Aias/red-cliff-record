CREATE INDEX "idx_records_sources" ON "records" USING gin ("sources");--> statement-breakpoint
CREATE INDEX "records_created_at_index" ON "records" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "records_updated_at_index" ON "records" USING btree ("updated_at");