CREATE OR REPLACE FUNCTION electoral.complete_authorized_registration() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$ DECLARE v_auth electoral.registration_authorizations; BEGIN
 IF coalesce(NEW.raw_app_meta_data->>'electoral_invitation','')='' THEN RETURN NEW; END IF;
 SELECT * INTO v_auth FROM electoral.registration_authorizations WHERE id=(NEW.raw_app_meta_data->>'electoral_invitation')::uuid FOR UPDATE;
 IF FOUND AND v_auth.user_id=NEW.id AND NEW.email=(v_auth.id::text || '@accounts.cantonal.invalid') THEN RETURN NEW; END IF;
 IF NOT FOUND OR NOT v_auth.active OR v_auth.user_id IS NOT NULL OR v_auth.claim_token IS DISTINCT FROM (NEW.raw_app_meta_data->>'electoral_claim')::uuid OR v_auth.claim_token IS NULL OR v_auth.claim_expires_at IS NULL OR v_auth.claim_expires_at<now() OR NEW.email IS DISTINCT FROM (v_auth.id::text || '@accounts.cantonal.invalid') THEN RAISE EXCEPTION 'Registro no autorizado' USING ERRCODE='42501'; END IF;
 INSERT INTO electoral.organization_memberships(organization_id,user_id,role,active) VALUES(v_auth.organization_id,NEW.id,v_auth.role,true);
 INSERT INTO electoral.module_permissions(organization_id,user_id,canton_id,module) SELECT v_auth.organization_id,NEW.id,v_auth.canton_id,x FROM (SELECT DISTINCT unnest(v_auth.modules) AS x) t;
 UPDATE electoral.registration_authorizations SET user_id=NEW.id,claim_token=NULL,claim_expires_at=NULL WHERE id=v_auth.id;
 INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action) VALUES(v_auth.organization_id,NEW.id,'registration_authorizations',v_auth.id,'registered');
 RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER complete_authorized_registration ON auth.users;
--> statement-breakpoint
-- Admin createUser actualiza app_metadata después del INSERT, en su misma transacción.
CREATE TRIGGER complete_authorized_registration AFTER INSERT OR UPDATE OF raw_app_meta_data,email ON auth.users FOR EACH ROW EXECUTE FUNCTION electoral.complete_authorized_registration();
--> statement-breakpoint
CREATE FUNCTION electoral.renew_activation(p_actor uuid,p_org uuid,p_canton uuid,p_id uuid,p_hash text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,electoral AS $$ BEGIN
 PERFORM electoral.require_global_admin(p_actor,p_org);
 IF p_hash IS NULL OR p_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Código inválido' USING ERRCODE='22023'; END IF;
 UPDATE electoral.registration_authorizations SET activation_hash=p_hash,claim_token=NULL,claim_expires_at=NULL WHERE id=p_id AND organization_id=p_org AND canton_id=p_canton AND user_id IS NULL AND active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Autorización no disponible' USING ERRCODE='22023'; END IF;
 INSERT INTO electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action) VALUES(p_org,p_actor,'registration_authorizations',p_id,'activation_renewed');
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION electoral.renew_activation(uuid,uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION electoral.renew_activation(uuid,uuid,uuid,uuid,text) TO electoral_app;
