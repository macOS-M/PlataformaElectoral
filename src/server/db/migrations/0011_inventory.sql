CREATE TABLE "electoral"."inventory_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"canton_id" uuid NOT NULL,
	"movement_id" uuid NOT NULL,
	"approved" boolean NOT NULL,
	"reason" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_decisions_movement_id_unique" UNIQUE("movement_id"),
	CONSTRAINT "inventory_decision_reason" CHECK (length(trim("electoral"."inventory_decisions"."reason")) between 3 and 500)
);
--> statement-breakpoint
ALTER TABLE "electoral"."inventory_decisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "electoral"."inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"canton_id" uuid NOT NULL,
	"name" text NOT NULL,
	"variant" text DEFAULT '' NOT NULL,
	"unit" text NOT NULL,
	"category" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_item_scope" UNIQUE("id","organization_id","canton_id"),
	CONSTRAINT "inventory_item_text" CHECK (length(trim("electoral"."inventory_items"."name")) between 2 and 120 and length("electoral"."inventory_items"."variant") <= 100 and length(trim("electoral"."inventory_items"."category")) between 2 and 80 and "electoral"."inventory_items"."unit" in ('pieza','caja','paquete','docena','metro','litro','kilogramo') and "electoral"."inventory_items"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "electoral"."inventory_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "electoral"."inventory_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"canton_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"district_id" uuid,
	"center_id" uuid,
	"person_id" uuid,
	"event_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_location_scope" UNIQUE("id","organization_id","canton_id"),
	CONSTRAINT "inventory_location_kind" CHECK (length(trim("electoral"."inventory_locations"."name")) between 2 and 160 and (("electoral"."inventory_locations"."kind"='almacen' and "electoral"."inventory_locations"."district_id" is null and "electoral"."inventory_locations"."center_id" is null and "electoral"."inventory_locations"."person_id" is null and "electoral"."inventory_locations"."event_id" is null) or ("electoral"."inventory_locations"."kind"='distrito' and "electoral"."inventory_locations"."district_id" is not null and "electoral"."inventory_locations"."center_id" is null and "electoral"."inventory_locations"."person_id" is null and "electoral"."inventory_locations"."event_id" is null) or ("electoral"."inventory_locations"."kind"='centro' and "electoral"."inventory_locations"."center_id" is not null and "electoral"."inventory_locations"."event_id" is not null and "electoral"."inventory_locations"."district_id" is null and "electoral"."inventory_locations"."person_id" is null) or ("electoral"."inventory_locations"."kind"='persona' and "electoral"."inventory_locations"."person_id" is not null and "electoral"."inventory_locations"."district_id" is null and "electoral"."inventory_locations"."center_id" is null and "electoral"."inventory_locations"."event_id" is null)))
);
--> statement-breakpoint
ALTER TABLE "electoral"."inventory_locations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "electoral"."inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"canton_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"source_id" uuid,
	"destination_id" uuid,
	"person_id" uuid NOT NULL,
	"occurred_on" date NOT NULL,
	"origin" text DEFAULT '' NOT NULL,
	"reason" text NOT NULL,
	"evidence" text DEFAULT '' NOT NULL,
	"request_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_movement_scope" UNIQUE("id","organization_id","canton_id"),
	CONSTRAINT "inventory_movement_request" UNIQUE("organization_id","canton_id","request_id"),
	CONSTRAINT "inventory_movement_data" CHECK ("electoral"."inventory_movements"."quantity" > 0 and "electoral"."inventory_movements"."quantity" <> 'NaN'::numeric and length(trim("electoral"."inventory_movements"."reason")) between 3 and 500 and length("electoral"."inventory_movements"."evidence") <= 500 and length("electoral"."inventory_movements"."origin") <= 160 and ("electoral"."inventory_movements"."kind"<>'ingreso' or length(trim("electoral"."inventory_movements"."origin")) >= 2) and (("electoral"."inventory_movements"."kind"='ingreso' and "electoral"."inventory_movements"."source_id" is null and "electoral"."inventory_movements"."destination_id" is not null) or ("electoral"."inventory_movements"."kind"='transferencia' and "electoral"."inventory_movements"."source_id" is not null and "electoral"."inventory_movements"."destination_id" is not null and "electoral"."inventory_movements"."source_id"<>"electoral"."inventory_movements"."destination_id") or ("electoral"."inventory_movements"."kind" in ('consumo','dano','perdida','robo','baja') and "electoral"."inventory_movements"."source_id" is not null and "electoral"."inventory_movements"."destination_id" is null)))
);
--> statement-breakpoint
ALTER TABLE "electoral"."inventory_movements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "electoral"."inventory_needs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"canton_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"required" numeric(14, 3) NOT NULL,
	"revision" integer NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_need_revision" UNIQUE("organization_id","canton_id","event_id","item_id","location_id","revision"),
	CONSTRAINT "inventory_need_quantity" CHECK ("electoral"."inventory_needs"."required" >= 0 and "electoral"."inventory_needs"."required" <> 'NaN'::numeric and "electoral"."inventory_needs"."revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "electoral"."inventory_needs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "electoral"."inventory_decisions" ADD CONSTRAINT "inventory_decision_movement" FOREIGN KEY ("movement_id","organization_id","canton_id") REFERENCES "electoral"."inventory_movements"("id","organization_id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."inventory_items" ADD CONSTRAINT "inventory_item_canton" FOREIGN KEY ("organization_id","canton_id") REFERENCES "electoral"."organization_cantons"("organization_id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."inventory_locations" ADD CONSTRAINT "inventory_location_canton" FOREIGN KEY ("organization_id","canton_id") REFERENCES "electoral"."organization_cantons"("organization_id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."inventory_locations" ADD CONSTRAINT "inventory_location_district_fk" FOREIGN KEY ("district_id","canton_id") REFERENCES "electoral"."districts"("id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."inventory_locations" ADD CONSTRAINT "inventory_location_center_fk" FOREIGN KEY ("center_id","organization_id","event_id") REFERENCES "electoral"."center_elections"("id","organization_id","event_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."inventory_locations" ADD CONSTRAINT "inventory_location_person_fk" FOREIGN KEY ("person_id","organization_id") REFERENCES "electoral"."people"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."inventory_movements" ADD CONSTRAINT "inventory_movement_item" FOREIGN KEY ("item_id","organization_id","canton_id") REFERENCES "electoral"."inventory_items"("id","organization_id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."inventory_movements" ADD CONSTRAINT "inventory_movement_source" FOREIGN KEY ("source_id","organization_id","canton_id") REFERENCES "electoral"."inventory_locations"("id","organization_id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."inventory_movements" ADD CONSTRAINT "inventory_movement_destination" FOREIGN KEY ("destination_id","organization_id","canton_id") REFERENCES "electoral"."inventory_locations"("id","organization_id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."inventory_movements" ADD CONSTRAINT "inventory_movement_event" FOREIGN KEY ("event_id","organization_id") REFERENCES "electoral"."election_events"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."inventory_movements" ADD CONSTRAINT "inventory_movement_person" FOREIGN KEY ("person_id","organization_id") REFERENCES "electoral"."people"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."inventory_needs" ADD CONSTRAINT "inventory_need_item" FOREIGN KEY ("item_id","organization_id","canton_id") REFERENCES "electoral"."inventory_items"("id","organization_id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."inventory_needs" ADD CONSTRAINT "inventory_need_location" FOREIGN KEY ("location_id","organization_id","canton_id") REFERENCES "electoral"."inventory_locations"("id","organization_id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."inventory_needs" ADD CONSTRAINT "inventory_need_event" FOREIGN KEY ("event_id","organization_id") REFERENCES "electoral"."election_events"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_item_identity" ON "electoral"."inventory_items" USING btree ("organization_id","canton_id",lower(trim("name")),lower(trim("variant")),"unit");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_location_name" ON "electoral"."inventory_locations" USING btree ("organization_id","canton_id",lower(trim("name"))) WHERE "electoral"."inventory_locations"."kind"='almacen';--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_location_district" ON "electoral"."inventory_locations" USING btree ("organization_id","canton_id","district_id") WHERE "electoral"."inventory_locations"."kind"='distrito';--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_location_center" ON "electoral"."inventory_locations" USING btree ("organization_id","canton_id","center_id") WHERE "electoral"."inventory_locations"."kind"='centro';--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_location_person" ON "electoral"."inventory_locations" USING btree ("organization_id","canton_id","person_id") WHERE "electoral"."inventory_locations"."kind"='persona';--> statement-breakpoint
CREATE INDEX "inventory_movement_scope_date" ON "electoral"."inventory_movements" USING btree ("organization_id","canton_id","occurred_on");--> statement-breakpoint
CREATE POLICY "inventory_decisions_server_read" ON "electoral"."inventory_decisions" AS PERMISSIVE FOR SELECT TO "electoral_app" USING (true);--> statement-breakpoint
CREATE POLICY "inventory_items_server_read" ON "electoral"."inventory_items" AS PERMISSIVE FOR SELECT TO "electoral_app" USING (true);--> statement-breakpoint
CREATE POLICY "inventory_locations_server_read" ON "electoral"."inventory_locations" AS PERMISSIVE FOR SELECT TO "electoral_app" USING (true);--> statement-breakpoint
CREATE POLICY "inventory_movements_server_read" ON "electoral"."inventory_movements" AS PERMISSIVE FOR SELECT TO "electoral_app" USING (true);--> statement-breakpoint
CREATE POLICY "inventory_needs_server_read" ON "electoral"."inventory_needs" AS PERMISSIVE FOR SELECT TO "electoral_app" USING (true);
--> statement-breakpoint
CREATE FUNCTION electoral.inventory_allowed(p_actor uuid,p_org uuid,p_canton uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
 SELECT EXISTS(SELECT 1 FROM electoral.organization_memberships m JOIN electoral.organizations o ON o.id=m.organization_id JOIN electoral.organization_cantons c ON c.organization_id=o.id JOIN auth.users u ON u.id=m.user_id
 WHERE m.user_id=p_actor AND m.organization_id=p_org AND m.active AND o.active AND c.canton_id=p_canton AND c.active AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<now())
 AND (m.role='admin' OR EXISTS(SELECT 1 FROM electoral.module_permissions p WHERE p.organization_id=p_org AND p.canton_id=p_canton AND p.user_id=p_actor AND p.module='A01')))
$$;
--> statement-breakpoint
CREATE VIEW electoral.inventory_effects WITH (security_invoker=true) AS
 SELECT m.id,m.organization_id,m.canton_id,m.item_id,m.source_id AS location_id,
 CASE WHEN m.kind='baja' THEN 0 ELSE -m.quantity END AS usable,
 CASE WHEN m.kind='dano' THEN m.quantity WHEN m.kind='baja' THEN -m.quantity ELSE 0 END AS damaged
 FROM electoral.inventory_movements m LEFT JOIN electoral.inventory_decisions d ON d.movement_id=m.id
 WHERE m.source_id IS NOT NULL AND (m.kind NOT IN ('perdida','robo','baja') OR d.approved)
 UNION ALL
 SELECT m.id,m.organization_id,m.canton_id,m.item_id,m.destination_id,m.quantity,0::numeric
 FROM electoral.inventory_movements m WHERE m.destination_id IS NOT NULL;
--> statement-breakpoint
CREATE FUNCTION electoral.inventory_command(p_actor uuid,p_org uuid,p_canton uuid,p_event uuid,p_data jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
DECLARE
 op text:=p_data->>'operation'; v_id uuid; v_item electoral.inventory_items; v_location electoral.inventory_locations; v_move electoral.inventory_movements;
 v_source uuid; v_destination uuid; v_person uuid; v_qty numeric; v_kind text; v_date date; v_request uuid; v_old uuid; v_revision integer;
 v_usable numeric; v_damaged numeric; v_before jsonb; v_after jsonb; v_reason text; v_evidence text; v_origin text; v_name text; v_unit text; v_variant text; v_category text;
BEGIN
 IF NOT electoral.inventory_allowed(p_actor,p_org,p_canton) OR NOT EXISTS(SELECT 1 FROM electoral.election_events WHERE id=p_event AND organization_id=p_org) THEN RAISE EXCEPTION 'Sin permiso de inventario' USING ERRCODE='42501'; END IF;
 -- Stock is serialized per canton, including idempotency and approval. This intentionally
 -- favors correctness over parallel writes at the expected small cantonal volume.
 PERFORM pg_advisory_xact_lock(hashtextextended('inventory:'||p_org::text||':'||p_canton::text,0));
 v_reason:=trim(coalesce(p_data->>'reason',''));
 IF op='item' THEN
  v_name:=regexp_replace(trim(p_data->>'name'),'[[:space:]]+',' ','g'); v_unit:=p_data->>'unit'; v_variant:=regexp_replace(trim(coalesce(p_data->>'variant','')),'[[:space:]]+',' ','g'); v_category:=trim(p_data->>'category');
  v_id:=nullif(p_data->>'id','')::uuid;
  IF v_id IS NULL THEN
   IF coalesce((p_data->>'version')::integer,0)<>0 THEN RAISE EXCEPTION 'Versión inválida' USING ERRCODE='40001'; END IF;
   INSERT INTO electoral.inventory_items(organization_id,canton_id,name,variant,unit,category,active) VALUES(p_org,p_canton,v_name,v_variant,v_unit,v_category,coalesce((p_data->>'active')::boolean,true)) RETURNING id INTO v_id;
  ELSE
   SELECT * INTO v_item FROM electoral.inventory_items WHERE id=v_id AND organization_id=p_org AND canton_id=p_canton FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Artículo ajeno' USING ERRCODE='42501'; END IF;
   v_before:=to_jsonb(v_item);
   IF v_item.version IS DISTINCT FROM (p_data->>'version')::integer THEN RAISE EXCEPTION 'Artículo modificado' USING ERRCODE='40001'; END IF;
   IF length(v_reason) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Motivo requerido' USING ERRCODE='22023'; END IF;
   IF EXISTS(SELECT 1 FROM electoral.inventory_movements WHERE item_id=v_id) AND (v_item.unit<>v_unit OR v_item.name<>v_name OR v_item.variant<>v_variant) THEN RAISE EXCEPTION 'Identidad del artículo inmutable tras movimientos' USING ERRCODE='22023'; END IF;
   UPDATE electoral.inventory_items SET name=v_name,variant=v_variant,unit=v_unit,category=v_category,active=(p_data->>'active')::boolean,version=version+1,updated_at=now() WHERE id=v_id;
  END IF;
 ELSIF op='location' THEN
  v_kind:=p_data->>'kind'; v_id:=nullif(p_data->>'referenceId','')::uuid; v_name:=trim(p_data->>'name');
  IF v_kind='distrito' THEN
   SELECT name INTO v_name FROM electoral.districts WHERE id=v_id AND canton_id=p_canton AND active;
   IF NOT FOUND THEN RAISE EXCEPTION 'Distrito inválido' USING ERRCODE='22023'; END IF;
  ELSIF v_kind='centro' THEN
   SELECT c.name INTO v_name FROM electoral.center_elections ce JOIN electoral.voting_centers c ON c.id=ce.center_id WHERE ce.id=v_id AND ce.organization_id=p_org AND ce.canton_id=p_canton AND ce.event_id=p_event AND c.archived_at IS NULL AND ce.internal_status<>'inactivo';
   IF NOT FOUND THEN RAISE EXCEPTION 'Centro inválido' USING ERRCODE='22023'; END IF;
  ELSIF v_kind='persona' THEN
   SELECT full_name INTO v_name FROM electoral.people WHERE id=v_id AND organization_id=p_org;
   IF NOT FOUND THEN RAISE EXCEPTION 'Persona inválida' USING ERRCODE='22023'; END IF;
  ELSIF v_kind<>'almacen' OR v_id IS NOT NULL THEN RAISE EXCEPTION 'Ubicación inválida' USING ERRCODE='22023'; END IF;
  INSERT INTO electoral.inventory_locations(organization_id,canton_id,name,kind,district_id,center_id,person_id,event_id,created_by)
  VALUES(p_org,p_canton,v_name,v_kind,CASE WHEN v_kind='distrito' THEN v_id END,CASE WHEN v_kind='centro' THEN v_id END,CASE WHEN v_kind='persona' THEN v_id END,CASE WHEN v_kind='centro' THEN p_event END,p_actor) RETURNING id INTO v_id;
 ELSIF op IN ('movement','need') THEN
  SELECT * INTO v_item FROM electoral.inventory_items WHERE id=(p_data->>'itemId')::uuid AND organization_id=p_org AND canton_id=p_canton FOR UPDATE;
  IF NOT FOUND OR NOT v_item.active THEN RAISE EXCEPTION 'Artículo inactivo o ajeno' USING ERRCODE='22023'; END IF;
  v_qty:=(p_data->>'quantity')::numeric;
  IF v_qty IS NULL OR v_qty='NaN'::numeric OR v_qty<0 OR v_qty>99999999999 OR v_qty<>round(v_qty,3) OR (v_item.unit IN ('pieza','caja','paquete','docena') AND v_qty<>trunc(v_qty)) THEN RAISE EXCEPTION 'Cantidad o unidad inválida' USING ERRCODE='22023'; END IF;
  v_source:=nullif(p_data->>'sourceId','')::uuid; v_destination:=nullif(p_data->>'destinationId','')::uuid;
  IF op='need' THEN v_destination:=(p_data->>'locationId')::uuid; END IF;
  FOR v_location IN SELECT * FROM electoral.inventory_locations WHERE id IN (v_source,v_destination) LOOP
   IF v_location.organization_id<>p_org OR v_location.canton_id<>p_canton OR (v_location.event_id IS NOT NULL AND v_location.event_id<>p_event) THEN RAISE EXCEPTION 'Ubicación ajena' USING ERRCODE='42501'; END IF;
  END LOOP;
  IF op='need' THEN
   IF NOT EXISTS(SELECT 1 FROM electoral.inventory_locations WHERE id=v_destination AND organization_id=p_org AND canton_id=p_canton AND kind<>'almacen') THEN RAISE EXCEPTION 'Destino inválido' USING ERRCODE='22023'; END IF;
   SELECT id,revision INTO v_old,v_revision FROM electoral.inventory_needs WHERE organization_id=p_org AND canton_id=p_canton AND event_id=p_event AND item_id=v_item.id AND location_id=v_destination ORDER BY revision DESC LIMIT 1;
   IF v_old IS DISTINCT FROM nullif(p_data->>'expectedId','')::uuid THEN RAISE EXCEPTION 'Meta modificada' USING ERRCODE='40001'; END IF;
   INSERT INTO electoral.inventory_needs(organization_id,canton_id,event_id,item_id,location_id,required,revision,created_by) VALUES(p_org,p_canton,p_event,v_item.id,v_destination,v_qty,coalesce(v_revision,0)+1,p_actor) RETURNING id INTO v_id;
  ELSE
   v_kind:=p_data->>'kind'; v_date:=(p_data->>'occurredOn')::date; v_person:=(p_data->>'personId')::uuid; v_request:=(p_data->>'requestId')::uuid; v_evidence:=coalesce(p_data->>'evidence',''); v_origin:=coalesce(p_data->>'origin','');
   SELECT * INTO v_move FROM electoral.inventory_movements WHERE organization_id=p_org AND canton_id=p_canton AND request_id=v_request;
   IF FOUND THEN
    IF v_move.event_id=p_event AND v_move.item_id=v_item.id AND v_move.kind=v_kind AND v_move.quantity=v_qty AND v_move.source_id IS NOT DISTINCT FROM v_source AND v_move.destination_id IS NOT DISTINCT FROM v_destination AND v_move.person_id=v_person AND v_move.occurred_on=v_date AND v_move.reason=v_reason AND v_move.evidence=v_evidence AND v_move.origin=v_origin AND v_move.created_by=p_actor THEN RETURN v_move.id; END IF;
    RAISE EXCEPTION 'Solicitud ya utilizada con otros datos' USING ERRCODE='22023';
   END IF;
   IF v_qty<=0 OR v_date IS NULL OR v_date>(now() AT TIME ZONE 'America/Costa_Rica')::date OR NOT EXISTS(SELECT 1 FROM electoral.people WHERE id=v_person AND organization_id=p_org) THEN RAISE EXCEPTION 'Cantidad, fecha o responsable inválido' USING ERRCODE='22023'; END IF;
   IF v_kind='ingreso' AND NOT EXISTS(SELECT 1 FROM electoral.inventory_locations WHERE id=v_destination AND kind='almacen') THEN RAISE EXCEPTION 'Ingreso requiere almacén' USING ERRCODE='22023'; END IF;
   SELECT coalesce(sum(usable),0),coalesce(sum(damaged),0) INTO v_usable,v_damaged FROM electoral.inventory_effects WHERE organization_id=p_org AND canton_id=p_canton AND item_id=v_item.id AND location_id=v_source;
   IF v_kind IN ('transferencia','consumo','dano','perdida','robo') AND v_usable<v_qty THEN RAISE EXCEPTION 'Stock insuficiente' USING ERRCODE='23514'; END IF;
   IF v_kind='baja' AND v_damaged<v_qty THEN RAISE EXCEPTION 'Stock dañado insuficiente' USING ERRCODE='23514'; END IF;
   INSERT INTO electoral.inventory_movements(organization_id,canton_id,event_id,item_id,kind,quantity,source_id,destination_id,person_id,occurred_on,origin,reason,evidence,request_id,created_by)
   VALUES(p_org,p_canton,p_event,v_item.id,v_kind,v_qty,v_source,v_destination,v_person,v_date,v_origin,v_reason,v_evidence,v_request,p_actor) RETURNING id INTO v_id;
  END IF;
 ELSIF op='decision' THEN
  PERFORM electoral.require_global_admin(p_actor,p_org);
  SELECT * INTO v_move FROM electoral.inventory_movements WHERE id=(p_data->>'movementId')::uuid AND organization_id=p_org AND canton_id=p_canton AND event_id=p_event FOR UPDATE;
  IF NOT FOUND OR v_move.kind NOT IN ('perdida','robo','baja') OR v_move.created_by=p_actor THEN RAISE EXCEPTION 'Aprobación inválida; requiere otro administrador' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM electoral.inventory_decisions WHERE movement_id=v_move.id) THEN RAISE EXCEPTION 'Ya resuelto' USING ERRCODE='40001'; END IF;
  IF (p_data->>'approved')::boolean THEN
   SELECT coalesce(sum(usable),0),coalesce(sum(damaged),0) INTO v_usable,v_damaged FROM electoral.inventory_effects WHERE organization_id=p_org AND canton_id=p_canton AND item_id=v_move.item_id AND location_id=v_move.source_id;
   IF (v_move.kind='baja' AND v_damaged<v_move.quantity) OR (v_move.kind<>'baja' AND v_usable<v_move.quantity) THEN RAISE EXCEPTION 'Stock insuficiente al aprobar' USING ERRCODE='23514'; END IF;
  END IF;
  INSERT INTO electoral.inventory_decisions(organization_id,canton_id,movement_id,approved,reason,created_by) VALUES(p_org,p_canton,v_move.id,(p_data->>'approved')::boolean,v_reason,p_actor) RETURNING id INTO v_id;
 ELSE RAISE EXCEPTION 'Operación inválida' USING ERRCODE='22023'; END IF;
 IF op='item' THEN SELECT to_jsonb(i) INTO v_after FROM electoral.inventory_items i WHERE id=v_id; ELSE v_after:=jsonb_build_object('reason',v_reason); END IF;
 INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action,before_json,after_json) VALUES(p_org,p_actor,'inventory',v_id,op,v_before,v_after);
 RETURN v_id;
END $$;
--> statement-breakpoint
CREATE FUNCTION electoral.inventory_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,electoral AS $$ BEGIN RAISE EXCEPTION 'El historial de inventario es inmutable' USING ERRCODE='42501'; END $$;
--> statement-breakpoint
CREATE TRIGGER inventory_movements_immutable BEFORE UPDATE OR DELETE ON electoral.inventory_movements FOR EACH ROW EXECUTE FUNCTION electoral.inventory_immutable();
--> statement-breakpoint
CREATE TRIGGER inventory_decisions_immutable BEFORE UPDATE OR DELETE ON electoral.inventory_decisions FOR EACH ROW EXECUTE FUNCTION electoral.inventory_immutable();
--> statement-breakpoint
CREATE TRIGGER inventory_needs_immutable BEFORE UPDATE OR DELETE ON electoral.inventory_needs FOR EACH ROW EXECUTE FUNCTION electoral.inventory_immutable();
--> statement-breakpoint
CREATE TRIGGER inventory_locations_immutable BEFORE UPDATE OR DELETE ON electoral.inventory_locations FOR EACH ROW EXECUTE FUNCTION electoral.inventory_immutable();
--> statement-breakpoint
ALTER TABLE electoral.inventory_locations ADD CONSTRAINT inventory_location_author FOREIGN KEY(created_by) REFERENCES auth.users(id);
--> statement-breakpoint
ALTER TABLE electoral.inventory_movements ADD CONSTRAINT inventory_movement_author FOREIGN KEY(created_by) REFERENCES auth.users(id);
--> statement-breakpoint
ALTER TABLE electoral.inventory_decisions ADD CONSTRAINT inventory_decision_author FOREIGN KEY(created_by) REFERENCES auth.users(id);
--> statement-breakpoint
ALTER TABLE electoral.inventory_needs ADD CONSTRAINT inventory_need_author FOREIGN KEY(created_by) REFERENCES auth.users(id);
--> statement-breakpoint
REVOKE ALL ON electoral.inventory_items,electoral.inventory_locations,electoral.inventory_movements,electoral.inventory_decisions,electoral.inventory_needs,electoral.inventory_effects FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
GRANT SELECT ON electoral.inventory_items,electoral.inventory_locations,electoral.inventory_movements,electoral.inventory_decisions,electoral.inventory_needs,electoral.inventory_effects TO electoral_app;
--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.inventory_allowed(uuid,uuid,uuid),electoral.inventory_command(uuid,uuid,uuid,uuid,jsonb),electoral.inventory_immutable() FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.inventory_allowed(uuid,uuid,uuid),electoral.inventory_command(uuid,uuid,uuid,uuid,jsonb) TO electoral_app;

--> statement-breakpoint
CREATE FUNCTION electoral.inventory_export_audit(p_actor uuid,p_org uuid,p_canton uuid,p_count integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$ BEGIN
 PERFORM electoral.require_global_admin(p_actor,p_org);
 IF NOT electoral.inventory_allowed(p_actor,p_org,p_canton) OR p_count NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'Sin permiso' USING ERRCODE='42501'; END IF;
 INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,action,after_json) VALUES(p_org,p_actor,'inventory','export',jsonb_build_object('count',p_count));
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.inventory_export_audit(uuid,uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.inventory_export_audit(uuid,uuid,uuid,integer) TO electoral_app;
