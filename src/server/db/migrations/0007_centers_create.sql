-- Alta manual administrativa con ficha compartida, permisos y auditoría atómicos.
CREATE FUNCTION electoral.create_center(p_actor uuid,p_org uuid,p_canton uuid,p_event uuid,p_district uuid,p_name text,p_address text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
DECLARE v_center uuid; v_participation uuid;
BEGIN
 PERFORM electoral.require_global_admin(p_actor,p_org);
 IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 2 AND 160 OR p_address IS NULL OR length(trim(p_address)) NOT BETWEEN 2 AND 500 THEN
  RAISE EXCEPTION 'Datos de centro inválidos' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM electoral.organization_cantons WHERE organization_id=p_org AND canton_id=p_canton AND active)
 OR NOT EXISTS(SELECT 1 FROM electoral.election_events WHERE id=p_event AND organization_id=p_org)
 OR NOT EXISTS(SELECT 1 FROM electoral.districts WHERE id=p_district AND canton_id=p_canton AND active) THEN
  RAISE EXCEPTION 'Ámbito inválido' USING ERRCODE='42501';
 END IF;
 -- Serializa altas para no duplicar la ficha física por solicitudes concurrentes.
 PERFORM 1 FROM electoral.organizations WHERE id=p_org FOR UPDATE;
 SELECT id INTO v_center FROM electoral.voting_centers WHERE organization_id=p_org
  AND lower(trim(name))=lower(trim(p_name)) AND lower(trim(address))=lower(trim(p_address)) LIMIT 1;
 IF v_center IS NOT NULL AND (EXISTS(SELECT 1 FROM electoral.center_elections WHERE center_id=v_center AND event_id=p_event)
  OR EXISTS(SELECT 1 FROM electoral.voting_centers WHERE id=v_center AND archived_at IS NOT NULL)) THEN
  RAISE EXCEPTION 'Centro ya registrado' USING ERRCODE='23505';
 END IF;
 IF v_center IS NULL THEN
  INSERT INTO electoral.voting_centers(organization_id,name,address) VALUES(p_org,trim(p_name),trim(p_address)) RETURNING id INTO v_center;
 END IF;
 INSERT INTO electoral.center_elections(organization_id,center_id,event_id,canton_id,district_id,internal_status,data_source)
 VALUES(p_org,v_center,p_event,p_canton,p_district,'pendiente','manual') RETURNING id INTO v_participation;
 INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action)
 VALUES(p_org,p_actor,'center_elections',v_participation,'create_manual');
 RETURN v_participation;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.create_center(uuid,uuid,uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.create_center(uuid,uuid,uuid,uuid,uuid,text,text) TO electoral_app;
