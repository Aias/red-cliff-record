CREATE TABLE IF NOT EXISTS "locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"location_type" text DEFAULT 'Place' NOT NULL,
	"description" text,
	"coordinates" geometry(Point, 4326) NOT NULL,
	"bounding_box" geometry(MultiPolygon, 4326),
	"source_data" json,
	"map_url_id" integer,
	"address" text,
	"timezone" text,
	"population" integer,
	"elevation" integer,
	"parent_location_id" integer,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "location_name_type_parent_idx" UNIQUE("name","location_type","parent_location_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "locations" ADD CONSTRAINT "locations_map_url_id_urls_id_fk" FOREIGN KEY ("map_url_id") REFERENCES "public"."urls"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_location_id_locations_id_fk" FOREIGN KEY ("parent_location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "location_coordinates_idx" ON "locations" USING gist ("coordinates");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "location_bounding_box_idx" ON "locations" USING gist ("bounding_box");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "location_type_idx" ON "locations" USING btree ("location_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "location_parent_idx" ON "locations" USING btree ("parent_location_id");