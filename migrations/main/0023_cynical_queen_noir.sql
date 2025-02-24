-- Add the 'base_url' column without the NOT NULL constraint
ALTER TABLE "lightroom_images" ADD COLUMN "base_url" text; --> statement-breakpoint

-- Update all rows to set 'base_url' to the specified value
UPDATE "lightroom_images" SET "base_url" = 'https://photos.adobe.io/v2/spaces/f89a3c5060d8467a952c66de97edbe39/';

-- Now add the NOT NULL constraint
ALTER TABLE "lightroom_images" ALTER COLUMN "base_url" SET NOT NULL;

-- Convert the "type" column in "public"."records" to text to allow value updates
ALTER TABLE "public"."records" ALTER COLUMN "type" SET DATA TYPE text; --> statement-breakpoint

-- Update rows where type is 'agent' or 'abstraction'
UPDATE "public"."records" SET "type" = 'entity' WHERE "type" = 'agent';
UPDATE "public"."records" SET "type" = 'concept' WHERE "type" = 'abstraction';
UPDATE "public"."records" SET "type" = 'artifact' WHERE "type" = 'record';
-- Drop the existing enum type
DROP TYPE "public"."record_type"; --> statement-breakpoint

-- Create the new enum type with the updated values
CREATE TYPE "public"."record_type" AS ENUM('entity', 'concept', 'artifact', 'event', 'place', 'system'); --> statement-breakpoint

-- Convert the "type" column to use the newly created enum type
ALTER TABLE "public"."records" ALTER COLUMN "type" SET DATA TYPE "public"."record_type" USING "type"::"public"."record_type";