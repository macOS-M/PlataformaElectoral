import { config } from "dotenv";
import postgres from "postgres";
config({ path: ".env.local", quiet: true });
let stage = "scope";
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Configuración incompleta");
  const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 10 });
  const rollback = new Error("verification-rollback");
  let verified = false;
  try {
    try {
      await client.begin(async tx => {
        const org = process.env.APP_ORGANIZATION_ID!;
        const canton = process.env.APP_CANTON_ID!;
        const event = process.env.APP_EVENT_ID!;
        const [admin] = await tx`select user_id from electoral.organization_memberships where organization_id=${org}::uuid and role='admin' and active order by user_id limit 1`;
        const [center] = await tx`select id from electoral.center_elections where organization_id=${org}::uuid and canton_id=${canton}::uuid and event_id=${event}::uuid order by id limit 1`;
        if (!admin || !center) throw new Error("Falta ámbito de prueba");
        const areas = await tx`select code from electoral.functional_areas where organization_id=${org}::uuid and active and code in ('A01','A02','A03','A04','A05','A06','A07','A08','A09')`;
        if (areas.length !== 9) throw new Error("Faltan áreas");
        // Solo se realizan escrituras temporales, con el mismo rol restringido del servidor.
        stage = "responsible";
        const [current] = await tx`select ca.id from electoral.center_area_assignments ca join electoral.functional_areas fa on fa.id=ca.area_id where ca.center_election_id=${center.id}::uuid and fa.code='A05' and ca.ended_at is null`;
        const [created] = await tx`select electoral.save_center_responsible(${admin.user_id}::uuid,${org}::uuid,${canton}::uuid,${event}::uuid,${center.id}::uuid,'A05',${current?.id ?? null}::uuid,null,'','Responsable temporal de verificación','','','','Verificación temporal') as id`;
        const [saved] = await tx`select ca.person_id from electoral.center_area_assignments ca where ca.id=${created.id}::uuid`;
        if (!saved || (await tx`select user_id from electoral.user_people where person_id=${saved.person_id}::uuid`).length) throw new Error("Cuenta inesperada");
        const path = `${org}/${event}/${center.id}/A05/90000000-0000-4000-8000-000000000001.pdf`;
        stage = "document";
        await tx`select electoral.add_center_document(${admin.user_id}::uuid,${org}::uuid,${canton}::uuid,${event}::uuid,${center.id}::uuid,'A05',${path},'verificacion.pdf','otro','application/pdf',50)`;
        const [doc] = await tx`select id from electoral.center_area_documents where storage_path=${path}`;
        if (!doc) throw new Error("Adjunto no disponible");
        verified = true;
        stage = "rollback";
        throw rollback;
      });
    } catch (error) { if (error !== rollback) throw error; }
    if (!verified) throw new Error("Verificación incompleta");
    console.log("Supabase SQL: nueve áreas, encargado sin cuenta, metadatos de adjunto y rol restringido verificados. Todos los datos de prueba se revirtieron.");
  } finally { await client.end(); }
}
main().catch((error: unknown) => { console.error(`No se pudo verificar el flujo de áreas (${stage}). La transacción de prueba se revirtió.`); const code = (error as { code?: string }).code; if (code && /^[A-Z0-9]{5}$/.test(code)) console.error(`Código SQL: ${code}`); process.exitCode = 1; });
