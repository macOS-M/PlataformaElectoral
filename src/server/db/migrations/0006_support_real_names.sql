-- Nombre de cuentas existentes, únicamente por administración global.
CREATE FUNCTION electoral.name_refresh_target(p_actor uuid,p_org uuid,p_canton uuid,p_id uuid,p_hash text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
DECLARE v_auth electoral.registration_authorizations; v_user uuid; v_person uuid;
BEGIN
 PERFORM electoral.require_global_admin(p_actor,p_org);
 IF p_hash IS NULL OR p_hash !~ '^[a-f0-9]{64}$' OR NOT EXISTS(SELECT 1 FROM electoral.organization_cantons WHERE organization_id=p_org AND canton_id=p_canton AND active) THEN RAISE EXCEPTION 'Datos no disponibles' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_auth FROM electoral.registration_authorizations WHERE id=p_id AND organization_id=p_org AND canton_id=p_canton;
 IF FOUND THEN
  IF v_auth.user_id IS NULL OR v_auth.identifier_hash IS DISTINCT FROM p_hash THEN RAISE EXCEPTION 'Cédula no corresponde a cuenta' USING ERRCODE='22023'; END IF;
  v_user:=v_auth.user_id;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM electoral.organization_memberships WHERE organization_id=p_org AND user_id=p_id) OR EXISTS(SELECT 1 FROM electoral.registration_authorizations WHERE user_id=p_id AND organization_id=p_org) THEN RAISE EXCEPTION 'Cuenta no disponible' USING ERRCODE='22023'; END IF;
  -- Las cuentas iniciales con correo no tienen una cédula almacenada.
  v_user:=p_id;
 END IF;
 SELECT person_id INTO v_person FROM electoral.user_people WHERE organization_id=p_org AND user_id=v_user;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ficha no disponible' USING ERRCODE='22023'; END IF;
 RETURN v_person;
END $$;
--> statement-breakpoint
CREATE FUNCTION electoral.refresh_user_name(p_actor uuid,p_org uuid,p_canton uuid,p_id uuid,p_hash text,p_name text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
DECLARE v_person uuid;
BEGIN
 v_person:=electoral.name_refresh_target(p_actor,p_org,p_canton,p_id,p_hash);
 IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 2 AND 160 THEN RAISE EXCEPTION 'Nombre no válido' USING ERRCODE='22023'; END IF;
 UPDATE electoral.people SET full_name=trim(p_name) WHERE id=v_person AND organization_id=p_org;
 INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action) VALUES(p_org,p_actor,'people',v_person,'name_from_soportereal');
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.name_refresh_target(uuid,uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.refresh_user_name(uuid,uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.name_refresh_target(uuid,uuid,uuid,uuid,text) TO electoral_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.refresh_user_name(uuid,uuid,uuid,uuid,text,text) TO electoral_app;
