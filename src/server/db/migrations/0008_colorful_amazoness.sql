CREATE TABLE "electoral"."center_area_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"center_election_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"area_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"ended_reason" text,
	"created_by" uuid NOT NULL,
	CONSTRAINT "center_area_end" CHECK (("electoral"."center_area_assignments"."ended_at" IS NULL AND "electoral"."center_area_assignments"."ended_reason" IS NULL) OR ("electoral"."center_area_assignments"."ended_at" >= "electoral"."center_area_assignments"."started_at" AND length(trim("electoral"."center_area_assignments"."ended_reason")) BETWEEN 3 AND 500))
);
--> statement-breakpoint
CREATE TABLE "electoral"."center_area_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"center_election_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"area_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"filename" text NOT NULL,
	"category" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "center_area_documents_storage_path_unique" UNIQUE("storage_path"),
	CONSTRAINT "center_document_size" CHECK ("electoral"."center_area_documents"."byte_size" BETWEEN 1 AND 5242880),
	CONSTRAINT "center_document_type" CHECK ("electoral"."center_area_documents"."mime_type" IN ('application/pdf','image/jpeg','image/png')),
	CONSTRAINT "center_document_category" CHECK ("electoral"."center_area_documents"."category" IN ('contrato','cedula','otro'))
);
--> statement-breakpoint
ALTER TABLE "electoral"."center_area_assignments" ADD CONSTRAINT "center_area_assignments_center_election_id_organization_id_event_id_center_elections_id_organization_id_event_id_fk" FOREIGN KEY ("center_election_id","organization_id","event_id") REFERENCES "electoral"."center_elections"("id","organization_id","event_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."center_area_assignments" ADD CONSTRAINT "center_area_assignments_area_id_organization_id_functional_areas_id_organization_id_fk" FOREIGN KEY ("area_id","organization_id") REFERENCES "electoral"."functional_areas"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."center_area_assignments" ADD CONSTRAINT "center_area_assignments_person_id_organization_id_people_id_organization_id_fk" FOREIGN KEY ("person_id","organization_id") REFERENCES "electoral"."people"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."center_area_documents" ADD CONSTRAINT "center_area_documents_center_election_id_organization_id_event_id_center_elections_id_organization_id_event_id_fk" FOREIGN KEY ("center_election_id","organization_id","event_id") REFERENCES "electoral"."center_elections"("id","organization_id","event_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."center_area_documents" ADD CONSTRAINT "center_area_documents_area_id_organization_id_functional_areas_id_organization_id_fk" FOREIGN KEY ("area_id","organization_id") REFERENCES "electoral"."functional_areas"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "center_area_current" ON "electoral"."center_area_assignments" USING btree ("center_election_id","area_id") WHERE "electoral"."center_area_assignments"."ended_at" IS NULL;
--> statement-breakpoint
ALTER TABLE electoral.center_area_assignments ADD CONSTRAINT center_area_author_fk FOREIGN KEY(created_by) REFERENCES auth.users(id);
--> statement-breakpoint
ALTER TABLE electoral.center_area_documents ADD CONSTRAINT center_document_author_fk FOREIGN KEY(uploaded_by) REFERENCES auth.users(id);
--> statement-breakpoint
GRANT SELECT ON electoral.center_area_assignments,electoral.center_area_documents TO electoral_app;
--> statement-breakpoint
REVOKE ALL ON electoral.center_area_assignments,electoral.center_area_documents FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
CREATE FUNCTION electoral.require_center_area(p_actor uuid,p_org uuid,p_canton uuid,p_event uuid,p_center uuid,p_code text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
DECLARE v_area uuid;
BEGIN
 IF p_code IS NULL OR p_code NOT IN ('A01','A02','A03','A04','A05','A06','A07','A08','A09') OR NOT electoral.can_edit_module(p_actor,p_org,p_canton,p_code) THEN RAISE EXCEPTION 'Sin permiso' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM electoral.center_elections ce JOIN electoral.voting_centers c ON c.id=ce.center_id
  WHERE ce.id=p_center AND ce.organization_id=p_org AND ce.event_id=p_event AND ce.canton_id=p_canton AND c.archived_at IS NULL) THEN RAISE EXCEPTION 'Centro no disponible' USING ERRCODE='42501'; END IF;
 SELECT id INTO v_area FROM electoral.functional_areas WHERE organization_id=p_org AND code=p_code AND active;
 IF v_area IS NULL THEN RAISE EXCEPTION 'Área no disponible' USING ERRCODE='22023'; END IF;
 RETURN v_area;
END $$;
--> statement-breakpoint
CREATE FUNCTION electoral.save_center_responsible(p_actor uuid,p_org uuid,p_canton uuid,p_event uuid,p_center uuid,p_code text,p_expected uuid,p_person uuid,p_version text,p_name text,p_email text,p_phone text,p_notes text,p_reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
DECLARE v_area uuid; v_current electoral.center_area_assignments; v_person uuid; v_result uuid;
BEGIN
 v_area:=electoral.require_center_area(p_actor,p_org,p_canton,p_event,p_center,p_code);
 IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 2 AND 160 OR p_email IS NULL OR length(p_email)>254 OR (p_email<>'' AND p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') OR p_phone IS NULL OR length(p_phone)>40 OR p_notes IS NULL OR length(p_notes)>2000 OR p_reason IS NULL OR length(p_reason)>500 THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM electoral.center_elections WHERE id=p_center FOR UPDATE;
 SELECT * INTO v_current FROM electoral.center_area_assignments WHERE center_election_id=p_center AND area_id=v_area AND ended_at IS NULL;
 IF v_current.id IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Asignación modificada' USING ERRCODE='40001'; END IF;
 IF v_current.id IS NOT NULL AND v_current.person_id IS DISTINCT FROM p_person AND length(trim(p_reason))<3 THEN RAISE EXCEPTION 'Indica motivo' USING ERRCODE='22023'; END IF;
 IF p_person IS NULL THEN
  INSERT INTO electoral.people(organization_id,full_name,email,phone,notes) VALUES(p_org,trim(p_name),nullif(p_email,''),nullif(trim(p_phone),''),nullif(trim(p_notes),'')) RETURNING id INTO v_person;
 ELSE
  PERFORM 1 FROM electoral.people WHERE id=p_person AND organization_id=p_org AND updated_at::text=p_version FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Persona modificada' USING ERRCODE='40001'; END IF;
  v_person:=p_person;
  UPDATE electoral.people SET full_name=trim(p_name),email=nullif(p_email,''),phone=nullif(trim(p_phone),''),notes=nullif(trim(p_notes),'') WHERE id=v_person AND organization_id=p_org;
 END IF;
 IF v_current.id IS NOT NULL AND v_current.person_id=v_person THEN v_result:=v_current.id;
 ELSE
  IF v_current.id IS NOT NULL THEN UPDATE electoral.center_area_assignments SET ended_at=now(),ended_reason=trim(p_reason) WHERE id=v_current.id; END IF;
  INSERT INTO electoral.center_area_assignments(organization_id,center_election_id,event_id,area_id,person_id,created_by) VALUES(p_org,p_center,p_event,v_area,v_person,p_actor) RETURNING id INTO v_result;
 END IF;
 INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action) VALUES(p_org,p_actor,'center_area_assignments',v_result,'save_responsible');
 RETURN v_result;
END $$;
--> statement-breakpoint
CREATE FUNCTION electoral.add_center_document(p_actor uuid,p_org uuid,p_canton uuid,p_event uuid,p_center uuid,p_code text,p_path text,p_filename text,p_category text,p_mime text,p_size integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
DECLARE v_area uuid; v_id uuid; v_prefix text;
BEGIN
 v_area:=electoral.require_center_area(p_actor,p_org,p_canton,p_event,p_center,p_code);
 v_prefix:=p_org::text||'/'||p_event::text||'/'||p_center::text||'/'||p_code||'/';
 IF p_path IS NULL OR left(p_path,length(v_prefix))<>v_prefix OR substring(p_path from length(v_prefix)+1) !~ '^[a-f0-9-]{36}\.(pdf|jpg|png)$' OR p_filename IS NULL OR length(trim(p_filename)) NOT BETWEEN 1 AND 180 OR p_filename ~ '[[:cntrl:]/\\]' OR p_category IS NULL OR p_category NOT IN ('contrato','cedula','otro') OR p_mime IS NULL OR p_mime NOT IN ('application/pdf','image/jpeg','image/png') OR p_size IS NULL OR p_size NOT BETWEEN 1 AND 5242880 THEN RAISE EXCEPTION 'Documento inválido' USING ERRCODE='22023'; END IF;
 INSERT INTO electoral.center_area_documents(organization_id,center_election_id,event_id,area_id,storage_path,filename,category,mime_type,byte_size,uploaded_by)
 VALUES(p_org,p_center,p_event,v_area,p_path,p_filename,p_category,p_mime,p_size,p_actor) RETURNING id INTO v_id;
 INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action) VALUES(p_org,p_actor,'center_area_documents',v_id,'upload');
 RETURN v_id;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.require_center_area(uuid,uuid,uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.save_center_responsible(uuid,uuid,uuid,uuid,uuid,text,uuid,uuid,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.add_center_document(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,integer) FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.save_center_responsible(uuid,uuid,uuid,uuid,uuid,text,uuid,uuid,text,text,text,text,text,text),electoral.add_center_document(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,integer) TO electoral_app;
