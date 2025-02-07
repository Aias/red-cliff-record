ALTER TABLE "raindrop_tags" ADD COLUMN "index_entry_id" integer;--> statement-breakpoint
ALTER TABLE "raindrop_tags" ADD CONSTRAINT "raindrop_tags_index_entry_id_indices_id_fk" FOREIGN KEY ("index_entry_id") REFERENCES "public"."indices"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "raindrop_tags_tag_index" ON "raindrop_tags" USING btree ("tag");--> statement-breakpoint
CREATE INDEX "raindrop_tags_index_entry_id_index" ON "raindrop_tags" USING btree ("index_entry_id");