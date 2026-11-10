import { readFile } from "node:fs/promises";
import { administrativeDatabase } from "./database";

async function main() {
  const { client } = administrativeDatabase();
  try {
    if (process.env.ALLOW_TERRITORY_TEST_SEED !== "true") throw new Error("Carga no autorizada");
    const catalog = await readFile("src/server/db/seeds/territories-cr.json", "utf8");
    const seed = await readFile("src/server/db/seeds/territories-cr.sql", "utf8");
    await client.begin(async tx => {
      await tx`select set_config('electoral.seed_org',${process.env.APP_ORGANIZATION_ID ?? ""},true),set_config('electoral.seed_event',${process.env.APP_EVENT_ID ?? ""},true),set_config('electoral.seed_catalog',${catalog},true)`;
      await tx.unsafe(seed);
    });
    console.log("Catálogo de prueba configurado: 7 provincias y 21 cantones. Registros existentes reutilizados; sin distritos nuevos.");
  } finally { await client.end(); }
}
main().catch(() => {
  console.error("No se cargó el catálogo territorial. Verificá esquema 0012, evento is_demo, ALLOW_TERRITORY_TEST_SEED=true y ausencia de conflictos en los registros existentes.");
  process.exitCode = 1;
});
