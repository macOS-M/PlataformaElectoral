import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { readFile } from "node:fs/promises";
import catalog from "@/server/db/seeds/territories-cr.json";
vi.mock("server-only", () => ({}));
vi.mock("@/server/db/client", () => ({ getDb: () => drizzle(db) }));
import { readPublicTerritories } from "@/modules/public-portal/repository";
const db = new PGlite();
const org = "10000000-0000-4000-8000-000000000001", canton = "20000000-0000-4000-8000-000000000001", event = "30000000-0000-4000-8000-000000000001";
const siquirres = "40000000-0000-4000-8000-000000000001";
let seed: string;
async function load(eventId = event) {
  await db.exec("begin");
  try {
    await db.query("select set_config('electoral.seed_org',$1,true),set_config('electoral.seed_event',$2,true),set_config('electoral.seed_catalog',$3,true)", [org, eventId, JSON.stringify(catalog)]);
    await db.exec(seed);
    await db.exec("commit");
  } catch (error) { await db.exec("rollback"); throw error; }
}
beforeAll(async () => {
  await db.exec("create schema auth; create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb,raw_user_meta_data jsonb,deleted_at timestamptz,banned_until timestamptz); create role anon; create role authenticated;");
  await migrate(drizzle(db), { migrationsFolder: "src/server/db/migrations" });
  await db.exec(await readFile("src/server/db/seeds/demo.sql", "utf8"));
  seed = await readFile("src/server/db/seeds/territories-cr.sql", "utf8");
  await db.query("insert into electoral.cantons(id,name) values($1,'Siquirres')", [siquirres]);
  await db.query("insert into electoral.organization_cantons(organization_id,canton_id) values($1,$2)", [org, siquirres]);
});
afterAll(() => db.close());
it("contiene siete provincias y tres cantones verificados por provincia", () => {
  expect(catalog.provinces).toHaveLength(7);
  expect(new Set(catalog.provinces.flatMap(p => p.cantons.map(c => c.code))).size).toBe(21);
  for (const province of catalog.provinces) {
    expect(province.cantons).toHaveLength(3);
    expect(province.cantons.every(c => c.code.length === 3 && c.code.startsWith(province.code))).toBe(true);
  }
});
it("no carga datos sobre un evento que no sea demo", async () => {
  await db.query("update electoral.election_events set is_demo=false where id=$1", [event]);
  try { await expect(load()).rejects.toThrow(); } finally { await db.query("update electoral.election_events set is_demo=true where id=$1", [event]); }
  expect((await db.query("select id from electoral.provinces")).rows).toHaveLength(0);
});
it("revierte toda la carga ante conflicto y conserva registros existentes", async () => {
  await db.query("update electoral.cantons set province_code='6' where id=$1", [siquirres]);
  await expect(load()).rejects.toThrow();
  expect((await db.query("select id from electoral.provinces")).rows).toHaveLength(0);
  expect((await db.query("select id from electoral.cantons")).rows).toHaveLength(2);
  expect((await db.query("select id from electoral.audit_logs where action='seed_cr_test_catalog'")).rows).toHaveLength(0);
  await db.query("update electoral.cantons set province_code=null where id=$1", [siquirres]);
});
it("carga y repite sin duplicar, reutiliza Siquirres y no inventa distritos", async () => {
  const before = (await db.query("select id from electoral.districts order by id")).rows;
  await load();
  const first = (await db.query("select id,updated_at from electoral.cantons order by id")).rows;
  await load();
  expect((await db.query("select id,updated_at from electoral.cantons order by id")).rows).toEqual(first);
  expect((await db.query("select id from electoral.provinces")).rows).toHaveLength(7);
  expect(first).toHaveLength(22); // 21 reales + cantón sintético previo conservado.
  expect((await db.query("select id from electoral.cantons where official_code='703'")).rows).toEqual([{ id: siquirres }]);
  expect((await db.query("select id from electoral.districts order by id")).rows).toEqual(before);
  expect((await db.query("select id from electoral.audit_logs where action='seed_cr_test_catalog'")).rows).toHaveLength(1);
});
it("permite navegar el catálogo multidistrito solo para eventos demo de la organización", async () => {
  const demo = await readPublicTerritories(org, canton, event);
  expect(demo).toHaveLength(22);
  expect(new Set(demo.flatMap(c => c.province ? [c.province.id] : [])).size).toBe(7);
  expect((await readPublicTerritories(org, canton))).toHaveLength(1);
  await db.query("update electoral.election_events set is_demo=false where id=$1", [event]);
  try { expect(await readPublicTerritories(org, canton, event)).toHaveLength(1); }
  finally { await db.query("update electoral.election_events set is_demo=true where id=$1", [event]); }
  expect(await readPublicTerritories(siquirres, canton, event)).toHaveLength(0);
  await db.query("update electoral.organization_cantons set active=false where organization_id=$1 and canton_id=$2", [org, siquirres]);
  expect((await readPublicTerritories(org, canton, event)).some(c => c.id === siquirres)).toBe(false);
});
