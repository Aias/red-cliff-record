CREATE TABLE "judgments" (
	"id" serial PRIMARY KEY,
	"record_id" integer,
	"question" text NOT NULL,
	"model" text NOT NULL,
	"fingerprint" text NOT NULL,
	"state" jsonb NOT NULL,
	"answers" jsonb NOT NULL,
	"result" jsonb,
	"input_tokens" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "judgments_record_id_question_created_at_index" ON "judgments" ("record_id","question","created_at");--> statement-breakpoint
CREATE INDEX "judgments_fingerprint_index" ON "judgments" ("fingerprint");--> statement-breakpoint
ALTER TABLE "judgments" ADD CONSTRAINT "judgments_record_id_records_id_fkey" FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE CASCADE ON UPDATE CASCADE;