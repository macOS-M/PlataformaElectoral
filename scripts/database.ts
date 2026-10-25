import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
config({ path: ".env.local", quiet: true });
export function administrativeDatabase() {
  const connection = process.env.DATABASE_MIGRATION_URL;
  if (!connection)
    throw new Error("Falta DATABASE_MIGRATION_URL en .env.local.");
  const client = postgres(connection, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
  });
  return { client, db: drizzle(client) };
}
