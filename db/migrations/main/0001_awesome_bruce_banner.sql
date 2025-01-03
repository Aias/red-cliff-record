DROP INDEX "location_coordinates_idx";

--> statement-breakpoint
DROP INDEX "location_bounding_box_idx";

--> statement-breakpoint
ALTER TABLE "locations"
DROP COLUMN "coordinates";

--> statement-breakpoint
ALTER TABLE "locations"
DROP COLUMN "bounding_box";

DROP EXTENSION IF EXISTS postgis CASCADE;