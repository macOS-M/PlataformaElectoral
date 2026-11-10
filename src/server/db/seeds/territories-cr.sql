-- Catálogo territorial real acotado para un evento de pruebas. No crea distritos.
-- El invocador debe ejecutar set_config y esta carga dentro de UNA transacción.
DO $$
DECLARE
 v_org uuid := current_setting('electoral.seed_org')::uuid;
 v_event uuid := current_setting('electoral.seed_event')::uuid;
 v_catalog jsonb := current_setting('electoral.seed_catalog')::jsonb;
 p jsonb; c jsonb; v_province uuid; v_canton uuid; v_count integer;
 v_old_province electoral.provinces; v_old_canton electoral.cantons;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM electoral.election_events e JOIN electoral.organizations o ON o.id=e.organization_id WHERE e.id=v_event AND e.organization_id=v_org AND e.is_demo AND o.active) THEN
  RAISE EXCEPTION 'La carga territorial requiere un evento de demostración activo';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtext('territories-cr-test-seed'));
 FOR p IN SELECT value FROM jsonb_array_elements(v_catalog->'provinces') LOOP
  SELECT count(*),min(id::text)::uuid INTO v_count,v_province FROM electoral.provinces
  WHERE official_code=p->>'code' OR translate(lower(trim(name)),'áéíóúü','aeiouu')=translate(lower(p->>'name'),'áéíóúü','aeiouu');
  IF v_count>1 THEN RAISE EXCEPTION 'Provincia ambigua: reconciliar sin duplicar'; END IF;
  IF v_province IS NULL THEN
   v_province:=md5('cr-province-' || (p->>'code'))::uuid;
   INSERT INTO electoral.provinces(id,name,official_code,source_url) VALUES(v_province,p->>'name',p->>'code',v_catalog->>'provinceSource');
  ELSE
   SELECT * INTO v_old_province FROM electoral.provinces WHERE id=v_province FOR UPDATE;
   IF (v_old_province.official_code IS NOT NULL AND v_old_province.official_code<>p->>'code') OR translate(lower(trim(v_old_province.name)),'áéíóúü','aeiouu')<>translate(lower(p->>'name'),'áéíóúü','aeiouu') THEN
    RAISE EXCEPTION 'Provincia incompatible: no se sobrescribe el catálogo';
   END IF;
   UPDATE electoral.provinces SET official_code=p->>'code',source_url=v_catalog->>'provinceSource' WHERE id=v_province AND official_code IS NULL;
  END IF;
  FOR c IN SELECT value FROM jsonb_array_elements(p->'cantons') LOOP
   SELECT count(*),min(id::text)::uuid INTO v_count,v_canton FROM electoral.cantons
   WHERE official_code=c->>'code' OR translate(lower(trim(name)),'áéíóúü','aeiouu')=translate(lower(c->>'name'),'áéíóúü','aeiouu');
   IF v_count>1 THEN RAISE EXCEPTION 'Cantón ambiguo: reconciliar sin duplicar'; END IF;
   IF v_canton IS NULL THEN
    v_canton:=md5('cr-canton-' || (c->>'code'))::uuid;
    INSERT INTO electoral.cantons(id,name,official_code,province_code,province_id) VALUES(v_canton,c->>'name',c->>'code',p->>'code',v_province);
   ELSE
    SELECT * INTO v_old_canton FROM electoral.cantons WHERE id=v_canton FOR UPDATE;
    IF (v_old_canton.official_code IS NOT NULL AND v_old_canton.official_code<>c->>'code') OR (v_old_canton.province_id IS NOT NULL AND v_old_canton.province_id<>v_province) OR (v_old_canton.province_code IS NOT NULL AND v_old_canton.province_code<>p->>'code') OR translate(lower(trim(v_old_canton.name)),'áéíóúü','aeiouu')<>translate(lower(c->>'name'),'áéíóúü','aeiouu') THEN
     RAISE EXCEPTION 'Cantón incompatible: no se sobrescribe el catálogo';
    END IF;
    UPDATE electoral.cantons SET official_code=c->>'code',province_code=p->>'code',province_id=v_province
    WHERE id=v_canton AND (official_code IS NULL OR province_code IS NULL OR province_id IS NULL);
   END IF;
   IF EXISTS(SELECT 1 FROM electoral.organization_cantons WHERE organization_id=v_org AND canton_id=v_canton AND NOT active) THEN RAISE EXCEPTION 'Vínculo inactivo: no se reactiva por semilla'; END IF;
   INSERT INTO electoral.organization_cantons(organization_id,canton_id) VALUES(v_org,v_canton) ON CONFLICT DO NOTHING;
  END LOOP;
 END LOOP;
 INSERT INTO electoral.audit_logs(id,organization_id,entity,entity_id,action,after_json)
 VALUES(md5((v_catalog->>'version') || '-' || v_org::text)::uuid,v_org,'territorial_catalog',v_org,'seed_cr_test_catalog',jsonb_build_object('dataset',v_catalog,'eventId',v_event,'purpose','Catálogo territorial de pruebas; no acredita centros TSE')) ON CONFLICT DO NOTHING;
END $$;
