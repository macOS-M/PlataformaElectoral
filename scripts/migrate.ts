import { migrate } from "drizzle-orm/postgres-js/migrator";
import { administrativeDatabase } from "./database";
async function main() {
  const { client, db } = administrativeDatabase();
  try {
    await migrate(db, { migrationsFolder: "src/server/db/migrations" });
    console.log("Migraciones aplicadas correctamente.");
  } finally {
    await client.end();
  }
}
main().catch(() => {
  console.error(
    "No se pudieron aplicar las migraciones. Revisa la conexión administrativa, los permisos y la existencia de Supabase Auth.",
  );
  process.exitCode = 1;
});
