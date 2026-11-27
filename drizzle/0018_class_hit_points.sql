-- Hit points move to the class rows. WW p. 10 has an elf keep separate hit
-- points for each of its two classes, and Jay's ruling elf-second-class-hp
-- (17 Nov 2026) rolls 1st-level hit points for each class at creation.
ALTER TABLE "character_classes" ADD COLUMN "hp_max" smallint;--> statement-breakpoint
ALTER TABLE "character_classes" ADD COLUMN "hp_current" smallint;--> statement-breakpoint
ALTER TABLE "character_classes" ADD COLUMN "hp_roll_id" uuid;--> statement-breakpoint
-- Every character so far has one class row, the active one. It takes the
-- character's hit points and 1st-level roll.
UPDATE "character_classes" k
SET "hp_max" = c."hp_max", "hp_current" = c."hp_current", "hp_roll_id" = c."hp_roll_id"
FROM "characters" c
WHERE c."id" = k."character_id" AND k."active";--> statement-breakpoint
CREATE UNIQUE INDEX "character_classes_class" ON "character_classes" USING btree ("character_id","class");--> statement-breakpoint
CREATE UNIQUE INDEX "character_classes_one_active" ON "character_classes" USING btree ("character_id") WHERE "character_classes"."active";--> statement-breakpoint
-- characters.hp_max, hp_current and hp_roll_id stay as a copy of the active
-- class's, so pages that list characters read one row. The class row is the
-- one to write; this keeps the copy in step, including when an elf switches.
CREATE OR REPLACE FUNCTION eris_copy_active_class_hp() RETURNS trigger AS $$
BEGIN
  IF NEW."active" THEN
    UPDATE "characters"
    SET "hp_max" = NEW."hp_max", "hp_current" = NEW."hp_current", "hp_roll_id" = NEW."hp_roll_id"
    WHERE "id" = NEW."character_id";
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER character_classes_copy_hp
  AFTER INSERT OR UPDATE OF "hp_max", "hp_current", "hp_roll_id", "active" ON "character_classes"
  FOR EACH ROW EXECUTE FUNCTION eris_copy_active_class_hp();
