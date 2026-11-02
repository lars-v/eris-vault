CREATE TABLE "roll_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"granted_by" text NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"used_roll_id" uuid,
	"used_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "characters" ALTER COLUMN "race" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ALTER COLUMN "alignment" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ALTER COLUMN "str" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ALTER COLUMN "int" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ALTER COLUMN "wis" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ALTER COLUMN "dex" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ALTER COLUMN "con" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ALTER COLUMN "cha" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ALTER COLUMN "hp_current" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ALTER COLUMN "hp_max" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory" ALTER COLUMN "enc_units" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "inventory" ALTER COLUMN "enc_units" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "hp_roll_id" uuid;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "gold_roll_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "catalog_key" text;--> statement-breakpoint
ALTER TABLE "roll_grants" ADD CONSTRAINT "roll_grants_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roll_grants" ADD CONSTRAINT "roll_grants_granted_by_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;