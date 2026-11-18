ALTER TABLE "hit_dice" ALTER COLUMN "roll_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "dark_sight_roll_id" uuid;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "dark_sight" boolean;