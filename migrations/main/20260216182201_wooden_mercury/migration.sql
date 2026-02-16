DROP INDEX "idx_records_content_search";--> statement-breakpoint
CREATE INDEX "idx_records_title_trgm" ON "records" USING gist ("title" gist_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_records_content_trgm" ON "records" USING gist ("content" gist_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_records_summary_trgm" ON "records" USING gist ("summary" gist_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_records_abbreviation_trgm" ON "records" USING gist ("abbreviation" gist_trgm_ops);