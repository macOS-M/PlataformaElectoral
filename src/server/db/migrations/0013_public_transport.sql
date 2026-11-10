CREATE TABLE "electoral"."transport_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"canton_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"token" uuid NOT NULL,
	"receipt" uuid DEFAULT gen_random_uuid() NOT NULL,
	"payload_hash" text NOT NULL,
	"kind" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"contact_channel" text DEFAULT '' NOT NULL,
	"contact" text DEFAULT '' NOT NULL,
	"district_id" uuid NOT NULL,
	"center_id" uuid,
	"desired_time" text DEFAULT '' NOT NULL,
	"vehicle_details" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pendiente' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"linked_person_id" uuid,
	"linked_vehicle_id" uuid,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transport_requests_token_unique" UNIQUE("token"),
	CONSTRAINT "transport_requests_receipt_unique" UNIQUE("receipt"),
	CONSTRAINT "transport_request_kind" CHECK ("electoral"."transport_requests"."kind" in ('driver','passenger') and ("electoral"."transport_requests"."kind"<>'driver' or (length(trim("electoral"."transport_requests"."name")) between 2 and 160 and "electoral"."transport_requests"."contact"<>''))),
	CONSTRAINT "transport_request_text" CHECK (length("electoral"."transport_requests"."name")<=160 and length("electoral"."transport_requests"."contact")<=254 and length("electoral"."transport_requests"."vehicle_details")<=160 and length("electoral"."transport_requests"."review_reason")<=500 and "electoral"."transport_requests"."payload_hash" ~ '^[a-f0-9]{64}$' and "electoral"."transport_requests"."version">0 and ("electoral"."transport_requests"."desired_time"='' or "electoral"."transport_requests"."desired_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')),
	CONSTRAINT "transport_request_contact" CHECK (("electoral"."transport_requests"."contact"='' and "electoral"."transport_requests"."contact_channel"='') or ("electoral"."transport_requests"."contact_channel"='telefono' and "electoral"."transport_requests"."contact" ~ '^[+()0-9 .-]{6,40}$') or ("electoral"."transport_requests"."contact_channel"='correo' and "electoral"."transport_requests"."contact" ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')),
	CONSTRAINT "transport_request_status" CHECK ("electoral"."transport_requests"."status"='pendiente' or ("electoral"."transport_requests"."kind"='driver' and "electoral"."transport_requests"."status" in ('aprobada','rechazada')) or ("electoral"."transport_requests"."kind"='passenger' and "electoral"."transport_requests"."status"='atendida'))
);
--> statement-breakpoint
ALTER TABLE "electoral"."transport_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "electoral"."transport_submission_buckets" (
	"key" text NOT NULL,
	"slot" integer NOT NULL,
	"attempts" integer NOT NULL,
	CONSTRAINT "transport_submission_buckets_key_slot_pk" PRIMARY KEY("key","slot"),
	CONSTRAINT "transport_bucket_valid" CHECK ("electoral"."transport_submission_buckets"."attempts">0 and length("electoral"."transport_submission_buckets"."key")<=100)
);
--> statement-breakpoint
ALTER TABLE "electoral"."transport_submission_buckets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "electoral"."transport_service_trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"canton_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"district_id" uuid NOT NULL,
	"center_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"title" text NOT NULL,
	"meeting_point" text NOT NULL,
	"institutional_contact" text DEFAULT '' NOT NULL,
	"confirmed" boolean DEFAULT false NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"canceled_at" timestamp with time zone,
	"canceled_by" uuid,
	"cancel_reason" text DEFAULT '' NOT NULL,
	CONSTRAINT "transport_trip_valid" CHECK ("electoral"."transport_service_trips"."ends_at">"electoral"."transport_service_trips"."starts_at" and length(trim("electoral"."transport_service_trips"."title")) between 2 and 160 and length(trim("electoral"."transport_service_trips"."meeting_point")) between 2 and 300 and length("electoral"."transport_service_trips"."institutional_contact")<=254 and length("electoral"."transport_service_trips"."cancel_reason")<=500 and "electoral"."transport_service_trips"."version">0 and (not "electoral"."transport_service_trips"."published" or ("electoral"."transport_service_trips"."confirmed" and "electoral"."transport_service_trips"."canceled_at" is null and length(trim("electoral"."transport_service_trips"."institutional_contact"))>=3)))
);
--> statement-breakpoint
ALTER TABLE "electoral"."transport_service_trips" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "electoral"."transport_vehicle_status" (
	"vehicle_id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"canton_id" uuid NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"operational_status" text DEFAULT 'sin_verificar' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transport_operational_status" CHECK ("electoral"."transport_vehicle_status"."operational_status" in ('sin_verificar','operativo','mantenimiento','fuera_servicio') and "electoral"."transport_vehicle_status"."version">0)
);
--> statement-breakpoint
ALTER TABLE "electoral"."transport_vehicle_status" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "electoral"."transport_availability_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"canton_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"district_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"canceled_at" timestamp with time zone,
	"canceled_by" uuid,
	"cancel_reason" text DEFAULT '' NOT NULL,
	CONSTRAINT "transport_window_dates" CHECK ("electoral"."transport_availability_windows"."ends_at">"electoral"."transport_availability_windows"."starts_at" and length("electoral"."transport_availability_windows"."cancel_reason")<=500)
);
--> statement-breakpoint
ALTER TABLE "electoral"."transport_availability_windows" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "electoral"."transport_requests" ADD CONSTRAINT "transport_requests_organization_id_canton_id_organization_cantons_organization_id_canton_id_fk" FOREIGN KEY ("organization_id","canton_id") REFERENCES "electoral"."organization_cantons"("organization_id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."transport_requests" ADD CONSTRAINT "transport_requests_event_id_organization_id_election_events_id_organization_id_fk" FOREIGN KEY ("event_id","organization_id") REFERENCES "electoral"."election_events"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."transport_requests" ADD CONSTRAINT "transport_requests_district_id_canton_id_districts_id_canton_id_fk" FOREIGN KEY ("district_id","canton_id") REFERENCES "electoral"."districts"("id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."transport_requests" ADD CONSTRAINT "transport_requests_center_id_organization_id_event_id_center_elections_id_organization_id_event_id_fk" FOREIGN KEY ("center_id","organization_id","event_id") REFERENCES "electoral"."center_elections"("id","organization_id","event_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."transport_requests" ADD CONSTRAINT "transport_requests_linked_person_id_organization_id_people_id_organization_id_fk" FOREIGN KEY ("linked_person_id","organization_id") REFERENCES "electoral"."people"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."transport_requests" ADD CONSTRAINT "transport_requests_linked_vehicle_id_organization_id_canton_id_vehicles_id_organization_id_canton_id_fk" FOREIGN KEY ("linked_vehicle_id","organization_id","canton_id") REFERENCES "electoral"."vehicles"("id","organization_id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."transport_service_trips" ADD CONSTRAINT "transport_service_trips_vehicle_id_organization_id_canton_id_vehicles_id_organization_id_canton_id_fk" FOREIGN KEY ("vehicle_id","organization_id","canton_id") REFERENCES "electoral"."vehicles"("id","organization_id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."transport_service_trips" ADD CONSTRAINT "transport_service_trips_event_id_organization_id_election_events_id_organization_id_fk" FOREIGN KEY ("event_id","organization_id") REFERENCES "electoral"."election_events"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."transport_service_trips" ADD CONSTRAINT "transport_service_trips_district_id_canton_id_districts_id_canton_id_fk" FOREIGN KEY ("district_id","canton_id") REFERENCES "electoral"."districts"("id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."transport_service_trips" ADD CONSTRAINT "transport_service_trips_center_id_organization_id_event_id_center_elections_id_organization_id_event_id_fk" FOREIGN KEY ("center_id","organization_id","event_id") REFERENCES "electoral"."center_elections"("id","organization_id","event_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."transport_vehicle_status" ADD CONSTRAINT "transport_vehicle_status_vehicle_id_organization_id_canton_id_vehicles_id_organization_id_canton_id_fk" FOREIGN KEY ("vehicle_id","organization_id","canton_id") REFERENCES "electoral"."vehicles"("id","organization_id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."transport_availability_windows" ADD CONSTRAINT "transport_availability_windows_vehicle_id_organization_id_canton_id_vehicles_id_organization_id_canton_id_fk" FOREIGN KEY ("vehicle_id","organization_id","canton_id") REFERENCES "electoral"."vehicles"("id","organization_id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."transport_availability_windows" ADD CONSTRAINT "transport_availability_windows_event_id_organization_id_election_events_id_organization_id_fk" FOREIGN KEY ("event_id","organization_id") REFERENCES "electoral"."election_events"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."transport_availability_windows" ADD CONSTRAINT "transport_availability_windows_district_id_canton_id_districts_id_canton_id_fk" FOREIGN KEY ("district_id","canton_id") REFERENCES "electoral"."districts"("id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transport_request_queue" ON "electoral"."transport_requests" USING btree ("organization_id","canton_id","event_id","created_at");--> statement-breakpoint
CREATE INDEX "transport_trip_vehicle" ON "electoral"."transport_service_trips" USING btree ("vehicle_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "transport_window_vehicle" ON "electoral"."transport_availability_windows" USING btree ("vehicle_id","event_id","starts_at");--> statement-breakpoint
CREATE POLICY "transport_trips_server_read" ON "electoral"."transport_service_trips" AS PERMISSIVE FOR SELECT TO "electoral_app" USING (true);--> statement-breakpoint
CREATE POLICY "transport_status_server_read" ON "electoral"."transport_vehicle_status" AS PERMISSIVE FOR SELECT TO "electoral_app" USING (true);--> statement-breakpoint
CREATE POLICY "transport_windows_server_read" ON "electoral"."transport_availability_windows" AS PERMISSIVE FOR SELECT TO "electoral_app" USING (true);
--> statement-breakpoint
REVOKE ALL ON electoral.transport_requests,electoral.transport_submission_buckets,electoral.transport_service_trips,electoral.transport_vehicle_status,electoral.transport_availability_windows FROM PUBLIC,anon,authenticated,electoral_app;
--> statement-breakpoint
GRANT SELECT ON electoral.transport_service_trips,electoral.transport_vehicle_status,electoral.transport_availability_windows TO electoral_app;
--> statement-breakpoint
ALTER TABLE electoral.transport_requests ADD CONSTRAINT transport_request_reviewer_fk FOREIGN KEY(reviewed_by) REFERENCES auth.users(id);
--> statement-breakpoint
CREATE FUNCTION electoral.transport_scope_active(p_org uuid,p_canton uuid,p_event uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
 SELECT EXISTS(SELECT 1 FROM electoral.organizations o JOIN electoral.organization_cantons c ON c.organization_id=o.id JOIN electoral.election_events e ON e.organization_id=o.id WHERE o.id=p_org AND o.active AND c.canton_id=p_canton AND c.active AND e.id=p_event)
$$;
--> statement-breakpoint
CREATE FUNCTION electoral.submit_transport_request(p_org uuid,p_canton uuid,p_event uuid,p_token uuid,p_bucket text,p_hash text,p_data jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
DECLARE v_old electoral.transport_requests; v_district uuid; v_center uuid; v_actual uuid; v_id uuid; v_receipt uuid; v_slot integer:=floor(extract(epoch from now())/900)::integer; v_attempt integer; v_key text;
BEGIN
 IF NOT electoral.transport_scope_active(p_org,p_canton,p_event) THEN RAISE EXCEPTION 'Ámbito inválido' USING ERRCODE='42501'; END IF;
 IF p_token IS NULL OR p_bucket IS NULL OR p_bucket !~ '^[a-f0-9]{64}$' OR p_hash IS NULL OR p_hash !~ '^[a-f0-9]{64}$' OR p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR pg_column_size(p_data)>8192 OR p_data-ARRAY['kind','name','contactChannel','contact','districtId','centerId','desiredTime','vehicleDetails']<>'{}'::jsonb THEN RAISE EXCEPTION 'Entrada inválida' USING ERRCODE='22023'; END IF;
 IF p_data->>'contactChannel'='telefono' AND length(regexp_replace(coalesce(p_data->>'contact',''),'[^0-9]','','g')) NOT BETWEEN 6 AND 20 THEN RAISE EXCEPTION 'Contacto inválido' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(p_token::text));
 SELECT * INTO v_old FROM electoral.transport_requests WHERE token=p_token;
 IF FOUND THEN
  IF v_old.organization_id<>p_org OR v_old.canton_id<>p_canton OR v_old.event_id<>p_event OR v_old.payload_hash<>p_hash THEN RAISE EXCEPTION 'Reenvío incompatible' USING ERRCODE='22023'; END IF;
  RETURN v_old.receipt;
 END IF;
 v_district:=nullif(p_data->>'districtId','')::uuid; v_center:=nullif(p_data->>'centerId','')::uuid;
 IF v_center IS NOT NULL THEN
  SELECT ce.district_id INTO v_actual FROM electoral.center_elections ce JOIN electoral.voting_centers vc ON vc.id=ce.center_id WHERE ce.id=v_center AND ce.organization_id=p_org AND ce.canton_id=p_canton AND ce.event_id=p_event AND ce.internal_status<>'inactivo' AND vc.archived_at IS NULL;
  IF NOT FOUND OR (v_district IS NOT NULL AND v_district<>v_actual) THEN RAISE EXCEPTION 'Centro incompatible' USING ERRCODE='22023'; END IF;
  v_district:=v_actual;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM electoral.districts WHERE id=v_district AND canton_id=p_canton AND active) THEN RAISE EXCEPTION 'Distrito inválido' USING ERRCODE='22023'; END IF;
 DELETE FROM electoral.transport_submission_buckets WHERE slot<v_slot-4;
 FOREACH v_key IN ARRAY ARRAY['global:'||p_org::text||':'||p_event::text,'client:'||p_bucket] LOOP
  INSERT INTO electoral.transport_submission_buckets AS b(key,slot,attempts) VALUES(v_key,v_slot,1) ON CONFLICT(key,slot) DO UPDATE SET attempts=b.attempts+1 RETURNING attempts INTO v_attempt;
  IF v_attempt>(CASE WHEN v_key LIKE 'global:%' THEN 100 ELSE 5 END) THEN RAISE EXCEPTION 'Límite de envíos' USING ERRCODE='54000'; END IF;
 END LOOP;
 INSERT INTO electoral.transport_requests(organization_id,canton_id,event_id,token,payload_hash,kind,name,contact_channel,contact,district_id,center_id,desired_time,vehicle_details)
 VALUES(p_org,p_canton,p_event,p_token,p_hash,p_data->>'kind',trim(coalesce(p_data->>'name','')),coalesce(p_data->>'contactChannel',''),trim(coalesce(p_data->>'contact','')),v_district,v_center,coalesce(p_data->>'desiredTime',''),trim(coalesce(p_data->>'vehicleDetails',''))) RETURNING id,receipt INTO v_id,v_receipt;
 INSERT INTO electoral.audit_logs(organization_id,entity,entity_id,action) VALUES(p_org,'transport_requests',v_id,'receive');
 RETURN v_receipt;
END $$;
--> statement-breakpoint
CREATE FUNCTION electoral.read_transport_requests(p_actor uuid,p_org uuid,p_canton uuid,p_event uuid,p_page integer) RETURNS TABLE(id uuid,kind text,name text,contact_channel text,contact text,district_id uuid,center_id uuid,desired_time text,vehicle_details text,status text,version integer,linked_person_id uuid,linked_vehicle_id uuid,review_reason text,created_at text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
BEGIN
 PERFORM electoral.require_global_admin(p_actor,p_org);
 IF NOT electoral.transport_scope_active(p_org,p_canton,p_event) OR p_page IS NULL OR p_page NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'Ámbito inválido' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT r.id,r.kind,r.name,r.contact_channel,r.contact,r.district_id,r.center_id,r.desired_time,r.vehicle_details,r.status,r.version,r.linked_person_id,r.linked_vehicle_id,r.review_reason,r.created_at::text FROM electoral.transport_requests r WHERE r.organization_id=p_org AND r.canton_id=p_canton AND r.event_id=p_event ORDER BY (r.status='pendiente') DESC,r.created_at DESC,r.id LIMIT 51 OFFSET (p_page-1)*50;
END $$;
--> statement-breakpoint
CREATE FUNCTION electoral.review_transport_request(p_actor uuid,p_org uuid,p_canton uuid,p_event uuid,p_id uuid,p_expected integer,p_status text,p_person uuid,p_vehicle uuid,p_plate text,p_description text,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
DECLARE v_old electoral.transport_requests; v_person uuid; v_vehicle uuid;
BEGIN
 PERFORM electoral.require_global_admin(p_actor,p_org);
 IF NOT electoral.transport_scope_active(p_org,p_canton,p_event) THEN RAISE EXCEPTION 'Ámbito inválido' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_old FROM electoral.transport_requests WHERE id=p_id AND organization_id=p_org AND canton_id=p_canton AND event_id=p_event FOR UPDATE;
 IF NOT FOUND OR v_old.status<>'pendiente' OR v_old.version IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Solicitud modificada' USING ERRCODE='40001'; END IF;
 IF p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 3 AND 500 OR NOT ((v_old.kind='driver' AND p_status IN ('aprobada','rechazada')) OR (v_old.kind='passenger' AND p_status='atendida')) THEN RAISE EXCEPTION 'Decisión inválida' USING ERRCODE='22023'; END IF;
 IF p_status='aprobada' THEN
  IF p_person IS NULL THEN
   INSERT INTO electoral.people(organization_id,full_name,phone,email) VALUES(p_org,v_old.name,CASE WHEN v_old.contact_channel='telefono' THEN v_old.contact ELSE NULL END,CASE WHEN v_old.contact_channel='correo' THEN v_old.contact ELSE NULL END) RETURNING id INTO v_person;
  ELSE
   SELECT id INTO v_person FROM electoral.people WHERE id=p_person AND organization_id=p_org;
   IF NOT FOUND THEN RAISE EXCEPTION 'Persona ajena' USING ERRCODE='42501'; END IF;
  END IF;
  IF p_vehicle IS NOT NULL THEN
   SELECT id INTO v_vehicle FROM electoral.vehicles WHERE id=p_vehicle AND organization_id=p_org AND canton_id=p_canton;
   IF NOT FOUND OR coalesce(p_plate,'')<>'' THEN RAISE EXCEPTION 'Vehículo incompatible' USING ERRCODE='22023'; END IF;
  ELSIF coalesce(p_plate,'')<>'' THEN
   IF upper(trim(p_plate)) !~ '^[A-Z0-9-]{2,20}$' OR p_description IS NULL OR length(trim(p_description)) NOT BETWEEN 2 AND 160 THEN RAISE EXCEPTION 'Vehículo inválido' USING ERRCODE='22023'; END IF;
   INSERT INTO electoral.vehicles(organization_id,canton_id,plate,description,responsible_id) VALUES(p_org,p_canton,upper(trim(p_plate)),trim(p_description),v_person) RETURNING id INTO v_vehicle;
   INSERT INTO electoral.vehicle_district_assignments(vehicle_id,organization_id,canton_id,event_id,district_id) VALUES(v_vehicle,p_org,p_canton,p_event,v_old.district_id);
   INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action) VALUES(p_org,p_actor,'vehicles',v_vehicle,'create_from_review');
  END IF;
 END IF;
 UPDATE electoral.transport_requests SET status=p_status,version=version+1,linked_person_id=v_person,linked_vehicle_id=v_vehicle,reviewed_by=p_actor,reviewed_at=now(),review_reason=trim(p_reason) WHERE id=p_id;
 INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action,after_json) VALUES(p_org,p_actor,'transport_requests',p_id,'review',jsonb_build_object('status',p_status,'personId',v_person,'vehicleId',v_vehicle));
END $$;
--> statement-breakpoint
CREATE FUNCTION electoral.set_transport_vehicle_status(p_actor uuid,p_org uuid,p_canton uuid,p_vehicle uuid,p_expected integer,p_approved boolean,p_status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
DECLARE v_old electoral.transport_vehicle_status;
BEGIN
 PERFORM electoral.require_global_admin(p_actor,p_org);
 IF NOT electoral.can_edit_module(p_actor,p_org,p_canton,'A05') OR p_approved IS NULL OR p_status IS NULL OR p_status NOT IN ('sin_verificar','operativo','mantenimiento','fuera_servicio') THEN RAISE EXCEPTION 'Datos o ámbito inválidos' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM electoral.vehicles WHERE id=p_vehicle AND organization_id=p_org AND canton_id=p_canton FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Vehículo ajeno' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_old FROM electoral.transport_vehicle_status WHERE vehicle_id=p_vehicle;
 IF coalesce(v_old.version,0) IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Estado modificado' USING ERRCODE='40001'; END IF;
 INSERT INTO electoral.transport_vehicle_status(vehicle_id,organization_id,canton_id,approved,operational_status,updated_by) VALUES(p_vehicle,p_org,p_canton,p_approved,p_status,p_actor)
 ON CONFLICT(vehicle_id) DO UPDATE SET approved=p_approved,operational_status=p_status,version=electoral.transport_vehicle_status.version+1,updated_by=p_actor,updated_at=now();
 INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action,after_json) VALUES(p_org,p_actor,'transport_vehicle_status',p_vehicle,'configure',jsonb_build_object('approved',p_approved,'status',p_status));
END $$;
--> statement-breakpoint
CREATE FUNCTION electoral.add_transport_window(p_actor uuid,p_org uuid,p_canton uuid,p_event uuid,p_vehicle uuid,p_district uuid,p_start timestamptz,p_end timestamptz) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT electoral.can_edit_module(p_actor,p_org,p_canton,'A05') OR NOT electoral.transport_scope_active(p_org,p_canton,p_event) THEN RAISE EXCEPTION 'Sin permiso' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM electoral.vehicles WHERE id=p_vehicle AND organization_id=p_org AND canton_id=p_canton AND active FOR UPDATE;
 IF NOT FOUND OR p_start IS NULL OR p_end IS NULL OR p_end<=p_start OR NOT EXISTS(SELECT 1 FROM electoral.districts WHERE id=p_district AND canton_id=p_canton AND active) OR NOT EXISTS(SELECT 1 FROM electoral.vehicle_district_assignments WHERE vehicle_id=p_vehicle AND event_id=p_event AND district_id=p_district AND ended_at IS NULL) THEN RAISE EXCEPTION 'Ventana inválida' USING ERRCODE='22023'; END IF;
 INSERT INTO electoral.transport_availability_windows(vehicle_id,organization_id,canton_id,event_id,district_id,starts_at,ends_at,created_by) VALUES(p_vehicle,p_org,p_canton,p_event,p_district,p_start,p_end,p_actor) RETURNING id INTO v_id;
 INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action) VALUES(p_org,p_actor,'transport_availability_windows',v_id,'create');
 RETURN v_id;
END $$;
--> statement-breakpoint
CREATE FUNCTION electoral.transport_trip_eligible(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
 SELECT EXISTS(SELECT 1 FROM electoral.transport_service_trips t JOIN electoral.vehicles v ON v.id=t.vehicle_id JOIN electoral.transport_vehicle_status s ON s.vehicle_id=v.id
 WHERE t.id=p_id AND t.canceled_at IS NULL AND v.active AND s.approved AND s.operational_status='operativo' AND electoral.transport_scope_active(t.organization_id,t.canton_id,t.event_id)
 AND EXISTS(SELECT 1 FROM electoral.districts d WHERE d.id=t.district_id AND d.canton_id=t.canton_id AND d.active)
 AND EXISTS(SELECT 1 FROM electoral.vehicle_district_assignments a WHERE a.vehicle_id=t.vehicle_id AND a.event_id=t.event_id AND a.district_id=t.district_id AND a.ended_at IS NULL)
 AND EXISTS(SELECT 1 FROM electoral.transport_availability_windows w WHERE w.vehicle_id=t.vehicle_id AND w.event_id=t.event_id AND w.district_id=t.district_id AND w.canceled_at IS NULL AND w.starts_at<=t.starts_at AND w.ends_at>=t.ends_at)
 AND (t.center_id IS NULL OR EXISTS(SELECT 1 FROM electoral.center_elections ce JOIN electoral.voting_centers vc ON vc.id=ce.center_id JOIN electoral.vehicle_center_assignments a ON a.center_election_id=ce.id WHERE ce.id=t.center_id AND ce.organization_id=t.organization_id AND ce.event_id=t.event_id AND ce.canton_id=t.canton_id AND ce.district_id=t.district_id AND ce.internal_status<>'inactivo' AND vc.archived_at IS NULL AND a.vehicle_id=t.vehicle_id AND a.event_id=t.event_id AND a.ended_at IS NULL)))
$$;
--> statement-breakpoint
CREATE FUNCTION electoral.add_transport_trip(p_actor uuid,p_org uuid,p_canton uuid,p_event uuid,p_vehicle uuid,p_district uuid,p_center uuid,p_start timestamptz,p_end timestamptz,p_title text,p_meeting text,p_contact text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT electoral.can_edit_module(p_actor,p_org,p_canton,'A05') OR NOT electoral.transport_scope_active(p_org,p_canton,p_event) THEN RAISE EXCEPTION 'Sin permiso' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM electoral.vehicles WHERE id=p_vehicle AND organization_id=p_org AND canton_id=p_canton FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Vehículo ajeno' USING ERRCODE='42501'; END IF;
 IF p_start IS NULL OR p_end IS NULL OR p_end<=p_start OR p_title IS NULL OR p_meeting IS NULL OR p_contact IS NULL THEN RAISE EXCEPTION 'Servicio inválido' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM electoral.transport_service_trips WHERE vehicle_id=p_vehicle AND canceled_at IS NULL AND starts_at<p_end AND ends_at>p_start) THEN RAISE EXCEPTION 'El vehículo tiene un servicio en ese intervalo' USING ERRCODE='23P01'; END IF;
 INSERT INTO electoral.transport_service_trips(vehicle_id,organization_id,canton_id,event_id,district_id,center_id,starts_at,ends_at,title,meeting_point,institutional_contact,created_by) VALUES(p_vehicle,p_org,p_canton,p_event,p_district,p_center,p_start,p_end,trim(p_title),trim(p_meeting),trim(p_contact),p_actor) RETURNING id INTO v_id;
 IF NOT electoral.transport_trip_eligible(v_id) THEN RAISE EXCEPTION 'Vehículo no aprobado, fuera de servicio o sin disponibilidad/vínculo compatible' USING ERRCODE='22023'; END IF;
 INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action) VALUES(p_org,p_actor,'transport_service_trips',v_id,'assign');
 RETURN v_id;
END $$;
--> statement-breakpoint
CREATE FUNCTION electoral.change_transport_trip(p_actor uuid,p_org uuid,p_canton uuid,p_event uuid,p_id uuid,p_expected integer,p_action text,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
DECLARE v_old electoral.transport_service_trips;
BEGIN
 IF NOT electoral.can_edit_module(p_actor,p_org,p_canton,'A05') OR NOT electoral.transport_scope_active(p_org,p_canton,p_event) THEN RAISE EXCEPTION 'Sin permiso' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_old FROM electoral.transport_service_trips WHERE id=p_id AND organization_id=p_org AND canton_id=p_canton AND event_id=p_event;
 IF NOT FOUND THEN RAISE EXCEPTION 'Servicio ajeno' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM electoral.vehicles WHERE id=v_old.vehicle_id FOR UPDATE;
 SELECT * INTO v_old FROM electoral.transport_service_trips WHERE id=p_id FOR UPDATE;
 IF v_old.version IS DISTINCT FROM p_expected OR v_old.canceled_at IS NOT NULL THEN RAISE EXCEPTION 'Servicio modificado' USING ERRCODE='40001'; END IF;
 IF p_action='cancel' THEN
  IF p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Indique motivo' USING ERRCODE='22023'; END IF;
  UPDATE electoral.transport_service_trips SET canceled_at=now(),canceled_by=p_actor,cancel_reason=trim(p_reason),published=false,version=version+1 WHERE id=p_id;
 ELSIF p_action IN ('publish','unpublish') THEN
  PERFORM electoral.require_global_admin(p_actor,p_org);
  IF p_action='publish' AND (NOT electoral.transport_trip_eligible(p_id) OR v_old.ends_at<=now() OR length(trim(v_old.institutional_contact))<3) THEN RAISE EXCEPTION 'Servicio no publicable' USING ERRCODE='22023'; END IF;
  UPDATE electoral.transport_service_trips SET confirmed=CASE WHEN p_action='publish' THEN true ELSE confirmed END,published=(p_action='publish'),version=version+1 WHERE id=p_id;
 ELSE RAISE EXCEPTION 'Operación inválida' USING ERRCODE='22023';
 END IF;
 INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action) VALUES(p_org,p_actor,'transport_service_trips',p_id,p_action);
END $$;
--> statement-breakpoint
CREATE FUNCTION electoral.cancel_transport_window(p_actor uuid,p_org uuid,p_canton uuid,p_event uuid,p_id uuid,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
DECLARE v_old electoral.transport_availability_windows;
BEGIN
 IF NOT electoral.can_edit_module(p_actor,p_org,p_canton,'A05') OR NOT electoral.transport_scope_active(p_org,p_canton,p_event) THEN RAISE EXCEPTION 'Sin permiso' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_old FROM electoral.transport_availability_windows WHERE id=p_id AND organization_id=p_org AND canton_id=p_canton AND event_id=p_event;
 IF NOT FOUND OR p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Ventana inválida' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM electoral.vehicles WHERE id=v_old.vehicle_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM electoral.transport_availability_windows WHERE id=p_id AND canceled_at IS NOT NULL) THEN RAISE EXCEPTION 'Ventana cancelada' USING ERRCODE='40001'; END IF;
 UPDATE electoral.transport_availability_windows SET canceled_at=now(),canceled_by=p_actor,cancel_reason=trim(p_reason) WHERE id=p_id;
 INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action) VALUES(p_org,p_actor,'transport_availability_windows',p_id,'cancel');
END $$;
--> statement-breakpoint
CREATE FUNCTION electoral.public_transport_services(p_org uuid,p_canton uuid,p_event uuid,p_district uuid,p_center uuid) RETURNS TABLE(id uuid,title text,meeting_point text,institutional_contact text,starts_at text,ends_at text,district_id uuid,center_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
 SELECT t.id,t.title,t.meeting_point,t.institutional_contact,t.starts_at::text,t.ends_at::text,t.district_id,t.center_id FROM electoral.transport_service_trips t
 WHERE t.organization_id=p_org AND t.canton_id=p_canton AND t.event_id=p_event AND t.published AND t.confirmed AND t.ends_at>now() AND electoral.transport_trip_eligible(t.id)
 AND (p_district IS NULL OR t.district_id=p_district) AND (p_center IS NULL OR t.center_id=p_center OR (t.center_id IS NULL AND EXISTS(SELECT 1 FROM electoral.center_elections ce WHERE ce.id=p_center AND ce.district_id=t.district_id AND ce.organization_id=p_org AND ce.canton_id=p_canton AND ce.event_id=p_event)))
 ORDER BY t.starts_at,t.id LIMIT 100
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.transport_scope_active(uuid,uuid,uuid),electoral.transport_trip_eligible(uuid) FROM PUBLIC,anon,authenticated,electoral_app;
--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.submit_transport_request(uuid,uuid,uuid,uuid,text,text,jsonb),electoral.read_transport_requests(uuid,uuid,uuid,uuid,integer),electoral.review_transport_request(uuid,uuid,uuid,uuid,uuid,integer,text,uuid,uuid,text,text,text),electoral.set_transport_vehicle_status(uuid,uuid,uuid,uuid,integer,boolean,text),electoral.add_transport_window(uuid,uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz),electoral.add_transport_trip(uuid,uuid,uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,text,text),electoral.change_transport_trip(uuid,uuid,uuid,uuid,uuid,integer,text,text),electoral.cancel_transport_window(uuid,uuid,uuid,uuid,uuid,text),electoral.public_transport_services(uuid,uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.submit_transport_request(uuid,uuid,uuid,uuid,text,text,jsonb),electoral.read_transport_requests(uuid,uuid,uuid,uuid,integer),electoral.review_transport_request(uuid,uuid,uuid,uuid,uuid,integer,text,uuid,uuid,text,text,text),electoral.set_transport_vehicle_status(uuid,uuid,uuid,uuid,integer,boolean,text),electoral.add_transport_window(uuid,uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz),electoral.add_transport_trip(uuid,uuid,uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,text,text),electoral.change_transport_trip(uuid,uuid,uuid,uuid,uuid,integer,text,text),electoral.cancel_transport_window(uuid,uuid,uuid,uuid,uuid,text),electoral.public_transport_services(uuid,uuid,uuid,uuid,uuid),electoral.transport_trip_eligible(uuid) TO electoral_app;
--> statement-breakpoint
CREATE FUNCTION electoral.check_transport_availability(p_actor uuid,p_org uuid,p_canton uuid,p_event uuid,p_district uuid,p_center uuid,p_start timestamptz,p_end timestamptz)
RETURNS TABLE(vehicle_id uuid,available boolean,vehicle_active boolean,approved boolean,operational_status text,has_window boolean,has_binding boolean,conflict_count integer,conflicts text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
BEGIN
 IF NOT electoral.transport_scope_active(p_org,p_canton,p_event) OR NOT EXISTS(SELECT 1 FROM electoral.organization_memberships m WHERE m.organization_id=p_org AND m.user_id=p_actor AND m.active) THEN RAISE EXCEPTION 'Sin permiso' USING ERRCODE='42501'; END IF;
 IF p_start IS NULL OR p_end IS NULL OR p_end<=p_start OR NOT EXISTS(SELECT 1 FROM electoral.districts d WHERE d.id=p_district AND d.canton_id=p_canton AND d.active) OR (p_center IS NOT NULL AND NOT EXISTS(SELECT 1 FROM electoral.center_elections ce JOIN electoral.voting_centers vc ON vc.id=ce.center_id WHERE ce.id=p_center AND ce.organization_id=p_org AND ce.canton_id=p_canton AND ce.event_id=p_event AND ce.district_id=p_district AND ce.internal_status<>'inactivo' AND vc.archived_at IS NULL)) THEN RAISE EXCEPTION 'Consulta inválida' USING ERRCODE='22023'; END IF;
 RETURN QUERY WITH q AS(
  SELECT v.id,v.active,coalesce(s.approved,false) AS ok,coalesce(s.operational_status,'sin_verificar') AS state,
  EXISTS(SELECT 1 FROM electoral.transport_availability_windows w WHERE w.vehicle_id=v.id AND w.event_id=p_event AND w.district_id=p_district AND w.canceled_at IS NULL AND w.starts_at<=p_start AND w.ends_at>=p_end) AS has_w,
  (EXISTS(SELECT 1 FROM electoral.vehicle_district_assignments a WHERE a.vehicle_id=v.id AND a.event_id=p_event AND a.district_id=p_district AND a.ended_at IS NULL) AND (p_center IS NULL OR EXISTS(SELECT 1 FROM electoral.vehicle_center_assignments a WHERE a.vehicle_id=v.id AND a.event_id=p_event AND a.center_election_id=p_center AND a.ended_at IS NULL))) AS has_b,
  (SELECT count(*)::integer FROM electoral.transport_service_trips t WHERE t.vehicle_id=v.id AND t.canceled_at IS NULL AND t.starts_at<p_end AND t.ends_at>p_start) AS conflict_n,
  coalesce((SELECT string_agg((CASE WHEN t.event_id=p_event THEN t.title ELSE 'Servicio de otro evento' END)||' · '||to_char(t.starts_at AT TIME ZONE 'America/Costa_Rica','YYYY-MM-DD HH24:MI')||' → '||to_char(t.ends_at AT TIME ZONE 'America/Costa_Rica','YYYY-MM-DD HH24:MI')||' (Costa Rica)',E'\n' ORDER BY t.starts_at) FROM electoral.transport_service_trips t WHERE t.vehicle_id=v.id AND t.canceled_at IS NULL AND t.starts_at<p_end AND t.ends_at>p_start),'') AS conflict_text
  FROM electoral.vehicles v LEFT JOIN electoral.transport_vehicle_status s ON s.vehicle_id=v.id WHERE v.organization_id=p_org AND v.canton_id=p_canton
 ) SELECT q.id,q.active AND q.ok AND q.state='operativo' AND q.has_w AND q.has_b AND q.conflict_n=0,q.active,q.ok,q.state,q.has_w,q.has_b,q.conflict_n,q.conflict_text FROM q ORDER BY q.id;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.check_transport_availability(uuid,uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.check_transport_availability(uuid,uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz) TO electoral_app;
