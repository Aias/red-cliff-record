CREATE INDEX "links_source_id_predicate_id_index" ON "links" USING btree ("source_id","predicate_id");--> statement-breakpoint
CREATE INDEX "links_target_id_predicate_id_index" ON "links" USING btree ("target_id","predicate_id");--> statement-breakpoint
CREATE INDEX "predicates_id_type_index" ON "predicates" USING btree ("id","type");