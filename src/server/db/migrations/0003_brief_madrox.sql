CREATE TABLE "electoral"."auth_attempts" (
	"key" text PRIMARY KEY NOT NULL,
	"window_started" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "electoral"."module_permissions" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"canton_id" uuid NOT NULL,
	"module" text NOT NULL,
	CONSTRAINT "module_permissions_organization_id_user_id_canton_id_module_pk" PRIMARY KEY("organization_id","user_id","canton_id","module"),
	CONSTRAINT "permission_module" CHECK ("electoral"."module_permissions"."module" IN ('district','organigrama','centros','A01','A02','A03','A04','A05','A06','A07','A08','A09'))
);
--> statement-breakpoint
CREATE TABLE "electoral"."registration_authorizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"canton_id" uuid NOT NULL,
	"identifier_hash" text NOT NULL,
	"identifier_hint" text NOT NULL,
	"activation_hash" text,
	"role" text DEFAULT 'member' NOT NULL,
	"modules" text[] DEFAULT '{}'::text[] NOT NULL,
	"authorized_by" uuid NOT NULL,
	"user_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"claim_token" uuid,
	"claim_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registration_authorizations_identifier_hash_unique" UNIQUE("identifier_hash"),
	CONSTRAINT "registration_authorizations_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "registration_role" CHECK ("electoral"."registration_authorizations"."role" IN ('admin','member')),
	CONSTRAINT "registration_modules" CHECK ("electoral"."registration_authorizations"."modules" <@ ARRAY['district','organigrama','centros','A01','A02','A03','A04','A05','A06','A07','A08','A09']::text[])
);
--> statement-breakpoint
ALTER TABLE "electoral"."organization_memberships" DROP CONSTRAINT "membership_role";--> statement-breakpoint
ALTER TABLE "electoral"."organization_memberships" ALTER COLUMN "role" SET DEFAULT 'member';--> statement-breakpoint
ALTER TABLE "electoral"."module_permissions" ADD CONSTRAINT "permission_membership_fk" FOREIGN KEY ("organization_id","user_id") REFERENCES "electoral"."organization_memberships"("organization_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."module_permissions" ADD CONSTRAINT "permission_scope_fk" FOREIGN KEY ("organization_id","canton_id") REFERENCES "electoral"."organization_cantons"("organization_id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."registration_authorizations" ADD CONSTRAINT "registration_authorizations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "electoral"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."registration_authorizations" ADD CONSTRAINT "registration_scope_fk" FOREIGN KEY ("organization_id","canton_id") REFERENCES "electoral"."organization_cantons"("organization_id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."organization_memberships" ADD CONSTRAINT "membership_role" CHECK ("electoral"."organization_memberships"."role" IN ('admin', 'member'));
--> statement-breakpoint
ALTER TABLE electoral.registration_authorizations ADD CONSTRAINT registration_author_fk FOREIGN KEY(authorized_by) REFERENCES auth.users(id);
--> statement-breakpoint
ALTER TABLE electoral.registration_authorizations ADD CONSTRAINT registration_user_fk FOREIGN KEY(user_id) REFERENCES auth.users(id);
--> statement-breakpoint
REVOKE ALL ON electoral.module_permissions,electoral.registration_authorizations,electoral.auth_attempts FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
GRANT SELECT ON electoral.module_permissions TO electoral_app;
--> statement-breakpoint
CREATE FUNCTION electoral.can_edit_module(p_actor uuid,p_org uuid,p_canton uuid,p_module text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
 SELECT EXISTS(SELECT 1 FROM electoral.organization_memberships m JOIN electoral.organizations o ON o.id=m.organization_id JOIN electoral.organization_cantons c ON c.organization_id=o.id WHERE m.organization_id=p_org AND m.user_id=p_actor AND m.active AND o.active AND c.canton_id=p_canton AND c.active AND (m.role='admin' OR EXISTS(SELECT 1 FROM electoral.module_permissions p WHERE p.organization_id=p_org AND p.user_id=p_actor AND p.canton_id=p_canton AND (p.module=p_module OR p.module='district'))))
$$;
--> statement-breakpoint
CREATE FUNCTION electoral.require_global_admin(p_actor uuid,p_org uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM electoral.organization_memberships m JOIN electoral.organizations o ON o.id=m.organization_id WHERE m.user_id=p_actor AND m.organization_id=p_org AND m.role='admin' AND m.active AND o.active) THEN RAISE EXCEPTION 'Acceso denegado' USING ERRCODE='42501'; END IF;
END $$;
--> statement-breakpoint
CREATE FUNCTION electoral.authorize_registration(p_actor uuid,p_org uuid,p_canton uuid,p_hash text,p_hint text,p_activation text,p_role text,p_modules text[]) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$ DECLARE v_id uuid; BEGIN
 PERFORM electoral.require_global_admin(p_actor,p_org);
 IF p_hash !~ '^[a-f0-9]{64}$' OR p_hint !~ '^[0-9]{4}$' OR p_activation IS NULL OR p_activation !~ '^[a-f0-9]{64}$' OR p_role NOT IN ('admin','member') OR p_modules IS NULL THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM electoral.organization_cantons WHERE organization_id=p_org AND canton_id=p_canton AND active) THEN RAISE EXCEPTION 'Ámbito inválido' USING ERRCODE='22023'; END IF;
 INSERT INTO electoral.registration_authorizations(organization_id,canton_id,identifier_hash,identifier_hint,activation_hash,role,modules,authorized_by) VALUES(p_org,p_canton,p_hash,p_hint,p_activation,p_role,p_modules,p_actor) RETURNING id INTO v_id;
 INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action) VALUES(p_org,p_actor,'registration_authorizations',v_id,'authorized');
 RETURN v_id;
END $$;
--> statement-breakpoint
CREATE FUNCTION electoral.list_access(p_actor uuid,p_org uuid,p_canton uuid) RETURNS TABLE(id uuid,hint text,role text,modules text[],user_id uuid,active boolean,created_at timestamptz) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$ BEGIN
 PERFORM electoral.require_global_admin(p_actor,p_org);
 RETURN QUERY SELECT a.id,a.identifier_hint,coalesce(m.role,a.role),CASE WHEN a.user_id IS NULL THEN a.modules ELSE ARRAY(SELECT p.module FROM electoral.module_permissions p WHERE p.organization_id=p_org AND p.user_id=a.user_id AND p.canton_id=p_canton) END,a.user_id,a.active AND coalesce(m.active,true),a.created_at FROM electoral.registration_authorizations a LEFT JOIN electoral.organization_memberships m ON m.organization_id=a.organization_id AND m.user_id=a.user_id WHERE a.organization_id=p_org AND a.canton_id=p_canton UNION ALL SELECT m.user_id,'Cuenta inicial',m.role,ARRAY(SELECT p.module FROM electoral.module_permissions p WHERE p.organization_id=p_org AND p.user_id=m.user_id AND p.canton_id=p_canton),m.user_id,m.active,m.created_at FROM electoral.organization_memberships m WHERE m.organization_id=p_org AND NOT EXISTS(SELECT 1 FROM electoral.registration_authorizations a WHERE a.organization_id=p_org AND a.user_id=m.user_id);
END $$;
--> statement-breakpoint
CREATE FUNCTION electoral.manage_access(p_actor uuid,p_org uuid,p_canton uuid,p_id uuid,p_role text,p_modules text[],p_active boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$ DECLARE v_auth electoral.registration_authorizations; v_membership electoral.organization_memberships; v_target uuid; v_found boolean; BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_org::text,0));
 PERFORM electoral.require_global_admin(p_actor,p_org);
 IF p_role IS NULL OR p_role NOT IN ('admin','member') OR p_modules IS NULL OR NOT p_modules <@ ARRAY['district','organigrama','centros','A01','A02','A03','A04','A05','A06','A07','A08','A09']::text[] OR p_active IS NULL THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_auth FROM electoral.registration_authorizations WHERE id=p_id AND organization_id=p_org AND canton_id=p_canton FOR UPDATE;
 v_found:=FOUND;
 v_target:=CASE WHEN v_found THEN v_auth.user_id ELSE p_id END;
 IF NOT v_found AND NOT EXISTS(SELECT 1 FROM electoral.organization_memberships WHERE organization_id=p_org AND user_id=v_target) THEN RAISE EXCEPTION 'Registro no disponible' USING ERRCODE='22023'; END IF;
 IF v_target IS NOT NULL THEN
  SELECT * INTO v_membership FROM electoral.organization_memberships WHERE organization_id=p_org AND user_id=v_target FOR UPDATE;
  IF v_membership.active AND v_membership.role='admin' AND (NOT p_active OR p_role<>'admin') AND (SELECT count(*) FROM electoral.organization_memberships WHERE organization_id=p_org AND active AND role='admin')<=1 THEN RAISE EXCEPTION 'Debe quedar un administrador activo' USING ERRCODE='22023'; END IF;
  UPDATE electoral.organization_memberships SET role=p_role,active=p_active WHERE organization_id=p_org AND user_id=v_target;
  DELETE FROM electoral.module_permissions WHERE organization_id=p_org AND user_id=v_target AND canton_id=p_canton;
  INSERT INTO electoral.module_permissions(organization_id,user_id,canton_id,module) SELECT p_org,v_target,p_canton,x FROM (SELECT DISTINCT unnest(p_modules) AS x) t;
 END IF;
 UPDATE electoral.registration_authorizations SET role=p_role,modules=p_modules,active=p_active,claim_token=NULL,claim_expires_at=NULL WHERE id=p_id;
 INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action) VALUES(p_org,p_actor,'registration_authorizations',p_id,'access_changed');
END $$;
--> statement-breakpoint
CREATE FUNCTION electoral.registration_claim(p_hash text,p_activation text,p_org uuid,p_token uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$ DECLARE v_id uuid; BEGIN
 UPDATE electoral.registration_authorizations a SET claim_token=p_token,claim_expires_at=now()+interval '2 minutes' WHERE a.identifier_hash=p_hash AND a.organization_id=p_org AND a.active AND a.user_id IS NULL AND (a.claim_expires_at IS NULL OR a.claim_expires_at<now()) AND (a.activation_hash IS NULL OR a.activation_hash=p_activation) AND EXISTS(SELECT 1 FROM electoral.organizations o JOIN electoral.organization_cantons c ON c.organization_id=o.id WHERE o.id=p_org AND o.active AND c.canton_id=a.canton_id AND c.active) RETURNING a.id INTO v_id;
 RETURN v_id;
END $$;
--> statement-breakpoint
CREATE FUNCTION electoral.release_registration(p_id uuid,p_token uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
 UPDATE electoral.registration_authorizations SET claim_token=NULL,claim_expires_at=NULL WHERE id=p_id AND claim_token=p_token AND user_id IS NULL
$$;
--> statement-breakpoint
CREATE FUNCTION electoral.auth_alias(p_hash text,p_org uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
 SELECT a.id::text || '@accounts.cantonal.invalid' FROM electoral.registration_authorizations a JOIN electoral.organization_memberships m ON m.user_id=a.user_id AND m.organization_id=a.organization_id WHERE a.identifier_hash=p_hash AND a.organization_id=p_org AND a.active AND m.active
$$;
--> statement-breakpoint
-- La autorización se consume y la membresía se crea en la transacción de Auth.
CREATE FUNCTION electoral.complete_authorized_registration() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$ DECLARE v_auth electoral.registration_authorizations; BEGIN
 IF coalesce(NEW.raw_app_meta_data->>'electoral_invitation','')='' THEN RETURN NEW; END IF;
 SELECT * INTO v_auth FROM electoral.registration_authorizations WHERE id=(NEW.raw_app_meta_data->>'electoral_invitation')::uuid FOR UPDATE;
 IF NOT FOUND OR NOT v_auth.active OR v_auth.user_id IS NOT NULL OR v_auth.claim_token IS DISTINCT FROM (NEW.raw_app_meta_data->>'electoral_claim')::uuid OR v_auth.claim_token IS NULL OR v_auth.claim_expires_at IS NULL OR v_auth.claim_expires_at<now() OR NEW.email IS DISTINCT FROM (v_auth.id::text || '@accounts.cantonal.invalid') THEN RAISE EXCEPTION 'Registro no autorizado' USING ERRCODE='42501'; END IF;
 INSERT INTO electoral.organization_memberships(organization_id,user_id,role,active) VALUES(v_auth.organization_id,NEW.id,v_auth.role,true);
 INSERT INTO electoral.module_permissions(organization_id,user_id,canton_id,module) SELECT v_auth.organization_id,NEW.id,v_auth.canton_id,x FROM (SELECT DISTINCT unnest(v_auth.modules) AS x) t;
 UPDATE electoral.registration_authorizations SET user_id=NEW.id,claim_token=NULL,claim_expires_at=NULL WHERE id=v_auth.id;
 INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action) VALUES(v_auth.organization_id,NEW.id,'registration_authorizations',v_auth.id,'registered');
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER complete_authorized_registration AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION electoral.complete_authorized_registration();
--> statement-breakpoint
CREATE FUNCTION electoral.check_auth_rate(p_key text,p_max integer,p_seconds integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$ DECLARE n integer; BEGIN
 IF length(p_key)<>64 OR p_max NOT BETWEEN 1 AND 200 OR p_seconds NOT BETWEEN 1 AND 3600 THEN RETURN false; END IF;
 DELETE FROM electoral.auth_attempts WHERE window_started<now()-interval '1 day';
 INSERT INTO electoral.auth_attempts(key,window_started,attempts) VALUES(p_key,now(),1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN electoral.auth_attempts.window_started<now()-make_interval(secs=>p_seconds) THEN 1 ELSE electoral.auth_attempts.attempts+1 END,window_started=CASE WHEN electoral.auth_attempts.window_started<now()-make_interval(secs=>p_seconds) THEN now() ELSE electoral.auth_attempts.window_started END RETURNING attempts INTO n;
 RETURN n<=p_max;
END $$;

--> statement-breakpoint
CREATE FUNCTION electoral.can_edit_position(p_actor uuid,p_org uuid,p_canton uuid,p_position uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
 SELECT EXISTS(SELECT 1 FROM electoral.organizational_positions p LEFT JOIN electoral.functional_areas a ON a.id=p.functional_area_id AND a.organization_id=p.organization_id WHERE p.id=p_position AND p.organization_id=p_org AND p.canton_id=p_canton AND p.active AND (electoral.can_edit_module(p_actor,p_org,p_canton,'organigrama') OR (p.kind IN ('area','area_link') AND electoral.can_edit_module(p_actor,p_org,p_canton,a.code))))
$$;
--> statement-breakpoint
CREATE FUNCTION electoral.can_edit_person(p_actor uuid,p_org uuid,p_canton uuid,p_person uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
 SELECT electoral.can_edit_module(p_actor,p_org,p_canton,'organigrama') OR (
 EXISTS(SELECT 1 FROM electoral.module_permissions p JOIN electoral.organization_memberships m ON m.organization_id=p.organization_id AND m.user_id=p.user_id WHERE p.organization_id=p_org AND p.user_id=p_actor AND p.canton_id=p_canton AND p.module ~ '^A0[1-9]$' AND m.active AND electoral.can_edit_module(p_actor,p_org,p_canton,p.module))
 AND (p_person IS NULL OR (
 EXISTS(SELECT 1 FROM electoral.organizational_assignments a WHERE a.organization_id=p_org AND a.person_id=p_person AND a.ended_at IS NULL AND electoral.can_edit_position(p_actor,p_org,p_canton,a.position_id))
 AND NOT EXISTS(SELECT 1 FROM electoral.organizational_assignments a WHERE a.organization_id=p_org AND a.person_id=p_person AND a.ended_at IS NULL AND (a.canton_id<>p_canton OR NOT electoral.can_edit_position(p_actor,p_org,p_canton,a.position_id)))
 )))
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION electoral.save_person(p_actor uuid, p_org uuid, p_canton uuid, p_id uuid, p_version text, p_name text, p_email text, p_phone text, p_notes text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, electoral AS $$
DECLARE v_id uuid; v_updated timestamptz;
BEGIN
 IF NOT electoral.can_edit_person(p_actor,p_org,p_canton,p_id) THEN RAISE EXCEPTION 'Acceso denegado' USING ERRCODE='42501'; END IF;
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
REVOKE ALL ON FUNCTION electoral.can_edit_module(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;

--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.can_edit_module(uuid,uuid,uuid,text) TO electoral_app;

--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.require_global_admin(uuid,uuid) FROM PUBLIC,anon,authenticated;

--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.authorize_registration(uuid,uuid,uuid,text,text,text,text,text[]) FROM PUBLIC,anon,authenticated;

--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.authorize_registration(uuid,uuid,uuid,text,text,text,text,text[]) TO electoral_app;

--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.list_access(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;

--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.list_access(uuid,uuid,uuid) TO electoral_app;

--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.manage_access(uuid,uuid,uuid,uuid,text,text[],boolean) FROM PUBLIC,anon,authenticated;

--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.manage_access(uuid,uuid,uuid,uuid,text,text[],boolean) TO electoral_app;

--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.registration_claim(text,text,uuid,uuid) FROM PUBLIC,anon,authenticated;

--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.registration_claim(text,text,uuid,uuid) TO electoral_app;

--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.release_registration(uuid,uuid) FROM PUBLIC,anon,authenticated;

--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.release_registration(uuid,uuid) TO electoral_app;

--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.auth_alias(text,uuid) FROM PUBLIC,anon,authenticated;

--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.auth_alias(text,uuid) TO electoral_app;

--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.check_auth_rate(text,integer,integer) FROM PUBLIC,anon,authenticated;

--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.check_auth_rate(text,integer,integer) TO electoral_app;

--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.complete_authorized_registration() FROM PUBLIC,anon,authenticated;

--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.can_edit_position(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.can_edit_position(uuid,uuid,uuid,uuid) TO electoral_app;

--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.can_edit_person(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.can_edit_person(uuid,uuid,uuid,uuid) TO electoral_app;
