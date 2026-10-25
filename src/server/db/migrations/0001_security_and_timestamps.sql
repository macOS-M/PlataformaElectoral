-- Supabase administra auth.users; las pruebas crean un sustituto mínimo.
ALTER TABLE electoral.organization_memberships ADD CONSTRAINT membership_auth_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE electoral.audit_logs ADD CONSTRAINT audit_auth_user_fk FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
--> statement-breakpoint
REVOKE ALL ON SCHEMA electoral FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA electoral FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'electoral_app') THEN CREATE ROLE electoral_app NOLOGIN; END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON SCHEMA electoral FROM anon;
    REVOKE ALL ON ALL TABLES IN SCHEMA electoral FROM anon;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON SCHEMA electoral FROM authenticated;
    REVOKE ALL ON ALL TABLES IN SCHEMA electoral FROM authenticated;
  END IF;
END $$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA electoral TO electoral_app;
--> statement-breakpoint
GRANT SELECT ON ALL TABLES IN SCHEMA electoral TO electoral_app;
--> statement-breakpoint
-- Sprint 1 solo consulta; no conceder escrituras genéricas a la aplicación.
ALTER DEFAULT PRIVILEGES IN SCHEMA electoral REVOKE ALL ON TABLES FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION electoral.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
--> statement-breakpoint
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT table_name FROM information_schema.columns WHERE table_schema = 'electoral' AND column_name = 'updated_at' LOOP
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON electoral.%I FOR EACH ROW EXECUTE FUNCTION electoral.set_updated_at()', t);
  END LOOP;
END $$;
--> statement-breakpoint
CREATE FUNCTION electoral.prevent_position_cycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.parent_position_id IS NOT NULL AND EXISTS (
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_position_id FROM electoral.organizational_positions WHERE id = NEW.parent_position_id
      UNION
      SELECT p.id, p.parent_position_id FROM electoral.organizational_positions p JOIN ancestors a ON p.id = a.parent_position_id
    ) SELECT 1 FROM ancestors WHERE id = NEW.id
  ) THEN RAISE EXCEPTION 'La jerarquía no puede contener ciclos'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER prevent_position_cycle BEFORE INSERT OR UPDATE ON electoral.organizational_positions FOR EACH ROW EXECUTE FUNCTION electoral.prevent_position_cycle();
