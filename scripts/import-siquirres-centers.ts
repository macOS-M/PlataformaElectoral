import { readFile } from "node:fs/promises";
import { z } from "zod";
import { administrativeDatabase } from "./database";

const catalogSchema = z.object({
  source: z.literal("https://costa-rica-streets.openalfa.com/canton-siquirres/education"),
  retrievedAt: z.string(), attribution: z.string(), criteria: z.string(),
  entries: z.array(z.object({ name: z.string().min(2).max(160), address: z.string().min(2).max(500), lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) })),
});

async function main() {
  const catalog = catalogSchema.parse(JSON.parse(await readFile("docs/centros-siquirres-openalfa.json", "utf8")));
  const { client } = administrativeDatabase();
  try {
    const org = z.guid().parse(process.env.APP_ORGANIZATION_ID);
    const canton = z.guid().parse(process.env.APP_CANTON_ID);
    const event = z.guid().parse(process.env.APP_EVENT_ID);
    await client.begin(async tx => {
      const scopes = await tx`select d.id from electoral.districts d join electoral.cantons c on c.id=d.canton_id
        join electoral.organization_cantons oc on oc.canton_id=c.id and oc.organization_id=${org}::uuid and oc.active
        where c.id=${canton}::uuid and lower(c.name)='siquirres' and lower(d.name)='siquirres' and d.active`;
      if (scopes.length !== 1) throw new Error("Revisa el ámbito Siquirres antes de importar.");
      const admins = await tx`select m.user_id from electoral.organization_memberships m join auth.users u on u.id=m.user_id
        where m.organization_id=${org}::uuid and m.role='admin' and m.active and u.deleted_at is null order by m.user_id`;
      // El autor debe ser explícito si existe más de un administrador.
      const actor = process.env.IMPORT_ACTOR_ID ?? (admins.length === 1 ? admins[0].user_id as string : undefined);
      if (!actor || !admins.some(a => a.user_id === actor)) throw new Error("Define IMPORT_ACTOR_ID con un administrador activo.");
      await tx`select id from electoral.organizations where id=${org}::uuid for update`;
      let added = 0, existing = 0;
      for (const entry of catalog.entries) {
        const found = await tx`select ce.id from electoral.center_elections ce join electoral.voting_centers vc on vc.id=ce.center_id
          where ce.organization_id=${org}::uuid and ce.event_id=${event}::uuid and ce.canton_id=${canton}::uuid
          and ((lower(trim(vc.name))=lower(${entry.name}) and lower(trim(vc.address))=lower(${entry.address}))
            or (vc.latitude=${entry.lat} and vc.longitude=${entry.lon}))`;
        if (found.length) { existing++; continue; }
        if (!process.argv.includes("--apply")) { added++; continue; }
        const [created] = await tx`select electoral.create_center(${actor}::uuid,${org}::uuid,${canton}::uuid,${event}::uuid,${scopes[0].id}::uuid,${entry.name},${entry.address}) as id`;
        await tx`update electoral.voting_centers set latitude=${entry.lat},longitude=${entry.lon} where id=(select center_id from electoral.center_elections where id=${created.id}::uuid)`;
        await tx`update electoral.center_elections set source_reference=${catalog.source} where id=${created.id}::uuid`;
        await tx`insert into electoral.audit_logs(organization_id,actor_user_id,entity,entity_id,action,after_json)
          values(${org}::uuid,${actor}::uuid,'center_elections',${created.id}::uuid,'import_openalfa',${JSON.stringify({ source: catalog.source, retrievedAt: catalog.retrievedAt, attribution: catalog.attribution, original: entry })}::jsonb)`;
        added++;
      }
      console.log(`${process.argv.includes("--apply") ? "Importados" : "Por importar"}: ${added}. Coincidencias existentes: ${existing}. Total del lote: ${catalog.entries.length}.`);
    });
  } finally { await client.end(); }
}
main().catch((error: unknown) => {
  const code = (error as { code?: string }).code;
  console.error("No se completó la importación. Revisa el ámbito, el administrador y la conexión de migraciones. El lote se revierte ante errores.");
  if (code && /^[A-Z0-9]{5}$/.test(code)) console.error(`Código SQL: ${code}`);
  process.exitCode = 1;
});
