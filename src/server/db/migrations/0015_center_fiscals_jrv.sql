CREATE TABLE "electoral"."election_boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"center_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"source_reference" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "board_number_event" UNIQUE("organization_id","event_id","number"),
	CONSTRAINT "board_scope" UNIQUE("id","organization_id","event_id","center_id"),
	CONSTRAINT "board_number_valid" CHECK ("electoral"."election_boards"."number">0 AND length(trim("electoral"."election_boards"."source_reference")) BETWEEN 3 AND 500)
);
--> statement-breakpoint
ALTER TABLE "electoral"."election_boards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "electoral"."fiscal_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"center_id" uuid NOT NULL,
	"board_id" uuid,
	"role" text NOT NULL,
	"person_id" uuid NOT NULL,
	"accreditation_scope" text DEFAULT '' NOT NULL,
	"accreditation_reference" text DEFAULT '' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"ended_reason" text,
	"created_by" uuid NOT NULL,
	CONSTRAINT "fiscal_role_destination" CHECK (("electoral"."fiscal_assignments"."role" IN ('general','general_suplente') AND "electoral"."fiscal_assignments"."board_id" IS NULL) OR ("electoral"."fiscal_assignments"."role" IN ('titular','suplente') AND "electoral"."fiscal_assignments"."board_id" IS NOT NULL)),
	CONSTRAINT "fiscal_end_valid" CHECK (("electoral"."fiscal_assignments"."ended_at" IS NULL AND "electoral"."fiscal_assignments"."ended_reason" IS NULL) OR ("electoral"."fiscal_assignments"."ended_at">="electoral"."fiscal_assignments"."started_at" AND length(trim("electoral"."fiscal_assignments"."ended_reason")) BETWEEN 3 AND 500)),
	CONSTRAINT "fiscal_accreditation_length" CHECK (length("electoral"."fiscal_assignments"."accreditation_scope")<=1000 AND length("electoral"."fiscal_assignments"."accreditation_reference")<=500)
);
--> statement-breakpoint
ALTER TABLE "electoral"."fiscal_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "electoral"."election_boards" ADD CONSTRAINT "election_boards_center_id_organization_id_event_id_center_elections_id_organization_id_event_id_fk" FOREIGN KEY ("center_id","organization_id","event_id") REFERENCES "electoral"."center_elections"("id","organization_id","event_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."fiscal_assignments" ADD CONSTRAINT "fiscal_assignments_center_id_organization_id_event_id_center_elections_id_organization_id_event_id_fk" FOREIGN KEY ("center_id","organization_id","event_id") REFERENCES "electoral"."center_elections"("id","organization_id","event_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."fiscal_assignments" ADD CONSTRAINT "fiscal_assignments_board_id_organization_id_event_id_center_id_election_boards_id_organization_id_event_id_center_id_fk" FOREIGN KEY ("board_id","organization_id","event_id","center_id") REFERENCES "electoral"."election_boards"("id","organization_id","event_id","center_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."fiscal_assignments" ADD CONSTRAINT "fiscal_assignments_person_id_organization_id_people_id_organization_id_fk" FOREIGN KEY ("person_id","organization_id") REFERENCES "electoral"."people"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fiscal_board_current_role" ON "electoral"."fiscal_assignments" USING btree ("board_id","role") WHERE "electoral"."fiscal_assignments"."ended_at" IS NULL AND "electoral"."fiscal_assignments"."board_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "fiscal_board_current_person" ON "electoral"."fiscal_assignments" USING btree ("board_id","person_id") WHERE "electoral"."fiscal_assignments"."ended_at" IS NULL AND "electoral"."fiscal_assignments"."board_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "fiscal_general_current_person" ON "electoral"."fiscal_assignments" USING btree ("center_id","person_id") WHERE "electoral"."fiscal_assignments"."ended_at" IS NULL AND "electoral"."fiscal_assignments"."role" IN ('general','general_suplente');--> statement-breakpoint
CREATE UNIQUE INDEX "fiscal_general_current_titular" ON "electoral"."fiscal_assignments" USING btree ("center_id") WHERE "electoral"."fiscal_assignments"."ended_at" IS NULL AND "electoral"."fiscal_assignments"."role"='general';--> statement-breakpoint
CREATE INDEX "fiscal_center_history" ON "electoral"."fiscal_assignments" USING btree ("center_id","started_at");--> statement-breakpoint
CREATE POLICY "election_boards_read" ON "electoral"."election_boards" AS PERMISSIVE FOR SELECT TO "electoral_app" USING (true);--> statement-breakpoint
CREATE POLICY "fiscal_assignments_read" ON "electoral"."fiscal_assignments" AS PERMISSIVE FOR SELECT TO "electoral_app" USING (true);
--> statement-breakpoint
REVOKE ALL ON electoral.election_boards,electoral.fiscal_assignments FROM PUBLIC,anon,authenticated,electoral_app;
--> statement-breakpoint
GRANT SELECT ON electoral.election_boards,electoral.fiscal_assignments TO electoral_app;
--> statement-breakpoint
CREATE FUNCTION electoral.create_election_board(p_actor uuid,p_org uuid,p_canton uuid,p_event uuid,p_center uuid,p_number integer,p_source text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
DECLARE v_id uuid;
BEGIN
 PERFORM electoral.require_center_area(p_actor,p_org,p_canton,p_event,p_center,'A04');
 PERFORM 1 FROM electoral.center_elections WHERE id=p_center AND internal_status<>'inactivo' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Centro inactivo' USING ERRCODE='42501'; END IF;
 IF p_number IS NULL OR p_number<1 OR p_source IS NULL OR length(trim(p_source)) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'JRV o fuente inválida' USING ERRCODE='22023'; END IF;
 INSERT INTO electoral.election_boards(organization_id,event_id,center_id,number,source_reference,created_by) VALUES(p_org,p_event,p_center,p_number,trim(p_source),p_actor) RETURNING id INTO v_id;
 INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action) VALUES(p_org,p_actor,'election_boards',v_id,'manual_register');
 RETURN v_id;
END $$;
--> statement-breakpoint
CREATE FUNCTION electoral.set_center_fiscal(p_actor uuid,p_org uuid,p_canton uuid,p_event uuid,p_center uuid,p_board uuid,p_role text,p_expected uuid,p_person uuid,p_scope text,p_reference text,p_reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
DECLARE v_current electoral.fiscal_assignments; v_id uuid;
BEGIN
 PERFORM electoral.require_center_area(p_actor,p_org,p_canton,p_event,p_center,'A04');
 -- Serialize slots, substitutes and replacements under the same center lock.
 PERFORM 1 FROM electoral.center_elections WHERE id=p_center AND internal_status<>'inactivo' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Centro inactivo' USING ERRCODE='42501'; END IF;
 IF p_role IS NULL OR p_role NOT IN ('general','general_suplente','titular','suplente') OR ((p_role IN ('general','general_suplente')) IS DISTINCT FROM (p_board IS NULL)) THEN RAISE EXCEPTION 'Cargo o destino inválido' USING ERRCODE='22023'; END IF;
 IF p_board IS NOT NULL AND NOT EXISTS(SELECT 1 FROM electoral.election_boards WHERE id=p_board AND center_id=p_center AND event_id=p_event AND organization_id=p_org) THEN RAISE EXCEPTION 'JRV ajena' USING ERRCODE='42501'; END IF;
 IF p_person IS NOT NULL AND NOT EXISTS(SELECT 1 FROM electoral.people WHERE id=p_person AND organization_id=p_org) THEN RAISE EXCEPTION 'Persona ajena' USING ERRCODE='42501'; END IF;
 IF p_scope IS NULL OR length(p_scope)>1000 OR p_reference IS NULL OR length(p_reference)>500 OR p_reason IS NULL OR length(p_reason)>500 THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023'; END IF;
 IF p_role='general_suplente' THEN
  IF p_expected IS NOT NULL THEN
   SELECT * INTO v_current FROM electoral.fiscal_assignments WHERE id=p_expected AND center_id=p_center AND role=p_role AND ended_at IS NULL;
  END IF;
 ELSE
  SELECT * INTO v_current FROM electoral.fiscal_assignments WHERE center_id=p_center AND board_id IS NOT DISTINCT FROM p_board AND role=p_role AND ended_at IS NULL;
 END IF;
 IF v_current.id IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Asignación modificada' USING ERRCODE='40001'; END IF;
 IF v_current.id IS NULL AND p_person IS NULL THEN RAISE EXCEPTION 'Sin persona' USING ERRCODE='22023'; END IF;
 IF v_current.id IS NOT NULL AND length(trim(p_reason))<3 THEN RAISE EXCEPTION 'Indicá motivo de cambio o retiro' USING ERRCODE='22023'; END IF;
 IF v_current.id IS NOT NULL AND v_current.person_id=p_person AND v_current.accreditation_scope=trim(p_scope) AND v_current.accreditation_reference=trim(p_reference) THEN RETURN v_current.id; END IF;
 IF v_current.id IS NOT NULL THEN
  UPDATE electoral.fiscal_assignments SET ended_at=now(),ended_reason=trim(p_reason) WHERE id=v_current.id;
  INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action) VALUES(p_org,p_actor,'fiscal_assignments',v_current.id,'end');
 END IF;
 IF p_person IS NULL THEN RETURN v_current.id; END IF;
 INSERT INTO electoral.fiscal_assignments(organization_id,event_id,center_id,board_id,role,person_id,accreditation_scope,accreditation_reference,created_by)
 VALUES(p_org,p_event,p_center,p_board,p_role,p_person,trim(p_scope),trim(p_reference),p_actor) RETURNING id INTO v_id;
 INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action) VALUES(p_org,p_actor,'fiscal_assignments',v_id,'assign');
 RETURN v_id;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.create_election_board(uuid,uuid,uuid,uuid,uuid,integer,text),electoral.set_center_fiscal(uuid,uuid,uuid,uuid,uuid,uuid,text,uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.create_election_board(uuid,uuid,uuid,uuid,uuid,integer,text),electoral.set_center_fiscal(uuid,uuid,uuid,uuid,uuid,uuid,text,uuid,uuid,text,text,text) TO electoral_app;
