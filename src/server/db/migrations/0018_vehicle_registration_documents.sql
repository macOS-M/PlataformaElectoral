CREATE TABLE "electoral"."vehicle_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"canton_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"payload_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_registration_hash" CHECK ("electoral"."vehicle_registrations"."payload_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "electoral"."vehicle_registrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "electoral"."vehicle_registrations" ADD CONSTRAINT "vehicle_registration_vehicle" FOREIGN KEY ("vehicle_id","organization_id","canton_id") REFERENCES "electoral"."vehicles"("id","organization_id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."vehicle_registrations" ADD CONSTRAINT "vehicle_registration_event" FOREIGN KEY ("event_id","organization_id") REFERENCES "electoral"."election_events"("id","organization_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION electoral.add_vehicle_documents(p_actor uuid,p_org uuid,p_canton uuid,p_vehicle uuid,p_conductor uuid,p_batch uuid,p_category text,p_files jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
DECLARE v_person uuid; v_file jsonb; v_prefix text; v_count integer; v_id uuid;
BEGIN
 IF NOT electoral.can_edit_module(p_actor,p_org,p_canton,'A05') THEN RAISE EXCEPTION 'Sin permiso de transporte' USING ERRCODE='42501'; END IF;
 SELECT responsible_id INTO v_person FROM electoral.vehicles WHERE id=p_vehicle AND organization_id=p_org AND canton_id=p_canton FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Vehículo ajeno' USING ERRCODE='42501'; END IF;
 IF p_category IS NULL OR p_category NOT IN ('vehiculo','conductor','otro') OR p_batch IS NULL OR p_files IS NULL OR jsonb_typeof(p_files)<>'array' OR jsonb_array_length(p_files) NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'Adjuntos inválidos' USING ERRCODE='22023'; END IF;
 IF p_category='conductor' AND p_conductor IS DISTINCT FROM v_person THEN RAISE EXCEPTION 'El conductor cambió' USING ERRCODE='40001'; END IF;
 IF left(p_files->0->>'storagePath',length(p_org::text||'/registrations/'||p_batch::text||'/'))=p_org::text||'/registrations/'||p_batch::text||'/' THEN v_prefix:=p_org::text||'/registrations/'||p_batch::text||'/'; ELSE v_prefix:=p_org::text||'/'||p_vehicle::text||'/'||p_batch::text||'/'; END IF;
 FOR v_file IN SELECT value FROM jsonb_array_elements(p_files) LOOP
  IF jsonb_typeof(v_file)<>'object' OR NOT (v_file ?& ARRAY['storagePath','filename','mimeType','byteSize','sha256']) OR v_file-ARRAY['storagePath','filename','mimeType','byteSize','sha256']<>'{}'::jsonb OR jsonb_typeof(v_file->'byteSize')<>'number' OR (v_file->>'byteSize')::integer NOT BETWEEN 1 AND 5242880 OR v_file->>'mimeType' NOT IN ('application/pdf','image/jpeg','image/png') OR length(v_file->>'filename') NOT BETWEEN 1 AND 180 OR v_file->>'sha256' !~ '^[a-f0-9]{64}$' OR left(v_file->>'storagePath',length(v_prefix)) IS DISTINCT FROM v_prefix OR substring(v_file->>'storagePath' FROM length(v_prefix)+1) !~ '^[a-f0-9-]{36}\.(pdf|jpg|png)$' THEN RAISE EXCEPTION 'Archivo inválido' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF (SELECT sum((value->>'byteSize')::integer) FROM jsonb_array_elements(p_files))>5242880 OR (SELECT count(DISTINCT (value->>'filename',value->>'sha256')) FROM jsonb_array_elements(p_files))<>jsonb_array_length(p_files) THEN RAISE EXCEPTION 'Límite o archivo duplicado' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO v_count FROM electoral.vehicle_documents WHERE vehicle_id=p_vehicle AND batch_id=p_batch;
 IF v_count>0 THEN
  IF v_count<>jsonb_array_length(p_files) OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_files) f WHERE NOT EXISTS(SELECT 1 FROM electoral.vehicle_documents d WHERE d.vehicle_id=p_vehicle AND d.batch_id=p_batch AND d.filename=f->>'filename' AND d.sha256=f->>'sha256' AND d.mime_type=f->>'mimeType' AND d.byte_size=(f->>'byteSize')::integer AND d.category=p_category AND d.conductor_id IS NOT DISTINCT FROM CASE WHEN p_category='conductor' THEN p_conductor ELSE NULL::uuid END)) THEN RAISE EXCEPTION 'Lote modificado' USING ERRCODE='40001'; END IF;
 ELSE
  FOR v_file IN SELECT value FROM jsonb_array_elements(p_files) LOOP
   INSERT INTO electoral.vehicle_documents(organization_id,canton_id,vehicle_id,conductor_id,batch_id,category,storage_path,filename,mime_type,byte_size,sha256,uploaded_by)
   VALUES(p_org,p_canton,p_vehicle,CASE WHEN p_category='conductor' THEN v_person ELSE NULL END,p_batch,p_category,v_file->>'storagePath',v_file->>'filename',v_file->>'mimeType',(v_file->>'byteSize')::integer,v_file->>'sha256',p_actor) RETURNING id INTO v_id;
   INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action) VALUES(p_org,p_actor,'vehicle_documents',v_id,'attach');
  END LOOP;
 END IF;
 RETURN (SELECT jsonb_agg(storage_path ORDER BY id) FROM electoral.vehicle_documents WHERE vehicle_id=p_vehicle AND batch_id=p_batch);
END $$;
--> statement-breakpoint
REVOKE ALL ON electoral.vehicle_registrations FROM PUBLIC,anon,authenticated,electoral_app;
--> statement-breakpoint
CREATE FUNCTION electoral.save_vehicle_with_documents(p_actor uuid,p_org uuid,p_canton uuid,p_event uuid,p_registration uuid,p_hash text,p_data jsonb,p_category text,p_files jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
DECLARE v_previous electoral.vehicle_registrations; v_vehicle uuid; v_conductor uuid; v_paths jsonb;
BEGIN
 IF NOT electoral.can_edit_module(p_actor,p_org,p_canton,'A05') OR NOT EXISTS(SELECT 1 FROM electoral.election_events WHERE id=p_event AND organization_id=p_org) THEN RAISE EXCEPTION 'Sin permiso de transporte' USING ERRCODE='42501'; END IF;
 IF p_registration IS NULL OR p_hash IS NULL OR p_hash !~ '^[a-f0-9]{64}$' OR p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR jsonb_typeof(p_data->'districtIds') IS DISTINCT FROM 'array' OR jsonb_typeof(p_data->'centerIds') IS DISTINCT FROM 'array' OR p_files IS NULL OR jsonb_typeof(p_files)<>'array' OR jsonb_array_length(p_files) NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'Entrada inválida' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vehicle_registration:'||p_org::text||':'||p_canton::text||':'||p_registration::text,0));
 SELECT * INTO v_previous FROM electoral.vehicle_registrations WHERE id=p_registration;
 IF FOUND THEN
  IF v_previous.organization_id<>p_org OR v_previous.canton_id<>p_canton OR v_previous.event_id<>p_event OR v_previous.actor_id<>p_actor OR v_previous.payload_hash<>p_hash THEN RAISE EXCEPTION 'Registro modificado' USING ERRCODE='40001'; END IF;
  RETURN jsonb_build_object('id',v_previous.vehicle_id,'paths',(SELECT jsonb_agg(storage_path ORDER BY id) FROM electoral.vehicle_documents WHERE vehicle_id=v_previous.vehicle_id AND batch_id=p_registration));
 END IF;
 v_vehicle:=electoral.save_vehicle(p_actor,p_org,p_canton,p_event,nullif(p_data->>'id','')::uuid,(p_data->>'version')::integer,p_data->>'plate',p_data->>'description',nullif(p_data->>'personId','')::uuid,p_data->>'personVersion',p_data->>'fullName',p_data->>'phone',p_data->>'email',(p_data->>'active')::boolean,ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(p_data->'districtIds')),ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(p_data->'centerIds')),p_data->>'reason');
 SELECT responsible_id INTO v_conductor FROM electoral.vehicles WHERE id=v_vehicle;
 v_paths:=electoral.add_vehicle_documents(p_actor,p_org,p_canton,v_vehicle,v_conductor,p_registration,p_category,p_files);
 INSERT INTO electoral.vehicle_registrations(id,organization_id,canton_id,event_id,vehicle_id,actor_id,payload_hash) VALUES(p_registration,p_org,p_canton,p_event,v_vehicle,p_actor,p_hash);
 INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action) VALUES(p_org,p_actor,'vehicle_registrations',p_registration,'save_with_documents');
 RETURN jsonb_build_object('id',v_vehicle,'paths',v_paths);
END $$;
--> statement-breakpoint
CREATE FUNCTION electoral.unused_vehicle_registration_paths(p_actor uuid,p_org uuid,p_canton uuid,p_registration uuid,p_paths jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
DECLARE v_prefix text:=p_org::text||'/registrations/'||p_registration::text||'/';
BEGIN
 IF NOT electoral.can_edit_module(p_actor,p_org,p_canton,'A05') OR p_registration IS NULL OR p_paths IS NULL OR jsonb_typeof(p_paths)<>'array' OR jsonb_array_length(p_paths)>3 THEN RAISE EXCEPTION 'Sin permiso' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vehicle_registration:'||p_org::text||':'||p_canton::text||':'||p_registration::text,0));
 RETURN (SELECT coalesce(jsonb_agg(path),'[]'::jsonb) FROM jsonb_array_elements_text(p_paths) path WHERE left(path,length(v_prefix))=v_prefix AND NOT EXISTS(SELECT 1 FROM electoral.vehicle_documents WHERE storage_path=path));
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.save_vehicle_with_documents(uuid,uuid,uuid,uuid,uuid,text,jsonb,text,jsonb),electoral.unused_vehicle_registration_paths(uuid,uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.save_vehicle_with_documents(uuid,uuid,uuid,uuid,uuid,text,jsonb,text,jsonb),electoral.unused_vehicle_registration_paths(uuid,uuid,uuid,uuid,jsonb) TO electoral_app;

