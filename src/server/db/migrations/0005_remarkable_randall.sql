CREATE TABLE "electoral"."user_people" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	CONSTRAINT "user_people_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id"),
	CONSTRAINT "user_person_unique" UNIQUE("organization_id","person_id")
);
--> statement-breakpoint
ALTER TABLE "electoral"."user_people" ADD CONSTRAINT "user_person_membership_fk" FOREIGN KEY ("organization_id","user_id") REFERENCES "electoral"."organization_memberships"("organization_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."user_people" ADD CONSTRAINT "user_person_person_fk" FOREIGN KEY ("person_id","organization_id") REFERENCES "electoral"."people"("id","organization_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
REVOKE ALL ON electoral.user_people FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
GRANT SELECT ON electoral.user_people TO electoral_app;
--> statement-breakpoint
-- Una cuenta tiene una sola ficha por organización, independientemente de sus cargos.
CREATE FUNCTION electoral.ensure_user_person(p_org uuid,p_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
DECLARE v_person uuid; v_name text; v_email text;
BEGIN
 IF EXISTS(SELECT 1 FROM electoral.user_people WHERE organization_id=p_org AND user_id=p_user) THEN RETURN; END IF;
 SELECT left(coalesce(nullif(trim(raw_user_meta_data->>'full_name'),''),nullif(trim(raw_user_meta_data->>'name'),''),'Cuenta sin nombre'),160),CASE WHEN email LIKE '%@accounts.cantonal.invalid' THEN NULL ELSE email END INTO v_name,v_email FROM auth.users WHERE id=p_user;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cuenta no disponible' USING ERRCODE='22023'; END IF;
 IF length(v_name)<2 THEN v_name:='Cuenta sin nombre'; END IF;
 INSERT INTO electoral.people(organization_id,full_name,email) VALUES(p_org,v_name,v_email) RETURNING id INTO v_person;
 INSERT INTO electoral.user_people(organization_id,user_id,person_id) VALUES(p_org,p_user,v_person);
END $$;
--> statement-breakpoint
CREATE FUNCTION electoral.on_membership_person() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$ BEGIN
 PERFORM electoral.ensure_user_person(NEW.organization_id,NEW.user_id);
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER membership_person AFTER INSERT ON electoral.organization_memberships FOR EACH ROW EXECUTE FUNCTION electoral.on_membership_person();
--> statement-breakpoint
DO $$ DECLARE m record; BEGIN
 FOR m IN SELECT organization_id,user_id FROM electoral.organization_memberships LOOP
  PERFORM electoral.ensure_user_person(m.organization_id,m.user_id);
 END LOOP;
END $$;
--> statement-breakpoint
CREATE FUNCTION electoral.assignable_person(p_org uuid,p_person uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
 SELECT EXISTS(SELECT 1 FROM electoral.user_people p JOIN electoral.organization_memberships m ON m.organization_id=p.organization_id AND m.user_id=p.user_id JOIN auth.users u ON u.id=p.user_id WHERE p.organization_id=p_org AND p.person_id=p_person AND m.active AND m.role IN ('admin','member') AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=now()) AND NOT EXISTS(SELECT 1 FROM electoral.registration_authorizations a WHERE a.user_id=p.user_id AND a.organization_id=p_org AND NOT a.active))
$$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION electoral.set_responsible(p_actor uuid, p_org uuid, p_canton uuid, p_position uuid, p_person uuid, p_expected uuid, p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, electoral AS $$
DECLARE v_current uuid; v_person uuid; v_now timestamptz := clock_timestamp();
BEGIN
 IF NOT electoral.can_edit_position(p_actor,p_org,p_canton,p_position) THEN RAISE EXCEPTION 'Acceso denegado' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM electoral.organizational_positions WHERE id=p_position AND organization_id=p_org AND canton_id=p_canton AND active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Puesto no disponible' USING ERRCODE='22023'; END IF;
 SELECT id,person_id INTO v_current,v_person FROM electoral.organizational_assignments WHERE position_id=p_position AND ended_at IS NULL;
 IF v_current IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Asignación modificada; recarga' USING ERRCODE='40001'; END IF;
 IF v_person IS NOT DISTINCT FROM p_person THEN RETURN; END IF;
 IF p_person IS NOT NULL AND NOT electoral.assignable_person(p_org,p_person) THEN RAISE EXCEPTION 'Persona no disponible' USING ERRCODE='22023'; END IF;
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
REVOKE ALL ON FUNCTION electoral.ensure_user_person(uuid,uuid) FROM PUBLIC,anon,authenticated;

--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.on_membership_person() FROM PUBLIC,anon,authenticated;

--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.assignable_person(uuid,uuid) FROM PUBLIC,anon,authenticated;

--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.assignable_person(uuid,uuid) TO electoral_app;
