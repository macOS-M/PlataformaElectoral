import { readFile } from "node:fs/promises";
import { administrativeDatabase } from "./database";
async function main() {
  if (process.env.ALLOW_DEMO_SEED !== "true")
    throw new Error("Semilla no autorizada");
  const { client } = administrativeDatabase();
  try {
    const sql = await readFile("src/server/db/seeds/demo.sql", "utf8");
    await client.begin(async (tx) => {
      await tx.unsafe(sql);
    });
    console.log(
      "Catálogo sintético cargado. No contiene información oficial ni personas reales.",
    );
  } finally {
    await client.end();
  }
}
main().catch(() => {
  console.error(
    "No se cargó el catálogo. Revisa DATABASE_MIGRATION_URL y ALLOW_DEMO_SEED=true; usa un entorno exclusivo de demostración.",
  );
  process.exitCode = 1;
});
