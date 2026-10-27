CREATE TABLE "electoral"."organizational_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"canton_id" uuid NOT NULL,
	"position_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"ended_reason" text,
	"created_by" uuid NOT NULL,
	CONSTRAINT "assignment_dates" CHECK ("electoral"."organizational_assignments"."ended_at" IS NULL OR "electoral"."organizational_assignments"."ended_at" >= "electoral"."organizational_assignments"."started_at"),
	CONSTRAINT "assignment_end_reason" CHECK (("electoral"."organizational_assignments"."ended_at" IS NULL AND "electoral"."organizational_assignments"."ended_reason" IS NULL) OR ("electoral"."organizational_assignments"."ended_at" IS NOT NULL AND length(trim("electoral"."organizational_assignments"."ended_reason")) BETWEEN 3 AND 500))
);
--> statement-breakpoint
CREATE TABLE "electoral"."people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "person_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "person_name_required" CHECK (length(trim("electoral"."people"."full_name")) BETWEEN 2 AND 160)
);
--> statement-breakpoint
ALTER TABLE "electoral"."organizational_assignments" ADD CONSTRAINT "assignment_position_scope_fk" FOREIGN KEY ("position_id","organization_id","canton_id") REFERENCES "electoral"."organizational_positions"("id","organization_id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."organizational_assignments" ADD CONSTRAINT "assignment_person_scope_fk" FOREIGN KEY ("person_id","organization_id") REFERENCES "electoral"."people"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."people" ADD CONSTRAINT "people_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "electoral"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_current_assignment" ON "electoral"."organizational_assignments" USING btree ("position_id") WHERE "electoral"."organizational_assignments"."ended_at" IS NULL;--> statement-breakpoint
CREATE INDEX "assignment_person_idx" ON "electoral"."organizational_assignments" USING btree ("organization_id","person_id");--> statement-breakpoint
CREATE INDEX "people_org_idx" ON "electoral"."people" USING btree ("organization_id");
--> statement-breakpoint
ALTER TABLE electoral.organizational_assignments ADD CONSTRAINT assignment_auth_user_fk FOREIGN KEY (created_by) REFERENCES auth.users(id);
--> statement-breakpoint
REVOKE ALL ON electoral.people, electoral.organizational_assignments FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT SELECT ON electoral.people, electoral.organizational_assignments TO electoral_app;
--> statement-breakpoint
CREATE TRIGGER set_updated_at BEFORE UPDATE ON electoral.people FOR EACH ROW EXECUTE FUNCTION electoral.set_updated_at();
--> statement-breakpoint
-- Solo operaciones controladas; el login SQL no puede escribir tablas ni alterar auditoría.
CREATE FUNCTION electoral.save_person(p_actor uuid, p_org uuid, p_canton uuid, p_id uuid, p_version text, p_name text, p_email text, p_phone text, p_notes text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, electoral AS $$
DECLARE v_id uuid; v_updated timestamptz;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM electoral.organization_memberships m JOIN electoral.organizations o ON o.id=m.organization_id JOIN electoral.organization_cantons c ON c.organization_id=o.id WHERE m.organization_id=p_org AND m.user_id=p_actor AND m.active AND m.role='admin' AND o.active AND c.canton_id=p_canton AND c.active) THEN RAISE EXCEPTION 'Acceso denegado' USING ERRCODE='42501'; END IF;
 IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 2 AND 160 OR length(coalesce(p_email,''))>254 OR length(coalesce(p_phone,''))>40 OR length(coalesce(p_notes,''))>1000 THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023'; END IF;
 IF p_id IS NULL THEN
  INSERT INTO electoral.people(organization_id,full_name,email,phone,notes) VALUES(p_org,trim(p_name),nullif(trim(p_email),''),nullif(trim(p_phone),''),nullif(trim(p_notes),'')) RETURNING id INTO v_id;
 ELSE
  SELECT updated_at INTO v_updated FROM electoral.people WHERE id=p_id AND organization_id=p_org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Persona no disponible' USING ERRCODE='22023'; END IF;
  IF p_version IS NULL OR v_updated IS DISTINCT FROM p_version::timestamptz THEN RAISE EXCEPTION 'Datos modificados; recarga' USING ERRCODE='40001'; END IF;
  UPDATE electoral.people SET full_name=trim(p_name), email=nullif(trim(p_email),''), phone=nullif(trim(p_phone),''), notes=nullif(trim(p_notes),'') WHERE id=p_id;
  v_id:=p_id;
 END IF;
 INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action) VALUES(p_org,p_actor,'people',v_id,CASE WHEN p_id IS NULL THEN 'created' ELSE 'updated' END);
 RETURN v_id;
END $$;
--> statement-breakpoint
CREATE FUNCTION electoral.set_responsible(p_actor uuid, p_org uuid, p_canton uuid, p_position uuid, p_person uuid, p_expected uuid, p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, electoral AS $$
DECLARE v_current uuid; v_person uuid; v_now timestamptz := clock_timestamp();
BEGIN
 IF NOT EXISTS (SELECT 1 FROM electoral.organization_memberships m JOIN electoral.organizations o ON o.id=m.organization_id JOIN electoral.organization_cantons c ON c.organization_id=o.id WHERE m.organization_id=p_org AND m.user_id=p_actor AND m.active AND m.role='admin' AND o.active AND c.canton_id=p_canton AND c.active) THEN RAISE EXCEPTION 'Acceso denegado' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM electoral.organizational_positions WHERE id=p_position AND organization_id=p_org AND canton_id=p_canton AND active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Puesto no disponible' USING ERRCODE='22023'; END IF;
 SELECT id,person_id INTO v_current,v_person FROM electoral.organizational_assignments WHERE position_id=p_position AND ended_at IS NULL;
 IF v_current IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Asignación modificada; recarga' USING ERRCODE='40001'; END IF;
 IF v_person IS NOT DISTINCT FROM p_person THEN RETURN; END IF;
 IF p_person IS NOT NULL AND NOT EXISTS(SELECT 1 FROM electoral.people WHERE id=p_person AND organization_id=p_org) THEN RAISE EXCEPTION 'Persona no disponible' USING ERRCODE='22023'; END IF;
 IF v_current IS NOT NULL THEN
  IF p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Indica motivo' USING ERRCODE='22023'; END IF;
  UPDATE electoral.organizational_assignments SET ended_at=greatest(v_now,started_at),ended_reason=trim(p_reason) WHERE id=v_current;
 END IF;
 IF p_person IS NOT NULL THEN
  INSERT INTO electoral.organizational_assignments(organization_id,canton_id,position_id,person_id,created_by,started_at) VALUES(p_org,p_canton,p_position,p_person,p_actor,v_now);
 END IF;
 INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action,before_json,after_json) VALUES(p_org,p_actor,'organizational_positions',p_position,'responsible_changed',jsonb_build_object('person_id',v_person),jsonb_build_object('person_id',p_person));
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.save_person(uuid,uuid,uuid,uuid,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.set_responsible(uuid,uuid,uuid,uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.save_person(uuid,uuid,uuid,uuid,text,text,text,text,text) TO electoral_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.set_responsible(uuid,uuid,uuid,uuid,uuid,uuid,text) TO electoral_app;
