CREATE TABLE "electoral"."vehicle_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"canton_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"conductor_id" uuid,
	"batch_id" uuid NOT NULL,
	"category" text NOT NULL,
	"storage_path" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"sha256" text NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_documents_storage_path_unique" UNIQUE("storage_path"),
	CONSTRAINT "vehicle_document_batch_content" UNIQUE("vehicle_id","batch_id","sha256","filename"),
	CONSTRAINT "vehicle_document_category" CHECK (("electoral"."vehicle_documents"."category"='conductor' AND "electoral"."vehicle_documents"."conductor_id" IS NOT NULL) OR ("electoral"."vehicle_documents"."category" IN ('vehiculo','otro') AND "electoral"."vehicle_documents"."conductor_id" IS NULL)),
	CONSTRAINT "vehicle_document_file" CHECK ("electoral"."vehicle_documents"."byte_size">0 AND "electoral"."vehicle_documents"."byte_size"<=5242880 AND "electoral"."vehicle_documents"."mime_type" IN ('application/pdf','image/jpeg','image/png') AND length("electoral"."vehicle_documents"."filename") BETWEEN 1 AND 180 AND "electoral"."vehicle_documents"."sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "electoral"."vehicle_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Preserve historical submissions without rewriting their declared vehicle or approval.
ALTER TABLE "electoral"."transport_requests" ADD COLUMN "vehicle_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "electoral"."transport_requests" ALTER COLUMN "vehicle_required" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "electoral"."vehicle_documents" ADD CONSTRAINT "vehicle_document_vehicle" FOREIGN KEY ("vehicle_id","organization_id","canton_id") REFERENCES "electoral"."vehicles"("id","organization_id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."vehicle_documents" ADD CONSTRAINT "vehicle_document_person" FOREIGN KEY ("conductor_id","organization_id") REFERENCES "electoral"."people"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."transport_requests" ADD CONSTRAINT "transport_request_vehicle_required" CHECK (NOT "electoral"."transport_requests"."vehicle_required" OR "electoral"."transport_requests"."kind"<>'driver' OR (length(trim("electoral"."transport_requests"."vehicle_details"))>=2 AND ("electoral"."transport_requests"."status"<>'aprobada' OR "electoral"."transport_requests"."linked_vehicle_id" IS NOT NULL)));--> statement-breakpoint
CREATE POLICY "vehicle_documents_read" ON "electoral"."vehicle_documents" AS PERMISSIVE FOR SELECT TO "electoral_app" USING (true);
--> statement-breakpoint
ALTER FUNCTION electoral.submit_transport_request(uuid,uuid,uuid,uuid,text,text,jsonb) RENAME TO submit_transport_request_before_vehicle_required;
--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.submit_transport_request_before_vehicle_required(uuid,uuid,uuid,uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated,electoral_app;
--> statement-breakpoint
CREATE FUNCTION electoral.submit_transport_request(p_org uuid,p_canton uuid,p_event uuid,p_token uuid,p_bucket text,p_hash text,p_data jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
BEGIN
 IF p_data->>'kind'='driver' AND (jsonb_typeof(p_data->'vehicleDetails') IS DISTINCT FROM 'string' OR length(trim(p_data->>'vehicleDetails'))<2) THEN RAISE EXCEPTION 'Vehículo obligatorio para conductor' USING ERRCODE='22023'; END IF;
 RETURN electoral.submit_transport_request_before_vehicle_required(p_org,p_canton,p_event,p_token,p_bucket,p_hash,p_data);
END $$;
--> statement-breakpoint
ALTER FUNCTION electoral.review_transport_request(uuid,uuid,uuid,uuid,uuid,integer,text,uuid,uuid,text,text,text) RENAME TO review_transport_request_before_vehicle_required;
--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.review_transport_request_before_vehicle_required(uuid,uuid,uuid,uuid,uuid,integer,text,uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated,electoral_app;
--> statement-breakpoint
CREATE FUNCTION electoral.review_transport_request(p_actor uuid,p_org uuid,p_canton uuid,p_event uuid,p_id uuid,p_expected integer,p_status text,p_person uuid,p_vehicle uuid,p_plate text,p_description text,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
DECLARE v_old electoral.transport_requests; v_person uuid:=p_person; v_vehicle uuid; v_existing_person uuid; v_binding uuid;
BEGIN
 PERFORM electoral.require_global_admin(p_actor,p_org);
 IF NOT electoral.transport_scope_active(p_org,p_canton,p_event) THEN RAISE EXCEPTION 'Ámbito inválido' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_old FROM electoral.transport_requests WHERE id=p_id AND organization_id=p_org AND canton_id=p_canton AND event_id=p_event FOR UPDATE;
 IF NOT FOUND OR v_old.status<>'pendiente' OR v_old.version IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Solicitud modificada' USING ERRCODE='40001'; END IF;
 IF v_old.kind='driver' AND p_status='aprobada' THEN
  IF p_vehicle IS NULL AND coalesce(trim(p_plate),'')='' THEN RAISE EXCEPTION 'Vinculá el vehículo del conductor' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM electoral.districts WHERE id=v_old.district_id AND canton_id=p_canton AND active) THEN RAISE EXCEPTION 'Distrito inactivo' USING ERRCODE='42501'; END IF;
  IF p_vehicle IS NOT NULL THEN
   SELECT responsible_id INTO v_existing_person FROM electoral.vehicles WHERE id=p_vehicle AND organization_id=p_org AND canton_id=p_canton FOR UPDATE;
   IF NOT FOUND OR (p_person IS NOT NULL AND p_person<>v_existing_person) THEN RAISE EXCEPTION 'El conductor debe coincidir con la ficha del vehículo' USING ERRCODE='22023'; END IF;
   v_person:=v_existing_person;
  END IF;
 END IF;
 PERFORM electoral.review_transport_request_before_vehicle_required(p_actor,p_org,p_canton,p_event,p_id,p_expected,p_status,v_person,p_vehicle,p_plate,p_description,p_reason);
 IF v_old.kind='driver' AND p_status='aprobada' THEN
  SELECT linked_vehicle_id INTO v_vehicle FROM electoral.transport_requests WHERE id=p_id;
  INSERT INTO electoral.vehicle_district_assignments(vehicle_id,organization_id,canton_id,event_id,district_id)
   SELECT v_vehicle,p_org,p_canton,p_event,v_old.district_id WHERE NOT EXISTS(SELECT 1 FROM electoral.vehicle_district_assignments WHERE vehicle_id=v_vehicle AND event_id=p_event AND district_id=v_old.district_id AND ended_at IS NULL) RETURNING id INTO v_binding;
  IF v_binding IS NOT NULL THEN INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action) VALUES(p_org,p_actor,'vehicle_district_assignments',v_binding,'assign_from_review'); END IF;
 END IF;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.submit_transport_request(uuid,uuid,uuid,uuid,text,text,jsonb),electoral.review_transport_request(uuid,uuid,uuid,uuid,uuid,integer,text,uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.submit_transport_request(uuid,uuid,uuid,uuid,text,text,jsonb),electoral.review_transport_request(uuid,uuid,uuid,uuid,uuid,integer,text,uuid,uuid,text,text,text) TO electoral_app;
--> statement-breakpoint
REVOKE ALL ON electoral.vehicle_documents FROM PUBLIC,anon,authenticated,electoral_app;
--> statement-breakpoint
GRANT SELECT ON electoral.vehicle_documents TO electoral_app;
--> statement-breakpoint
CREATE FUNCTION electoral.add_vehicle_documents(p_actor uuid,p_org uuid,p_canton uuid,p_vehicle uuid,p_conductor uuid,p_batch uuid,p_category text,p_files jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
DECLARE v_person uuid; v_file jsonb; v_prefix text; v_count integer; v_id uuid;
BEGIN
 IF NOT electoral.can_edit_module(p_actor,p_org,p_canton,'A05') THEN RAISE EXCEPTION 'Sin permiso de transporte' USING ERRCODE='42501'; END IF;
 SELECT responsible_id INTO v_person FROM electoral.vehicles WHERE id=p_vehicle AND organization_id=p_org AND canton_id=p_canton FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Vehículo ajeno' USING ERRCODE='42501'; END IF;
 IF p_category IS NULL OR p_category NOT IN ('vehiculo','conductor','otro') OR p_batch IS NULL OR p_files IS NULL OR jsonb_typeof(p_files)<>'array' OR jsonb_array_length(p_files) NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'Adjuntos inválidos' USING ERRCODE='22023'; END IF;
 IF p_category='conductor' AND p_conductor IS DISTINCT FROM v_person THEN RAISE EXCEPTION 'El conductor cambió' USING ERRCODE='40001'; END IF;
 v_prefix:=p_org::text||'/'||p_vehicle::text||'/'||p_batch::text||'/';
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
CREATE FUNCTION electoral.unused_vehicle_document_paths(p_actor uuid,p_org uuid,p_canton uuid,p_vehicle uuid,p_paths jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
BEGIN
 IF NOT electoral.can_edit_module(p_actor,p_org,p_canton,'A05') OR p_paths IS NULL OR jsonb_typeof(p_paths)<>'array' OR jsonb_array_length(p_paths)>3 THEN RAISE EXCEPTION 'Sin permiso' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM electoral.vehicles WHERE id=p_vehicle AND organization_id=p_org AND canton_id=p_canton FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Vehículo ajeno' USING ERRCODE='42501'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(path),'[]'::jsonb) FROM jsonb_array_elements_text(p_paths) path WHERE left(path,length(p_org::text||'/'||p_vehicle::text||'/'))=p_org::text||'/'||p_vehicle::text||'/' AND NOT EXISTS(SELECT 1 FROM electoral.vehicle_documents WHERE storage_path=path));
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.add_vehicle_documents(uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb),electoral.unused_vehicle_document_paths(uuid,uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.add_vehicle_documents(uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb),electoral.unused_vehicle_document_paths(uuid,uuid,uuid,uuid,jsonb) TO electoral_app;
