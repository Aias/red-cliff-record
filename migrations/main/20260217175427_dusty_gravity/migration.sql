CREATE TABLE "elo_matchups" (
	"id" serial PRIMARY KEY,
	"record_a_id" integer NOT NULL,
	"record_b_id" integer NOT NULL,
	"winner_id" integer,
	"record_type" "record_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "elo_score" integer DEFAULT 1200 NOT NULL;--> statement-breakpoint
CREATE INDEX "elo_matchups_record_a_id_index" ON "elo_matchups" ("record_a_id");--> statement-breakpoint
CREATE INDEX "elo_matchups_record_b_id_index" ON "elo_matchups" ("record_b_id");--> statement-breakpoint
CREATE INDEX "elo_matchups_record_type_index" ON "elo_matchups" ("record_type");--> statement-breakpoint
CREATE INDEX "records_type_elo_score_index" ON "records" ("type","elo_score");--> statement-breakpoint
ALTER TABLE "elo_matchups" ADD CONSTRAINT "elo_matchups_record_a_id_records_id_fkey" FOREIGN KEY ("record_a_id") REFERENCES "records"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "elo_matchups" ADD CONSTRAINT "elo_matchups_record_b_id_records_id_fkey" FOREIGN KEY ("record_b_id") REFERENCES "records"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "elo_matchups" ADD CONSTRAINT "elo_matchups_winner_id_records_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "records"("id") ON DELETE SET NULL;