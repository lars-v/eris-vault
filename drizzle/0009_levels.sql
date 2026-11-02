CREATE TABLE "hit_dice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"class" text NOT NULL,
	"level" smallint NOT NULL,
	"roll_id" uuid NOT NULL,
	"gain" smallint,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "character_classes" ADD COLUMN "base_hp_level" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "hit_dice" ADD CONSTRAINT "hit_dice_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hit_dice" ADD CONSTRAINT "hit_dice_roll_id_rolls_id_fk" FOREIGN KEY ("roll_id") REFERENCES "public"."rolls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hit_dice_level" ON "hit_dice" USING btree ("character_id","class","level");--> statement-breakpoint
-- Imported characters' hit points already cover the level their sheet's XP
-- reached (thresholds from Woundwort's Warren pp. 7-9, as in advancement.ts),
-- so only later levels get a hit die rolled in the app.
UPDATE "character_classes" AS k SET "base_hp_level" = (
  SELECT max(t.level) FROM (VALUES
    ('fighting-man', 1, 0),
    ('fighting-man', 2, 2000),
    ('fighting-man', 3, 4000),
    ('fighting-man', 4, 8000),
    ('fighting-man', 5, 16000),
    ('fighting-man', 6, 32000),
    ('fighting-man', 7, 64000),
    ('fighting-man', 8, 125000),
    ('fighting-man', 9, 250000),
    ('magic-user', 1, 0),
    ('magic-user', 2, 2500),
    ('magic-user', 3, 5000),
    ('magic-user', 4, 10000),
    ('magic-user', 5, 20000),
    ('magic-user', 6, 35000),
    ('magic-user', 7, 50000),
    ('magic-user', 8, 75000),
    ('magic-user', 9, 100000),
    ('cleric', 1, 0),
    ('cleric', 2, 1500),
    ('cleric', 3, 3000),
    ('cleric', 4, 6000),
    ('cleric', 5, 12000),
    ('cleric', 6, 25000),
    ('cleric', 7, 50000),
    ('cleric', 8, 100000),
    ('cleric', 9, 200000),
    ('thief', 1, 0),
    ('thief', 2, 1250),
    ('thief', 3, 2500),
    ('thief', 4, 5000),
    ('thief', 5, 10000),
    ('thief', 6, 20000),
    ('thief', 7, 40000),
    ('thief', 8, 75000),
    ('thief', 9, 150000)
  ) AS t(cls, level, xp) WHERE t.cls = k."class" AND t.xp <= k."xp")
FROM "characters" AS c WHERE c."id" = k."character_id" AND c."source" <> 'app';
