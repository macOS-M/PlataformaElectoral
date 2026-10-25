import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { getConfiguration } from "@/server/config";
let database: ReturnType<typeof drizzle> | undefined;
export function getDb() {
  const config = getConfiguration();
  if (!config) throw new Error("Configuración de servidor incompleta.");
  database ??= drizzle(
    postgres(config.DATABASE_URL, {
      prepare: false,
      max: 5,
      connect_timeout: 10,
      idle_timeout: 20,
    }),
  );
  return database;
}
