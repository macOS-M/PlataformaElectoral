ALTER TABLE electoral.organizational_assignments ADD CONSTRAINT assignment_training_scope UNIQUE(id,organization_id,canton_id,position_id);
--> statement-breakpoint
CREATE TABLE "electoral"."training_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requirement_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"canton_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"position_id" uuid NOT NULL,
	"status" text NOT NULL,
	"status_on" date NOT NULL,
	"sequence" integer NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_progress_requirement_id_assignment_id_sequence_unique" UNIQUE("requirement_id","assignment_id","sequence"),
	CONSTRAINT "training_progress_status" CHECK ("electoral"."training_progress"."status" IN ('pendiente','convocado','cumplido','no_asistio') AND "electoral"."training_progress"."sequence" > 0)
);
--> statement-breakpoint
CREATE TABLE "electoral"."training_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"canton_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"position_id" uuid NOT NULL,
	"required" boolean NOT NULL,
	"scheduled_on" date,
	"revision" integer NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_requirements_position_id_event_id_revision_unique" UNIQUE("position_id","event_id","revision"),
	CONSTRAINT "training_requirement_scope" UNIQUE("id","organization_id","canton_id","event_id","position_id"),
	CONSTRAINT "training_requirement_revision" CHECK ("electoral"."training_requirements"."revision" > 0 AND ("electoral"."training_requirements"."required" OR "electoral"."training_requirements"."scheduled_on" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "electoral"."vehicle_center_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"canton_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"center_election_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "vehicle_center_dates" CHECK ("electoral"."vehicle_center_assignments"."ended_at" IS NULL OR "electoral"."vehicle_center_assignments"."ended_at" >= "electoral"."vehicle_center_assignments"."started_at")
);
--> statement-breakpoint
CREATE TABLE "electoral"."vehicle_district_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"canton_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"district_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "vehicle_district_dates" CHECK ("electoral"."vehicle_district_assignments"."ended_at" IS NULL OR "electoral"."vehicle_district_assignments"."ended_at" >= "electoral"."vehicle_district_assignments"."started_at")
);
--> statement-breakpoint
CREATE TABLE "electoral"."vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"canton_id" uuid NOT NULL,
	"plate" text NOT NULL,
	"description" text NOT NULL,
	"responsible_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicles_id_organization_id_canton_id_unique" UNIQUE("id","organization_id","canton_id"),
	CONSTRAINT "vehicles_organization_id_plate_unique" UNIQUE("organization_id","plate"),
	CONSTRAINT "vehicle_text" CHECK ("electoral"."vehicles"."plate" ~ '^[A-Z0-9-]{2,20}$' AND length(trim("electoral"."vehicles"."description")) BETWEEN 2 AND 160 AND "electoral"."vehicles"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "electoral"."training_progress" ADD CONSTRAINT "training_progress_requirement_id_organization_id_canton_id_event_id_position_id_training_requirements_id_organization_id_canton_id_event_id_position_id_fk" FOREIGN KEY ("requirement_id","organization_id","canton_id","event_id","position_id") REFERENCES "electoral"."training_requirements"("id","organization_id","canton_id","event_id","position_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."training_progress" ADD CONSTRAINT "training_progress_assignment_id_organization_id_canton_id_position_id_organizational_assignments_id_organization_id_canton_id_position_id_fk" FOREIGN KEY ("assignment_id","organization_id","canton_id","position_id") REFERENCES "electoral"."organizational_assignments"("id","organization_id","canton_id","position_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."training_requirements" ADD CONSTRAINT "training_requirements_position_id_organization_id_canton_id_organizational_positions_id_organization_id_canton_id_fk" FOREIGN KEY ("position_id","organization_id","canton_id") REFERENCES "electoral"."organizational_positions"("id","organization_id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."training_requirements" ADD CONSTRAINT "training_requirements_event_id_organization_id_election_events_id_organization_id_fk" FOREIGN KEY ("event_id","organization_id") REFERENCES "electoral"."election_events"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."vehicle_center_assignments" ADD CONSTRAINT "vehicle_center_assignments_vehicle_id_organization_id_canton_id_vehicles_id_organization_id_canton_id_fk" FOREIGN KEY ("vehicle_id","organization_id","canton_id") REFERENCES "electoral"."vehicles"("id","organization_id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."vehicle_center_assignments" ADD CONSTRAINT "vehicle_center_assignments_center_election_id_organization_id_event_id_center_elections_id_organization_id_event_id_fk" FOREIGN KEY ("center_election_id","organization_id","event_id") REFERENCES "electoral"."center_elections"("id","organization_id","event_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."vehicle_district_assignments" ADD CONSTRAINT "vehicle_district_assignments_vehicle_id_organization_id_canton_id_vehicles_id_organization_id_canton_id_fk" FOREIGN KEY ("vehicle_id","organization_id","canton_id") REFERENCES "electoral"."vehicles"("id","organization_id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."vehicle_district_assignments" ADD CONSTRAINT "vehicle_district_assignments_district_id_canton_id_districts_id_canton_id_fk" FOREIGN KEY ("district_id","canton_id") REFERENCES "electoral"."districts"("id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."vehicle_district_assignments" ADD CONSTRAINT "vehicle_district_assignments_event_id_organization_id_election_events_id_organization_id_fk" FOREIGN KEY ("event_id","organization_id") REFERENCES "electoral"."election_events"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."vehicles" ADD CONSTRAINT "vehicles_organization_id_canton_id_organization_cantons_organization_id_canton_id_fk" FOREIGN KEY ("organization_id","canton_id") REFERENCES "electoral"."organization_cantons"("organization_id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."vehicles" ADD CONSTRAINT "vehicles_responsible_id_organization_id_people_id_organization_id_fk" FOREIGN KEY ("responsible_id","organization_id") REFERENCES "electoral"."people"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_center_current" ON "electoral"."vehicle_center_assignments" USING btree ("vehicle_id","event_id","center_election_id") WHERE "electoral"."vehicle_center_assignments"."ended_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_district_current" ON "electoral"."vehicle_district_assignments" USING btree ("vehicle_id","event_id","district_id") WHERE "electoral"."vehicle_district_assignments"."ended_at" IS NULL;--> statement-breakpoint
ALTER TABLE electoral.training_requirements ADD CONSTRAINT training_requirement_author FOREIGN KEY(created_by) REFERENCES auth.users(id);
--> statement-breakpoint
ALTER TABLE electoral.training_progress ADD CONSTRAINT training_progress_author FOREIGN KEY(created_by) REFERENCES auth.users(id);
--> statement-breakpoint
REVOKE ALL ON electoral.vehicles,electoral.vehicle_district_assignments,electoral.vehicle_center_assignments,electoral.training_requirements,electoral.training_progress FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
GRANT SELECT ON electoral.vehicles,electoral.vehicle_district_assignments,electoral.vehicle_center_assignments,electoral.training_requirements,electoral.training_progress TO electoral_app;
--> statement-breakpoint
CREATE TRIGGER vehicles_updated BEFORE UPDATE ON electoral.vehicles FOR EACH ROW EXECUTE FUNCTION electoral.set_updated_at();
--> statement-breakpoint
CREATE FUNCTION electoral.save_vehicle(p_actor uuid,p_org uuid,p_canton uuid,p_event uuid,p_id uuid,p_version integer,p_plate text,p_description text,p_person uuid,p_person_version text,p_name text,p_phone text,p_email text,p_active boolean,p_districts uuid[],p_centers uuid[],p_reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
DECLARE v_id uuid; v_person uuid; v_old electoral.vehicles;
BEGIN
 IF NOT electoral.can_edit_module(p_actor,p_org,p_canton,'A05') OR NOT EXISTS(SELECT 1 FROM electoral.election_events WHERE id=p_event AND organization_id=p_org) THEN RAISE EXCEPTION 'Sin permiso' USING ERRCODE='42501'; END IF;
 IF p_plate IS NULL OR upper(trim(p_plate)) !~ '^[A-Z0-9-]{2,20}$' OR p_description IS NULL OR length(trim(p_description)) NOT BETWEEN 2 AND 160 OR p_active IS NULL OR p_districts IS NULL OR p_centers IS NULL OR cardinality(p_districts)>100 OR cardinality(p_centers)>500 OR p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 2 AND 160 OR p_phone IS NULL OR length(p_phone)>40 OR p_phone !~ '^[+()0-9 .-]*$' OR p_email IS NULL OR length(p_email)>254 OR (p_email<>'' AND p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') OR p_reason IS NULL OR length(p_reason)>500 THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023'; END IF;
 -- Serializa cambios del vehículo y del conjunto de relaciones; valida antes de tocar personas.
 IF p_id IS NOT NULL THEN
  SELECT * INTO v_old FROM electoral.vehicles WHERE id=p_id AND organization_id=p_org AND canton_id=p_canton FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vehículo ajeno' USING ERRCODE='42501'; END IF;
  IF v_old.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'Versión obsoleta' USING ERRCODE='40001'; END IF;
  IF length(trim(p_reason))<3 THEN RAISE EXCEPTION 'Indica motivo del cambio' USING ERRCODE='22023'; END IF;
 ELSIF p_version IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'Versión inválida' USING ERRCODE='40001'; END IF;
 IF NOT p_active THEN p_districts:='{}'; p_centers:='{}'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_districts) d WHERE d IS NULL OR NOT EXISTS(SELECT 1 FROM electoral.districts WHERE id=d AND canton_id=p_canton AND active))
 OR EXISTS(SELECT 1 FROM unnest(p_centers) c WHERE c IS NULL OR NOT EXISTS(SELECT 1 FROM electoral.center_elections ce JOIN electoral.voting_centers vc ON vc.id=ce.center_id WHERE ce.id=c AND ce.organization_id=p_org AND ce.canton_id=p_canton AND ce.event_id=p_event AND ce.district_id=ANY(p_districts) AND vc.archived_at IS NULL AND ce.internal_status<>'inactivo')) THEN RAISE EXCEPTION 'Distrito o centro inválido' USING ERRCODE='22023'; END IF;
 IF p_person IS NULL THEN
  INSERT INTO electoral.people(organization_id,full_name,phone,email) VALUES(p_org,trim(p_name),nullif(trim(p_phone),''),nullif(p_email,'')) RETURNING id INTO v_person;
 ELSE
  PERFORM 1 FROM electoral.people WHERE id=p_person AND organization_id=p_org AND updated_at::text=p_person_version FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Persona modificada' USING ERRCODE='40001'; END IF;
  v_person:=p_person;
  UPDATE electoral.people SET full_name=trim(p_name),phone=nullif(trim(p_phone),''),email=nullif(p_email,'') WHERE id=v_person AND organization_id=p_org;
 END IF;
 IF p_id IS NULL THEN
  INSERT INTO electoral.vehicles(organization_id,canton_id,plate,description,responsible_id,active) VALUES(p_org,p_canton,upper(trim(p_plate)),trim(p_description),v_person,p_active) RETURNING id INTO v_id;
 ELSE
  v_id:=p_id;
  UPDATE electoral.vehicles SET plate=upper(trim(p_plate)),description=trim(p_description),responsible_id=v_person,active=p_active,version=version+1 WHERE id=v_id;
 END IF;
 UPDATE electoral.vehicle_center_assignments SET ended_at=now() WHERE vehicle_id=v_id AND ended_at IS NULL AND (NOT p_active OR (event_id=p_event AND NOT(center_election_id=ANY(p_centers))));
 UPDATE electoral.vehicle_district_assignments SET ended_at=now() WHERE vehicle_id=v_id AND ended_at IS NULL AND (NOT p_active OR (event_id=p_event AND NOT(district_id=ANY(p_districts))));
 INSERT INTO electoral.vehicle_district_assignments(vehicle_id,organization_id,canton_id,event_id,district_id)
 SELECT v_id,p_org,p_canton,p_event,d FROM (SELECT DISTINCT unnest(p_districts) d) x WHERE NOT EXISTS(SELECT 1 FROM electoral.vehicle_district_assignments WHERE vehicle_id=v_id AND event_id=p_event AND district_id=d AND ended_at IS NULL);
 INSERT INTO electoral.vehicle_center_assignments(vehicle_id,organization_id,canton_id,event_id,center_election_id)
 SELECT v_id,p_org,p_canton,p_event,c FROM (SELECT DISTINCT unnest(p_centers) c) x WHERE NOT EXISTS(SELECT 1 FROM electoral.vehicle_center_assignments WHERE vehicle_id=v_id AND event_id=p_event AND center_election_id=c AND ended_at IS NULL);
 -- Auditoría sin placa ni datos personales; motivo separado del contenido de contactos.
 INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action,before_json,after_json) VALUES(p_org,p_actor,'vehicles',v_id,CASE WHEN p_id IS NULL THEN 'create' ELSE 'update' END,CASE WHEN p_id IS NULL THEN NULL ELSE jsonb_build_object('responsible_id',v_old.responsible_id,'active',v_old.active) END,jsonb_build_object('reason',p_reason,'active',p_active,'responsible_id',v_person));
 INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action) VALUES(p_org,p_actor,'people',v_person,'transport_contact');
 RETURN v_id;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.save_vehicle(uuid,uuid,uuid,uuid,uuid,integer,text,text,uuid,text,text,text,text,boolean,uuid[],uuid[],text) FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.save_vehicle(uuid,uuid,uuid,uuid,uuid,integer,text,text,uuid,text,text,text,text,boolean,uuid[],uuid[],text) TO electoral_app;
--> statement-breakpoint
CREATE FUNCTION electoral.save_training_requirement(p_actor uuid,p_org uuid,p_canton uuid,p_event uuid,p_position uuid,p_expected uuid,p_required boolean,p_date date) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
DECLARE v_previous electoral.training_requirements; v_id uuid;
BEGIN
 PERFORM electoral.require_global_admin(p_actor,p_org);
 IF NOT EXISTS(SELECT 1 FROM electoral.organization_cantons WHERE organization_id=p_org AND canton_id=p_canton AND active) OR NOT EXISTS(SELECT 1 FROM electoral.election_events WHERE id=p_event AND organization_id=p_org) THEN RAISE EXCEPTION 'Ámbito inválido' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM electoral.organizational_positions WHERE id=p_position AND organization_id=p_org AND canton_id=p_canton AND active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Puesto inválido' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_previous FROM electoral.training_requirements WHERE position_id=p_position AND event_id=p_event ORDER BY revision DESC LIMIT 1;
 IF v_previous.id IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Requisito modificado' USING ERRCODE='40001'; END IF;
 IF p_required IS NULL OR (NOT p_required AND p_date IS NOT NULL) THEN RAISE EXCEPTION 'Fecha inválida' USING ERRCODE='22023'; END IF;
 IF v_previous.id IS NOT NULL AND v_previous.required=p_required AND v_previous.scheduled_on IS NOT DISTINCT FROM p_date THEN RETURN v_previous.id; END IF;
 INSERT INTO electoral.training_requirements(organization_id,canton_id,event_id,position_id,required,scheduled_on,revision,created_by) VALUES(p_org,p_canton,p_event,p_position,p_required,p_date,coalesce(v_previous.revision,0)+1,p_actor) RETURNING id INTO v_id;
 INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action) VALUES(p_org,p_actor,'training_requirements',v_id,'configure');
 RETURN v_id;
END $$;
--> statement-breakpoint
CREATE FUNCTION electoral.record_training_progress(p_actor uuid,p_org uuid,p_canton uuid,p_event uuid,p_requirement uuid,p_assignment uuid,p_expected uuid,p_status text,p_date date) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
DECLARE v_req electoral.training_requirements; v_previous electoral.training_progress; v_id uuid;
BEGIN
 PERFORM electoral.require_global_admin(p_actor,p_org);
 SELECT * INTO v_req FROM electoral.training_requirements WHERE id=p_requirement AND organization_id=p_org AND canton_id=p_canton AND event_id=p_event;
 IF NOT FOUND THEN RAISE EXCEPTION 'Requisito inválido' USING ERRCODE='42501'; END IF;
 -- Mismo orden de bloqueo que set_responsible y configuración: primero el puesto.
 PERFORM 1 FROM electoral.organizational_positions WHERE id=v_req.position_id AND active FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM electoral.organization_cantons WHERE organization_id=p_org AND canton_id=p_canton AND active) THEN RAISE EXCEPTION 'Ámbito inactivo' USING ERRCODE='42501'; END IF;
 IF NOT v_req.required OR EXISTS(SELECT 1 FROM electoral.training_requirements WHERE position_id=v_req.position_id AND event_id=p_event AND revision>v_req.revision) THEN RAISE EXCEPTION 'Requisito obsoleto o no obligatorio' USING ERRCODE='40001'; END IF;
 IF NOT EXISTS(SELECT 1 FROM electoral.organizational_assignments WHERE id=p_assignment AND position_id=v_req.position_id AND organization_id=p_org AND canton_id=p_canton AND ended_at IS NULL) THEN RAISE EXCEPTION 'Ocupante no vigente' USING ERRCODE='42501'; END IF;
 IF p_status IS NULL OR p_status NOT IN ('pendiente','convocado','cumplido','no_asistio') OR p_date IS NULL OR p_date>(now() AT TIME ZONE 'America/Costa_Rica')::date OR (p_status IN ('cumplido','no_asistio') AND (v_req.scheduled_on IS NULL OR v_req.scheduled_on>p_date)) OR (p_status='convocado' AND v_req.scheduled_on IS NULL) THEN RAISE EXCEPTION 'Estado o fecha inválidos' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_previous FROM electoral.training_progress WHERE requirement_id=p_requirement AND assignment_id=p_assignment ORDER BY sequence DESC LIMIT 1;
 IF v_previous.id IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Estado modificado' USING ERRCODE='40001'; END IF;
 IF v_previous.id IS NOT NULL AND p_date<v_previous.status_on THEN RAISE EXCEPTION 'Fecha anterior al historial' USING ERRCODE='22023'; END IF;
 INSERT INTO electoral.training_progress(requirement_id,assignment_id,organization_id,canton_id,event_id,position_id,status,status_on,sequence,created_by) VALUES(p_requirement,p_assignment,p_org,p_canton,p_event,v_req.position_id,p_status,p_date,coalesce(v_previous.sequence,0)+1,p_actor) RETURNING id INTO v_id;
 INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action) VALUES(p_org,p_actor,'training_progress',v_id,p_status);
 RETURN v_id;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.save_training_requirement(uuid,uuid,uuid,uuid,uuid,uuid,boolean,date),electoral.record_training_progress(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,date) FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.save_training_requirement(uuid,uuid,uuid,uuid,uuid,uuid,boolean,date),electoral.record_training_progress(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,date) TO electoral_app;
