-- Ruling magic-user-spellbook (Lars, 25 Nov 2026): a magic-user prepares, and
-- stores in a staff or wand, only spells in their spellbook. The highlights
-- from 0016 become the book.
ALTER TABLE "characters" RENAME COLUMN "spells_marked" TO "spellbook";--> statement-breakpoint
-- Each existing magic-user's book starts with the spells the player highlighted,
-- plus every magic-user spell now prepared or stored in the staff (a slot whose
-- latest event is a load), so nothing in use stops being valid. Characters
-- without a magic-user class keep an empty book.
UPDATE "characters" c SET "spellbook" = (
  SELECT coalesce(array_agg(DISTINCT s.k ORDER BY s.k), '{}'::text[])
  FROM (
    SELECT unnest(c."spellbook") AS k
    UNION
    SELECT unnest(c."spells_prepared")
    UNION
    SELECT e."spell" FROM (
      SELECT DISTINCT ON (ev."slot") ev."spell", ev."action"
      FROM "stored_spell_events" ev
      WHERE ev."character_id" = c."id"
      ORDER BY ev."slot", ev."created_at" DESC
    ) e
    WHERE e."action" = 'load'
  ) s
  WHERE s.k LIKE 'mu:%'
)
WHERE EXISTS (SELECT 1 FROM "character_classes" k WHERE k."character_id" = c."id" AND k."class" = 'magic-user');
