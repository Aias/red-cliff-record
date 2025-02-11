CREATE INDEX "indices_needs_curation_index" ON "indices" USING btree ("needs_curation");--> statement-breakpoint
CREATE INDEX "media_needs_curation_index" ON "media" USING btree ("needs_curation");--> statement-breakpoint
CREATE INDEX "records_needs_curation_index" ON "records" USING btree ("needs_curation");