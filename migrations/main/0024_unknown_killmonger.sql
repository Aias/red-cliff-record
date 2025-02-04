ALTER TABLE "media" ALTER COLUMN "format" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "public"."media" ALTER COLUMN "format" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."media_format";--> statement-breakpoint
CREATE TYPE "public"."media_format" AS ENUM('application', 'audio', 'font', 'image', 'message', 'model', 'multipart', 'text', 'video');--> statement-breakpoint
ALTER TABLE "public"."media" ALTER COLUMN "format" SET DATA TYPE "public"."media_format" USING "format"::"public"."media_format";--> statement-breakpoint
ALTER TABLE "media" ALTER COLUMN "format" SET DEFAULT 'application';