CREATE INDEX "records_parent_id_index" ON "records" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "records_transclude_id_index" ON "records" USING btree ("transclude_id");--> statement-breakpoint
CREATE INDEX idx_records_content_search 
ON records 
USING gin (
  title gin_trgm_ops, 
  content gin_trgm_ops, 
  summary gin_trgm_ops, 
  notes gin_trgm_ops, 
  media_caption gin_trgm_ops
);