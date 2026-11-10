ALTER TABLE "electoral"."inventory_movements" ADD CONSTRAINT "inventory_movement_receipt_scope" UNIQUE("id","organization_id","canton_id","event_id");--> statement-breakpoint
CREATE TABLE "electoral"."inventory_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"canton_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"movement_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"sha256" text NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_receipts_storage_path_unique" UNIQUE("storage_path"),
	CONSTRAINT "inventory_receipt_content" UNIQUE("movement_id","sha256","filename"),
	CONSTRAINT "inventory_receipt_valid" CHECK ("electoral"."inventory_receipts"."byte_size">0 AND "electoral"."inventory_receipts"."byte_size"<=5242880 AND "electoral"."inventory_receipts"."mime_type" IN ('application/pdf','image/jpeg','image/png') AND length("electoral"."inventory_receipts"."filename") BETWEEN 1 AND 180 AND "electoral"."inventory_receipts"."sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "electoral"."inventory_receipts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "electoral"."inventory_receipts" ADD CONSTRAINT "inventory_receipt_movement" FOREIGN KEY ("movement_id","organization_id","canton_id","event_id") REFERENCES "electoral"."inventory_movements"("id","organization_id","canton_id","event_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

CREATE POLICY "inventory_receipts_read" ON "electoral"."inventory_receipts" AS PERMISSIVE FOR SELECT TO "electoral_app" USING (true);
--> statement-breakpoint
REVOKE ALL ON electoral.inventory_receipts FROM PUBLIC,anon,authenticated,electoral_app;
--> statement-breakpoint
GRANT SELECT ON electoral.inventory_receipts TO electoral_app;
--> statement-breakpoint
CREATE FUNCTION electoral.inventory_command_with_receipts(p_actor uuid,p_org uuid,p_canton uuid,p_event uuid,p_data jsonb,p_files jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
DECLARE v_id uuid; v_file jsonb; v_path text; v_receipt uuid; v_count integer;
BEGIN
 IF NOT electoral.inventory_allowed(p_actor,p_org,p_canton) THEN RAISE EXCEPTION 'Sin permiso de inventario' USING ERRCODE='42501'; END IF;
 IF p_data->>'operation' IS DISTINCT FROM 'movement' OR p_files IS NULL OR jsonb_typeof(p_files)<>'array' OR jsonb_array_length(p_files) NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'Comprobantes inválidos' USING ERRCODE='22023'; END IF;
 FOR v_file IN SELECT value FROM jsonb_array_elements(p_files) LOOP
  IF jsonb_typeof(v_file)<>'object' OR NOT (v_file ?& ARRAY['storagePath','filename','mimeType','byteSize','sha256']) OR v_file-ARRAY['storagePath','filename','mimeType','byteSize','sha256']<>'{}'::jsonb OR jsonb_typeof(v_file->'byteSize')<>'number' OR (v_file->>'byteSize')::integer NOT BETWEEN 1 AND 5242880 OR v_file->>'mimeType' NOT IN ('application/pdf','image/jpeg','image/png') OR length(v_file->>'filename') NOT BETWEEN 1 AND 180 OR v_file->>'sha256' !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Archivo inválido' USING ERRCODE='22023'; END IF;
  v_path:=p_org::text||'/'||p_event::text||'/'||(p_data->>'requestId')::uuid::text||'/';
  IF left(v_file->>'storagePath',length(v_path)) IS DISTINCT FROM v_path OR substring(v_file->>'storagePath' FROM length(v_path)+1) !~ '^[a-f0-9-]{36}\.(pdf|jpg|png)$' THEN RAISE EXCEPTION 'Ruta inválida' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF (SELECT sum((value->>'byteSize')::integer) FROM jsonb_array_elements(p_files))>5242880 OR (SELECT count(DISTINCT (value->>'filename',value->>'sha256')) FROM jsonb_array_elements(p_files))<>jsonb_array_length(p_files) THEN RAISE EXCEPTION 'Límite o archivo repetido' USING ERRCODE='22023'; END IF;
 -- Existing command serializes the canton and validates author, event, stock and idempotency.
 v_id:=electoral.inventory_command(p_actor,p_org,p_canton,p_event,p_data);
 SELECT count(*) INTO v_count FROM electoral.inventory_receipts WHERE movement_id=v_id;
 IF v_count>0 THEN
  IF v_count<>jsonb_array_length(p_files) OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_files) f WHERE NOT EXISTS(SELECT 1 FROM electoral.inventory_receipts r WHERE r.movement_id=v_id AND r.filename=f->>'filename' AND r.sha256=f->>'sha256' AND r.mime_type=f->>'mimeType' AND r.byte_size=(f->>'byteSize')::integer)) THEN RAISE EXCEPTION 'Comprobantes distintos en reintento' USING ERRCODE='40001'; END IF;
 ELSE
  FOR v_file IN SELECT value FROM jsonb_array_elements(p_files) LOOP
   INSERT INTO electoral.inventory_receipts(organization_id,canton_id,event_id,movement_id,storage_path,filename,mime_type,byte_size,sha256,uploaded_by)
   VALUES(p_org,p_canton,p_event,v_id,v_file->>'storagePath',v_file->>'filename',v_file->>'mimeType',(v_file->>'byteSize')::integer,v_file->>'sha256',p_actor) RETURNING id INTO v_receipt;
   INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action) VALUES(p_org,p_actor,'inventory_receipts',v_receipt,'attach');
  END LOOP;
 END IF;
 RETURN jsonb_build_object('id',v_id,'paths',(SELECT jsonb_agg(storage_path ORDER BY id) FROM electoral.inventory_receipts WHERE movement_id=v_id));
END $$;
--> statement-breakpoint
CREATE FUNCTION electoral.inventory_unused_receipt_paths(p_actor uuid,p_org uuid,p_canton uuid,p_paths jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
BEGIN
 IF NOT electoral.inventory_allowed(p_actor,p_org,p_canton) OR p_paths IS NULL OR jsonb_typeof(p_paths)<>'array' OR jsonb_array_length(p_paths)>3 THEN RAISE EXCEPTION 'Sin permiso' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('inventory:'||p_org::text||':'||p_canton::text,0));
 RETURN (SELECT coalesce(jsonb_agg(path),'[]'::jsonb) FROM jsonb_array_elements_text(p_paths) path WHERE left(path,length(p_org::text)+1)=p_org::text||'/' AND NOT EXISTS(SELECT 1 FROM electoral.inventory_receipts WHERE storage_path=path));
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.inventory_command_with_receipts(uuid,uuid,uuid,uuid,jsonb,jsonb),electoral.inventory_unused_receipt_paths(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.inventory_command_with_receipts(uuid,uuid,uuid,uuid,jsonb,jsonb),electoral.inventory_unused_receipt_paths(uuid,uuid,uuid,jsonb) TO electoral_app;
