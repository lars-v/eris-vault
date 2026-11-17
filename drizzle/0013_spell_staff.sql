CREATE TABLE "stored_spell_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"inventory_id" uuid,
	"slot" smallint NOT NULL,
	"spell" text NOT NULL,
	"action" text NOT NULL,
	"actor_id" text NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "stored_spell_events_slot_check" CHECK ("stored_spell_events"."slot" in (1, 2)),
	CONSTRAINT "stored_spell_events_action_check" CHECK ("stored_spell_events"."action" in ('load', 'release', 'void'))
);
--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "is_spell_focus" boolean;--> statement-breakpoint
ALTER TABLE "stored_spell_events" ADD CONSTRAINT "stored_spell_events_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stored_spell_events" ADD CONSTRAINT "stored_spell_events_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stored_spell_events_slot" ON "stored_spell_events" USING btree ("character_id","slot","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_one_spell_focus" ON "inventory" USING btree ("character_id") WHERE "inventory"."is_spell_focus";--> statement-breakpoint
-- Stored spell events can be added to, never changed or removed, like rolls
-- and audit_log (0001_insert_only_tables.sql).
CREATE TRIGGER stored_spell_events_insert_only BEFORE UPDATE OR DELETE ON "stored_spell_events"
  FOR EACH ROW EXECUTE FUNCTION eris_insert_only();
