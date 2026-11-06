import { PGlite } from "@electric-sql/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { administrativeDatabase } from "./database";

// 0009 puede haberse aplicado desde SQL sin registrar su hash en Drizzle.
// No se marca como aplicada hasta comparar todas sus estructuras/funciones
// contra una base PostgreSQL aislada construida desde las migraciones locales.
const catalogQuery = `
select 'column' as kind,c.relname as name,a.attnum::text as item,
 jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'required',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid))::text as definition
from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
where n.nspname='electoral' and c.relname in ('vehicles','vehicle_center_assignments','vehicle_district_assignments','training_requirements','training_progress') and a.attnum>0 and not a.attisdropped
union all
select 'constraint',c.relname,k.conname,pg_get_constraintdef(k.oid) from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='electoral' and k.contype<>'n' and (c.relname in ('vehicles','vehicle_center_assignments','vehicle_district_assignments','training_requirements','training_progress') or (c.relname='organizational_assignments' and k.conname='assignment_training_scope'))
union all
select 'index',t.relname,i.relname,pg_get_indexdef(i.oid) from pg_index x join pg_class i on i.oid=x.indexrelid join pg_class t on t.oid=x.indrelid join pg_namespace n on n.oid=t.relnamespace
where n.nspname='electoral' and t.relname in ('vehicles','vehicle_center_assignments','vehicle_district_assignments','training_requirements','training_progress')
union all
select 'trigger',c.relname,t.tgname,pg_get_triggerdef(t.oid) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='electoral' and c.relname='vehicles' and not t.tgisinternal
union all
select 'function',p.proname,pg_get_function_identity_arguments(p.oid),jsonb_build_object('body',replace(p.prosrc,chr(13),''),'securityDefiner',p.prosecdef,'config',p.proconfig,'returnType',format_type(p.prorettype,null))::text
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='electoral' and p.proname in ('save_vehicle','save_training_requirement','record_training_progress')
order by kind,name,item`;
type CatalogRow = { kind: string; name: string; item: string; definition: string };
function normalized(rows: CatalogRow[]) {
  return rows.map(row => ({ ...row, definition: row.definition.replace(/\r/g, "").trim() }))
    .sort((a, b) => {
      const left = `${a.kind}:${a.name}:${a.item}`, right = `${b.kind}:${b.name}:${b.item}`;
      return left < right ? -1 : left > right ? 1 : 0;
    });
}
let stage = "prepare";
async function main() {
  const migrations = readMigrationFiles({ migrationsFolder: "src/server/db/migrations" });
  const baseline = migrations[9], correction = migrations[10];
  if (!baseline || !correction || migrations.length !== 11) throw new Error("Revisar plan de migraciones");
  const reference = new PGlite();
  const { client } = administrativeDatabase();
  try {
    await reference.exec("create schema auth; create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb,raw_user_meta_data jsonb,deleted_at timestamptz,banned_until timestamptz); create role anon; create role authenticated;");
    for (const migration of migrations.slice(0, 10)) for (const statement of migration.sql) await reference.exec(statement);
    await reference.exec("set search_path=pg_catalog,electoral");
    const expected = normalized((await reference.query<CatalogRow>(catalogQuery)).rows);
    await client.begin(async tx => {
      // Ajuste local de resolución de nombres; no modifica filas.
      await tx.unsafe("set local search_path=pg_catalog,electoral");
      const rows = await tx.unsafe<CatalogRow[]>(catalogQuery);
      stage = "compare-schema";
      const actual = normalized([...rows]);
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        const differences = actual.filter(row => !expected.some(e => JSON.stringify(e) === JSON.stringify(row)));
        const missing = expected.filter(row => !actual.some(e => JSON.stringify(e) === JSON.stringify(row)));
        // Solo nombres de estructuras, nunca filas operativas o contactos.
        console.log(JSON.stringify({ schemaDifferences: differences.map(({ kind, name, item }) => ({ kind, name, item })), missing: missing.map(({ kind, name, item }) => ({ kind, name, item })) }));
        throw new Error("El esquema remoto difiere de 0009; no aplicar automáticamente");
      }
      stage = "check-journal";
      const applied = await tx<{ hash: string; created_at: string }[]>`select hash,created_at from drizzle.__drizzle_migrations order by created_at`;
      if (applied.some(row => Number(row.created_at) > correction.folderMillis)) throw new Error("Existen migraciones posteriores");
      for (const migration of migrations.slice(0, 9)) if (!applied.some(row => row.hash === migration.hash)) throw new Error("Falta historial anterior");
      const needsBaseline = !applied.some(row => row.hash === baseline.hash);
      const needsCorrection = !applied.some(row => row.hash === correction.hash);
      if (!process.argv.includes("--apply")) {
        console.log(JSON.stringify({ mode: "read-only", schemaMatches0009: true, needsBaseline0009: needsBaseline, needsCorrection0010: needsCorrection }));
        return;
      }
      stage = "apply-correction";
      // Comprobación + políticas + registro de versiones se confirman juntos.
      if (needsCorrection) for (const statement of correction.sql) await tx.unsafe(statement);
      if (needsBaseline) await tx`insert into drizzle.__drizzle_migrations(hash,created_at) values(${baseline.hash},${baseline.folderMillis})`;
      if (needsCorrection) await tx`insert into drizzle.__drizzle_migrations(hash,created_at) values(${correction.hash},${correction.folderMillis})`;
    });
    if (process.argv.includes("--apply")) console.log("Corrección RLS e historial de migraciones confirmados. No se modificaron vehículos, personas ni asignaciones.");
  } finally {
    await reference.close(); await client.end({ timeout: 1 });
  }
}
main().catch((error: unknown) => {
  const e = error as { code?: string };
  console.error(JSON.stringify({ error: "No se aplicó la corrección. Revisar etapa antes de continuar.", stage, code: e.code ?? null }));
  process.exitCode = 1;
});
