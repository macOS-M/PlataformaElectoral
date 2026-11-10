CREATE TABLE "electoral"."provinces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"official_code" text,
	"source_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provinces_name_unique" UNIQUE("name"),
	CONSTRAINT "provinces_official_code_unique" UNIQUE("official_code"),
	CONSTRAINT "province_name_length" CHECK (length(trim("electoral"."provinces"."name")) between 2 and 100),
	CONSTRAINT "province_source_url" CHECK ("electoral"."provinces"."source_url" ~ '^https?://[^[:space:]]+$' and length("electoral"."provinces"."source_url") <= 1000),
	CONSTRAINT "province_code_format" CHECK ("electoral"."provinces"."official_code" is null or "electoral"."provinces"."official_code" ~ '^[0-9]{1,10}$')
);
--> statement-breakpoint
ALTER TABLE "electoral"."provinces" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "electoral"."cantons" ADD COLUMN "province_id" uuid;--> statement-breakpoint
ALTER TABLE "electoral"."cantons" ADD CONSTRAINT "cantons_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "electoral"."provinces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "provinces_server_read" ON "electoral"."provinces" AS PERMISSIVE FOR SELECT TO "electoral_app" USING (true);
--> statement-breakpoint
REVOKE ALL ON electoral.provinces FROM PUBLIC,anon,authenticated,electoral_app;
--> statement-breakpoint
GRANT SELECT ON electoral.provinces TO electoral_app;
--> statement-breakpoint
CREATE TRIGGER set_updated_at BEFORE UPDATE ON electoral.provinces FOR EACH ROW EXECUTE FUNCTION electoral.set_updated_at();
--> statement-breakpoint
-- No carga automática ni inferencia a partir del campo histórico province_code.
CREATE FUNCTION electoral.register_province(p_actor uuid,p_org uuid,p_canton uuid,p_name text,p_code text,p_source text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
DECLARE v_id uuid;
BEGIN
 PERFORM electoral.require_global_admin(p_actor,p_org);
 IF NOT EXISTS(SELECT 1 FROM electoral.organization_cantons WHERE organization_id=p_org AND canton_id=p_canton AND active) THEN RAISE EXCEPTION 'Ámbito inválido' USING ERRCODE='42501'; END IF;
 IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 2 AND 100 OR p_source IS NULL OR p_source !~ '^https?://[^[:space:]]+$' OR length(p_source)>1000 OR (p_code IS NOT NULL AND p_code !~ '^[0-9]{1,10}$') THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023'; END IF;
 INSERT INTO electoral.provinces(name,official_code,source_url) VALUES(trim(p_name),p_code,p_source) RETURNING id INTO v_id;
 INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action) VALUES(p_org,p_actor,'provinces',v_id,'create');
 RETURN v_id;
END $$;
--> statement-breakpoint
CREATE FUNCTION electoral.link_canton_province(p_actor uuid,p_org uuid,p_canton uuid,p_province uuid,p_expected uuid,p_source text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$
DECLARE v_old electoral.cantons; v_code text;
BEGIN
 PERFORM electoral.require_global_admin(p_actor,p_org);
 IF NOT EXISTS(SELECT 1 FROM electoral.organization_cantons WHERE organization_id=p_org AND canton_id=p_canton AND active) THEN RAISE EXCEPTION 'Ámbito inválido' USING ERRCODE='42501'; END IF;
 IF p_source IS NULL OR p_source !~ '^https?://[^[:space:]]+$' OR length(p_source)>1000 THEN RAISE EXCEPTION 'Fuente requerida' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_old FROM electoral.cantons WHERE id=p_canton FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cantón inexistente' USING ERRCODE='22023'; END IF;
 IF v_old.province_id IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Relación modificada' USING ERRCODE='40001'; END IF;
 SELECT official_code INTO v_code FROM electoral.provinces WHERE id=p_province;
 IF NOT FOUND THEN RAISE EXCEPTION 'Provincia inexistente' USING ERRCODE='22023'; END IF;
 -- Conservar el código previo; una contradicción requiere reconciliación explícita.
 IF v_old.province_code IS NOT NULL AND v_old.province_code IS DISTINCT FROM v_code THEN RAISE EXCEPTION 'Código histórico incompatible' USING ERRCODE='22023'; END IF;
 IF v_old.province_id IS NOT DISTINCT FROM p_province THEN RETURN; END IF;
 UPDATE electoral.cantons SET province_id=p_province WHERE id=p_canton;
 INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action,after_json)
 VALUES(p_org,p_actor,'cantons',p_canton,'link_province',jsonb_build_object('previousProvinceId',v_old.province_id,'provinceId',p_province,'sourceUrl',p_source));
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.register_province(uuid,uuid,uuid,text,text,text),electoral.link_canton_province(uuid,uuid,uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.register_province(uuid,uuid,uuid,text,text,text),electoral.link_canton_province(uuid,uuid,uuid,uuid,uuid,text) TO electoral_app;
