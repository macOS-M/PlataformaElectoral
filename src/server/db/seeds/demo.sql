-- SOLO DATOS SINTÉTICOS. El invocador ejecuta todo en una transacción.
INSERT INTO electoral.organizations (id, name) VALUES ('10000000-0000-4000-8000-000000000001', 'Organización de demostración') ON CONFLICT DO NOTHING;
INSERT INTO electoral.cantons (id, name) VALUES ('20000000-0000-4000-8000-000000000001', 'Cantón de demostración') ON CONFLICT DO NOTHING;
INSERT INTO electoral.organization_cantons (organization_id, canton_id) VALUES ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001') ON CONFLICT DO NOTHING;
INSERT INTO electoral.election_events (id, organization_id, name, is_demo) VALUES ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Evento de demostración · sin fecha oficial', true) ON CONFLICT DO NOTHING;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM electoral.election_events WHERE id='30000000-0000-4000-8000-000000000001' AND is_demo AND organization_id='10000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'La semilla requiere un evento de demostración'; END IF;
END $$;
INSERT INTO electoral.districts (id, canton_id, name)
SELECT md5('demo-district-' || n)::uuid, '20000000-0000-4000-8000-000000000001', 'Distrito de demostración ' || n FROM generate_series(1,5) n ON CONFLICT DO NOTHING;
INSERT INTO electoral.functional_areas (id, organization_id, code, name)
SELECT md5('demo-area-' || ord)::uuid, '10000000-0000-4000-8000-000000000001', 'A' || lpad(ord::text,2,'0'), name
FROM unnest(ARRAY['Signos externos','Movimientos sectoriales','Territoriales','Electorales','Transporte','Alimentación','Coordinación Día E','Redes sociales','Enlace TSE']) WITH ORDINALITY AS a(name, ord) ON CONFLICT DO NOTHING;
INSERT INTO electoral.sectoral_movements (id, organization_id, name, normalized_name)
SELECT md5('demo-movement-' || ord)::uuid, '10000000-0000-4000-8000-000000000001', name, lower(name)
FROM unnest(ARRAY['Mujeres','Juventud','Empresarial','Agropecuario','Adultos Mayores','Inclusión']) WITH ORDINALITY AS a(name, ord) ON CONFLICT DO NOTHING;
INSERT INTO electoral.organizational_positions (id, organization_id, canton_id, code, name, kind)
VALUES ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'GENERAL', 'Coordinación General Cantonal', 'general') ON CONFLICT DO NOTHING;
INSERT INTO electoral.organizational_positions (id, organization_id, canton_id, code, name, kind, district_id, parent_position_id)
SELECT md5('demo-position-district-' || n)::uuid, '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'D' || n, 'Coordinación · distrito de demostración ' || n, 'district', md5('demo-district-' || n)::uuid, '40000000-0000-4000-8000-000000000001' FROM generate_series(1,5) n ON CONFLICT DO NOTHING;
INSERT INTO electoral.organizational_positions (id, organization_id, canton_id, code, name, kind, functional_area_id, parent_position_id)
SELECT md5('demo-position-' || code)::uuid, organization_id, '20000000-0000-4000-8000-000000000001', code, name, 'area', id, '40000000-0000-4000-8000-000000000001' FROM electoral.functional_areas WHERE organization_id='10000000-0000-4000-8000-000000000001' ON CONFLICT DO NOTHING;
INSERT INTO electoral.voting_centers (id, organization_id, name, address)
SELECT md5('demo-center-' || n)::uuid, '10000000-0000-4000-8000-000000000001', 'Centro de demostración ' || lpad(n::text,2,'0'), 'Dirección sintética para pruebas; no corresponde a un centro real.' FROM generate_series(1,70) n ON CONFLICT DO NOTHING;
INSERT INTO electoral.center_elections (id, organization_id, center_id, event_id, canton_id, district_id, data_source, source_reference)
SELECT md5('demo-center-event-' || n)::uuid, '10000000-0000-4000-8000-000000000001', md5('demo-center-' || n)::uuid, '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', md5('demo-district-' || ((n - 1) % 5 + 1))::uuid, 'demo', 'Semilla sintética Sprint 1' FROM generate_series(1,70) n ON CONFLICT DO NOTHING;
INSERT INTO electoral.audit_logs (id, organization_id, entity, action)
VALUES ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'demo_dataset', 'synthetic_seed') ON CONFLICT DO NOTHING;
