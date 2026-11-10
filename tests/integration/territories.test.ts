import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { readFile } from "node:fs/promises";
vi.mock("server-only", () => ({}));
vi.mock("@/server/db/client", () => ({ getDb: () => drizzle(db) }));
import { readPublicTerritories } from "@/modules/public-portal/repository";
const db = new PGlite();
const org = "10000000-0000-4000-8000-000000000001", canton = "20000000-0000-4000-8000-000000000001";
const admin = "80000000-0000-4000-8000-000000000001", member = "80000000-0000-4000-8000-000000000002";
const foreign = "ffffffff-ffff-4fff-8fff-ffffffffffff";
let province: string;
async function create(name = "Provincia sintética", code: string | null = "991", actor = admin) {
  return (await db.query<{ id: string }>("select electoral.register_province($1,$2,$3,$4,$5,'https://example.test/catalogo') id", [actor, org, canton, name, code])).rows[0].id;
}
async function link(id: string, expected: string | null = null, actor = admin, cantonId = canton) {
  return db.query("select electoral.link_canton_province($1,$2,$3,$4,$5,'https://example.test/relacion')", [actor, org, cantonId, id, expected]);
}
beforeAll(async () => {
  await db.exec("create schema auth; create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb,raw_user_meta_data jsonb,deleted_at timestamptz,banned_until timestamptz); create role anon; create role authenticated;");
  // Aplica 0012 sobre un estado 0011 con datos, no solo sobre tablas vacías.
  const journal = JSON.parse(await readFile("src/server/db/migrations/meta/_journal.json", "utf8"));
  const previous = journal.entries.filter((e: { idx: number }) => e.idx < 12);
  for (const entry of previous) await db.exec(await readFile(`src/server/db/migrations/${entry.tag}.sql`, "utf8"));
  await db.exec(await readFile("src/server/db/seeds/demo.sql", "utf8"));
  await db.query("insert into auth.users(id) values($1),($2)", [admin, member]);
  await db.query("insert into electoral.organization_memberships(organization_id,user_id,role) values($1,$2,'admin'),($1,$3,'member')", [org, admin, member]);
  await db.exec(await readFile("src/server/db/migrations/0012_territorial_hierarchy.sql", "utf8"));
});
afterAll(() => db.close());
it("conserva identificadores y no rellena provincias ni distritos al actualizar", async () => {
  const data = await readPublicTerritories(org, canton);
  expect(data).toHaveLength(1);
  expect(data[0].id).toBe(canton);
  expect(data[0].province).toBeNull();
  expect(data[0].districts).toHaveLength(5);
  expect((await db.query("select id from electoral.provinces")).rows).toHaveLength(0);
});
it("permite al admin crear y vincular con rol SQL restringido y deja auditoría", async () => {
  await db.exec("set role electoral_app");
  try { province = await create(); await link(province); } finally { await db.exec("reset role"); }
  expect((await readPublicTerritories(org, canton))[0].province?.id).toBe(province);
  expect((await db.query("select id from electoral.audit_logs where entity='provinces'")).rows).toHaveLength(1);
  expect((await db.query("select after_json from electoral.audit_logs where action='link_province'")).rows).toHaveLength(1);
});
it("rechaza códigos duplicados de provincia, cantón y distrito sin cambios parciales", async () => {
  await expect(create("Otra provincia sintética")).rejects.toThrow();
  await db.query("update electoral.cantons set official_code='TEST-C' where id=$1", [canton]);
  await expect(db.query("insert into electoral.cantons(name,official_code) values('Otro cantón sintético','TEST-C')")).rejects.toThrow();
  await db.query("update electoral.districts set official_code='TEST-D' where id=(select id from electoral.districts where canton_id=$1 limit 1)", [canton]);
  await expect(db.query("insert into electoral.districts(canton_id,name,official_code) values($1,'Otro distrito sintético','TEST-D')", [canton])).rejects.toThrow();
  expect((await db.query("select id from electoral.provinces")).rows).toHaveLength(1);
  expect((await readPublicTerritories(org, canton))[0].districts).toHaveLength(5);
});
it("deniega miembros, ámbito ajeno, versión obsoleta y referencias inexistentes", async () => {
  await expect(create("Rechazada", null, member)).rejects.toThrow();
  await expect(link(province, province, member)).rejects.toThrow();
  await expect(link(province, province, admin, foreign)).rejects.toThrow();
  await expect(link(province)).rejects.toThrow();
  await expect(link(foreign, province)).rejects.toThrow();
  expect((await readPublicTerritories(org, canton))[0].province?.id).toBe(province);
});
it("no atribuye la provincia si contradice el código histórico", async () => {
  await db.query("update electoral.cantons set province_code='992' where id=$1", [canton]);
  await expect(link(province, province)).rejects.toThrow();
  await db.query("update electoral.cantons set province_code=null where id=$1", [canton]);
});
it("no concede escritura directa ni acceso de navegador al catálogo", async () => {
  for (const role of ["anon", "authenticated", "electoral_app"]) {
    await db.exec(`set role ${role}`);
    try {
      await expect(db.query("insert into electoral.provinces(name,source_url) values('Prohibida','https://example.test')")).rejects.toThrow();
      if (role !== "electoral_app") {
        await expect(db.query("select * from electoral.provinces")).rejects.toThrow();
        await expect(create()).rejects.toThrow();
      } else expect((await db.query("select id from electoral.provinces")).rows).toHaveLength(1);
    } finally { await db.exec("reset role"); }
  }
});
it("aplica desde cero y permite repetir el migrador", async () => {
  const clean = new PGlite();
  try {
    await clean.exec("create schema auth; create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb,raw_user_meta_data jsonb,deleted_at timestamptz,banned_until timestamptz); create role anon; create role authenticated;");
    await migrate(drizzle(clean), { migrationsFolder: "src/server/db/migrations" });
    await migrate(drizzle(clean), { migrationsFolder: "src/server/db/migrations" });
    expect((await clean.query("select id from electoral.provinces")).rows).toHaveLength(0);
  } finally { await clean.close(); }
});
