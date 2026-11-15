DROP INDEX "hit_dice_level";--> statement-breakpoint
ALTER TABLE "hit_dice" ADD COLUMN "lost_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "hit_dice_level" ON "hit_dice" USING btree ("character_id","class","level") WHERE "hit_dice"."lost_at" is null;