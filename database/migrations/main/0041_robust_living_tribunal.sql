ALTER TABLE "adobe"."photographs" RENAME COLUMN "device" TO "source_device";--> statement-breakpoint
ALTER TABLE "adobe"."photographs" ADD COLUMN "camera_make" text;--> statement-breakpoint
ALTER TABLE "adobe"."photographs" ADD COLUMN "camera_model" text;--> statement-breakpoint
ALTER TABLE "adobe"."photographs" ADD COLUMN "camera_lens" text;--> statement-breakpoint
ALTER TABLE "adobe"."photographs" ADD COLUMN "exif" json;--> statement-breakpoint
ALTER TABLE "adobe"."photographs" ADD COLUMN "location" json;