CREATE SCHEMA "github";
--> statement-breakpoint
ALTER TYPE "public"."commit_change_status" SET SCHEMA "github";--> statement-breakpoint
ALTER TABLE "public"."commit_changes" SET SCHEMA "github";
--> statement-breakpoint
ALTER TABLE "public"."commits" SET SCHEMA "github";
