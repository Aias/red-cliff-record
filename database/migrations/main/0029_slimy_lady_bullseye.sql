CREATE SCHEMA "raindrop";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "raindrop"."collections" (
	"id" integer PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"parent_id" integer,
	"color_hex" text,
	"cover_url" text,
	"raindrop_count" integer,
	"integration_run_id" integer NOT NULL,
	"updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "raindrop"."raindrops" (
	"id" integer PRIMARY KEY NOT NULL,
	"link_url" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text,
	"note" text,
	"type" text,
	"cover_image_url" text,
	"tags" text[],
	"important" boolean DEFAULT false NOT NULL,
	"domain" text,
	"collection_id" integer NOT NULL,
	"integration_run_id" integer NOT NULL,
	"updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "raindrops_linkUrl_createdAt_unique" UNIQUE("link_url","created_at")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "raindrop"."collections" ADD CONSTRAINT "collections_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "integrations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "raindrop"."collections" ADD CONSTRAINT "collections_parent_id_collections_id_fk" FOREIGN KEY ("parent_id") REFERENCES "raindrop"."collections"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "raindrop"."raindrops" ADD CONSTRAINT "raindrops_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "raindrop"."collections"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "raindrop"."raindrops" ADD CONSTRAINT "raindrops_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "integrations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collections_parent_id_index" ON "raindrop"."collections" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "raindrops_integration_run_id_index" ON "raindrop"."raindrops" USING btree ("integration_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "raindrops_link_url_index" ON "raindrop"."raindrops" USING btree ("link_url");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "raindrops_created_at_index" ON "raindrop"."raindrops" USING btree ("created_at");