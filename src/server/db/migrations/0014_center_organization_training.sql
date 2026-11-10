ALTER TABLE "electoral"."center_area_assignments" ADD CONSTRAINT "center_assignment_training_scope" UNIQUE("id","organization_id","event_id","center_election_id","area_id");--> statement-breakpoint
CREATE TABLE "electoral"."center_training_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"center_id" uuid NOT NULL,
	"area_id" uuid NOT NULL,
	"requirement_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"status" text NOT NULL,
	"status_on" date NOT NULL,
	"sequence" integer NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "center_training_sequence" UNIQUE("requirement_id","assignment_id","sequence"),
	CONSTRAINT "center_training_progress_valid" CHECK ("electoral"."center_training_progress"."sequence">0 AND "electoral"."center_training_progress"."status" IN ('pendiente','convocado','cumplido','no_asistio'))
);
--> statement-breakpoint
ALTER TABLE "electoral"."center_training_progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "electoral"."center_training_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"center_id" uuid NOT NULL,
	"area_id" uuid NOT NULL,
	"required" boolean NOT NULL,
	"scheduled_on" date,
	"revision" integer NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "center_training_revision" UNIQUE("center_id","area_id","revision"),
	CONSTRAINT "center_training_scope" UNIQUE("id","organization_id","event_id","center_id","area_id"),
	CONSTRAINT "center_training_requirement_valid" CHECK ("electoral"."center_training_requirements"."revision">0 AND ("electoral"."center_training_requirements"."required" OR "electoral"."center_training_requirements"."scheduled_on" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "electoral"."center_training_requirements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "electoral"."center_training_progress" ADD CONSTRAINT "center_training_progress_requirement_id_organization_id_event_id_center_id_area_id_center_training_requirements_id_organization_id_event_id_center_id_area_id_fk" FOREIGN KEY ("requirement_id","organization_id","event_id","center_id","area_id") REFERENCES "electoral"."center_training_requirements"("id","organization_id","event_id","center_id","area_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."center_training_progress" ADD CONSTRAINT "center_training_progress_assignment_id_organization_id_event_id_center_id_area_id_center_area_assignments_id_organization_id_event_id_center_election_id_area_id_fk" FOREIGN KEY ("assignment_id","organization_id","event_id","center_id","area_id") REFERENCES "electoral"."center_area_assignments"("id","organization_id","event_id","center_election_id","area_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."center_training_requirements" ADD CONSTRAINT "center_training_requirements_center_id_organization_id_event_id_center_elections_id_organization_id_event_id_fk" FOREIGN KEY ("center_id","organization_id","event_id") REFERENCES "electoral"."center_elections"("id","organization_id","event_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."center_training_requirements" ADD CONSTRAINT "center_training_requirements_area_id_organization_id_functional_areas_id_organization_id_fk" FOREIGN KEY ("area_id","organization_id") REFERENCES "electoral"."functional_areas"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

CREATE POLICY "center_training_progress_read" ON "electoral"."center_training_progress" AS PERMISSIVE FOR SELECT TO "electoral_app" USING (true);--> statement-breakpoint
CREATE POLICY "center_training_requirements_read" ON "electoral"."center_training_requirements" AS PERMISSIVE FOR SELECT TO "electoral_app" USING (true);
--> statement-breakpoint
REVOKE ALL ON electoral.center_training_requirements,electoral.center_training_progress FROM PUBLIC,anon,authenticated,electoral_app;
--> statement-breakpoint
GRANT SELECT ON electoral.center_training_requirements,electoral.center_training_progress TO electoral_app;
--> statement-breakpoint
CREATE FUNCTION electoral.save_center_training_requirement(p_actor uuid,p_org uuid,p_canton uuid,p_event uuid,p_center uuid,p_area uuid,p_expected uuid,p_required boolean,p_date date) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
DECLARE v_previous electoral.center_training_requirements; v_id uuid; v_code text;
BEGIN
 PERFORM electoral.require_global_admin(p_actor,p_org);
 SELECT code INTO v_code FROM electoral.functional_areas WHERE id=p_area AND organization_id=p_org AND active AND code<>'A09';
 PERFORM electoral.require_center_area(p_actor,p_org,p_canton,p_event,p_center,v_code);
 -- Same lock as replacement of the center's responsible person.
 PERFORM 1 FROM electoral.center_elections WHERE id=p_center AND internal_status<>'inactivo' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Centro inactivo' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_previous FROM electoral.center_training_requirements WHERE center_id=p_center AND area_id=p_area ORDER BY revision DESC LIMIT 1;
 IF v_previous.id IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Requisito modificado' USING ERRCODE='40001'; END IF;
 IF p_required IS NULL OR (NOT p_required AND p_date IS NOT NULL) THEN RAISE EXCEPTION 'Fecha inválida' USING ERRCODE='22023'; END IF;
 IF v_previous.id IS NOT NULL AND v_previous.required=p_required AND v_previous.scheduled_on IS NOT DISTINCT FROM p_date THEN RETURN v_previous.id; END IF;
 INSERT INTO electoral.center_training_requirements(organization_id,event_id,center_id,area_id,required,scheduled_on,revision,created_by)
 VALUES(p_org,p_event,p_center,p_area,p_required,p_date,coalesce(v_previous.revision,0)+1,p_actor) RETURNING id INTO v_id;
 INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action) VALUES(p_org,p_actor,'center_training_requirements',v_id,'configure');
 RETURN v_id;
END $$;
--> statement-breakpoint
CREATE FUNCTION electoral.record_center_training_progress(p_actor uuid,p_org uuid,p_canton uuid,p_event uuid,p_center uuid,p_requirement uuid,p_assignment uuid,p_expected uuid,p_status text,p_date date) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
DECLARE v_req electoral.center_training_requirements; v_previous electoral.center_training_progress; v_id uuid; v_code text;
BEGIN
 PERFORM electoral.require_global_admin(p_actor,p_org);
 SELECT * INTO v_req FROM electoral.center_training_requirements WHERE id=p_requirement AND center_id=p_center AND organization_id=p_org AND event_id=p_event;
 IF NOT FOUND THEN RAISE EXCEPTION 'Requisito inválido' USING ERRCODE='42501'; END IF;
 SELECT code INTO v_code FROM electoral.functional_areas WHERE id=v_req.area_id AND organization_id=p_org AND active AND code<>'A09';
 PERFORM electoral.require_center_area(p_actor,p_org,p_canton,p_event,p_center,v_code);
 PERFORM 1 FROM electoral.center_elections WHERE id=p_center AND internal_status<>'inactivo' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Centro inactivo' USING ERRCODE='42501'; END IF;
 IF NOT v_req.required OR EXISTS(SELECT 1 FROM electoral.center_training_requirements WHERE center_id=p_center AND area_id=v_req.area_id AND revision>v_req.revision) THEN RAISE EXCEPTION 'Requisito obsoleto' USING ERRCODE='40001'; END IF;
 IF NOT EXISTS(SELECT 1 FROM electoral.center_area_assignments WHERE id=p_assignment AND center_election_id=p_center AND area_id=v_req.area_id AND organization_id=p_org AND event_id=p_event AND ended_at IS NULL) THEN RAISE EXCEPTION 'Ocupante no vigente' USING ERRCODE='42501'; END IF;
 IF p_status IS NULL OR p_status NOT IN ('pendiente','convocado','cumplido','no_asistio') OR p_date IS NULL OR p_date>(now() AT TIME ZONE 'America/Costa_Rica')::date OR (p_status IN ('cumplido','no_asistio') AND (v_req.scheduled_on IS NULL OR v_req.scheduled_on>p_date)) OR (p_status='convocado' AND v_req.scheduled_on IS NULL) THEN RAISE EXCEPTION 'Estado o fecha inválidos' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_previous FROM electoral.center_training_progress WHERE requirement_id=p_requirement AND assignment_id=p_assignment ORDER BY sequence DESC LIMIT 1;
 IF v_previous.id IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Estado modificado' USING ERRCODE='40001'; END IF;
 IF v_previous.id IS NOT NULL AND p_date<v_previous.status_on THEN RAISE EXCEPTION 'Fecha anterior al historial' USING ERRCODE='22023'; END IF;
 INSERT INTO electoral.center_training_progress(organization_id,event_id,center_id,area_id,requirement_id,assignment_id,status,status_on,sequence,created_by)
 VALUES(p_org,p_event,p_center,v_req.area_id,p_requirement,p_assignment,p_status,p_date,coalesce(v_previous.sequence,0)+1,p_actor) RETURNING id INTO v_id;
 INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action) VALUES(p_org,p_actor,'center_training_progress',v_id,p_status);
 RETURN v_id;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.save_center_training_requirement(uuid,uuid,uuid,uuid,uuid,uuid,uuid,boolean,date),electoral.record_center_training_progress(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,date) FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.save_center_training_requirement(uuid,uuid,uuid,uuid,uuid,uuid,uuid,boolean,date),electoral.record_center_training_progress(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,date) TO electoral_app;
