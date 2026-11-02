-- Rolls and the audit log can be added to, never changed or removed,
-- whoever is connected. Enforced in the database itself.
CREATE OR REPLACE FUNCTION eris_insert_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is insert-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER rolls_insert_only BEFORE UPDATE OR DELETE ON "rolls"
  FOR EACH ROW EXECUTE FUNCTION eris_insert_only();
--> statement-breakpoint
CREATE TRIGGER audit_log_insert_only BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION eris_insert_only();
