import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { readFile } from "node:fs/promises";

const db = new PGlite();
const org = "10000000-0000-4000-8000-000000000001";
const canton = "20000000-0000-4000-8000-000000000001";
const event = "30000000-0000-4000-8000-000000000001";
const admin = "80000000-0000-4000-8000-000000000001";
const member = "80000000-0000-4000-8000-000000000002";
let district: string;
async function create(actor = admin, name = "Escuela de prueba", address = "Comunidad de prueba", districtId = district) {
  return db.query("select electoral.create_center($1,$2,$3,$4,$5,$6,$7) as id", [actor, org, canton, event, districtId, name, address]);
}
beforeAll(async () => {
  await db.exec("create schema auth; create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb,raw_user_meta_data jsonb,deleted_at timestamptz,banned_until timestamptz); create role anon; create role authenticated;");
  await migrate(drizzle(db), { migrationsFolder: "src/server/db/migrations" });
  await db.exec(await readFile("src/server/db/seeds/demo.sql", "utf8"));
  await db.query("insert into auth.users(id) values($1),($2)", [admin, member]);
  await db.query("insert into electoral.organization_memberships(organization_id,user_id,role) values($1,$2,'admin'),($1,$3,'member')", [org, admin, member]);
  district = (await db.query<{ id: string }>("select id from electoral.districts where canton_id=$1 and active limit 1", [canton])).rows[0].id;
});
afterAll(() => db.close());

describe("Alta manual de centros", () => {
  it("rechaza lectores y coordinadores aunque llamen directamente la función", async () => {
    await expect(create(member)).rejects.toThrow();
    await db.query("insert into electoral.module_permissions(organization_id,user_id,canton_id,module) values($1,$2,$3,'district')", [org, member, canton]);
    await expect(create(member)).rejects.toThrow();
    await expect(db.exec("set role anon; select electoral.create_center(null,null,null,null,null,'Escuela','Dirección')")).rejects.toThrow();
    await db.exec("reset role");
  });
  it("valida datos y distrito en SQL sin dejar registros parciales", async () => {
    await expect(create(admin, " ")).rejects.toThrow();
    await expect(create(admin, "Escuela", " ")).rejects.toThrow();
    await expect(create(admin, "Escuela", "Dirección", "ffffffff-ffff-4fff-8fff-ffffffffffff")).rejects.toThrow();
    expect((await db.query("select id from electoral.voting_centers where name='Escuela'")).rows).toHaveLength(0);
  });
  it("permite el alta desde rol restringido, audita y no inventa datos oficiales", async () => {
    await db.exec("set role electoral_app");
    try { await create(); } finally { await db.exec("reset role"); }
    const result = (await db.query<{ internal_status: string; official_status: string; tse_code: string | null; reported_board_count: number | null; action: string; actor_user_id: string }>(
      "select ce.internal_status,ce.official_status,ce.tse_code,ce.reported_board_count,a.action,a.actor_user_id from electoral.center_elections ce join electoral.voting_centers c on c.id=ce.center_id join electoral.audit_logs a on a.entity_id=ce.id where c.name='Escuela de prueba'",
    )).rows;
    expect(result).toEqual([{ internal_status: "pendiente", official_status: "sin_verificar", tse_code: null, reported_board_count: null, action: "create_manual", actor_user_id: admin }]);
  });
  it("rechaza duplicados con espacios/mayúsculas y no fusiona nombres con direcciones distintas", async () => {
    await expect(create(admin, " ESCUELA DE PRUEBA ", " Comunidad de prueba ")).rejects.toThrow();
    await create(admin, "Escuela de prueba", "Otra dirección");
    expect((await db.query("select id from electoral.voting_centers where name='Escuela de prueba'")).rows).toHaveLength(2);
  });
  it("reutiliza la ficha física en un evento posterior", async () => {
    const nextEvent = "30000000-0000-4000-8000-000000000002";
    await db.query("insert into electoral.election_events(id,organization_id,name) values($1,$2,'Evento posterior')", [nextEvent, org]);
    await db.query("select electoral.create_center($1,$2,$3,$4,$5,'Escuela de prueba','Comunidad de prueba')", [admin, org, canton, nextEvent, district]);
    expect((await db.query("select id from electoral.voting_centers where name='Escuela de prueba' and address='Comunidad de prueba'")).rows).toHaveLength(1);
  });
});

describe("Áreas del centro, encargados sin cuenta y adjuntos", () => {
  let center: string, assignment: string, person: string;
  async function save(actor = admin, code = "A05", expected: string | null = null, personId: string | null = null, version = "", reason = "") {
    return db.query<{ id: string }>("select electoral.save_center_responsible($1,$2,$3,$4,$5,$6,$7,$8,$9,'Responsable de prueba','','','Observación de prueba',$10) as id", [actor, org, canton, event, center, code, expected, personId, version, reason]);
  }
  beforeAll(async () => {
    center = (await db.query<{ id: string }>("select ce.id from electoral.center_elections ce join electoral.voting_centers c on c.id=ce.center_id where ce.event_id=$1 and c.name='Escuela de prueba' and c.address='Comunidad de prueba'", [event])).rows[0].id;
    await db.query("delete from electoral.module_permissions where user_id=$1", [member]);
    await db.query("insert into electoral.module_permissions(organization_id,user_id,canton_id,module) values($1,$2,$3,'A05')", [org, member, canton]);
  });
  it("limita edición al área asignada y rechaza centros fuera del ámbito", async () => {
    await expect(save(member, "A06")).rejects.toThrow();
    await expect(db.query("select electoral.require_center_area($1,$2,$3,$4,$5,'A05')", [admin, org, canton, event, "ffffffff-ffff-4fff-8fff-ffffffffffff"])).rejects.toThrow();
    await expect(save(member, "centros")).rejects.toThrow();
  });
  it("crea una ficha sin crear cuenta y audita desde el rol restringido", async () => {
    const usersBefore = (await db.query("select id from auth.users")).rows.length;
    await db.exec("set role electoral_app");
    try { assignment = (await save(member)).rows[0].id; } finally { await db.exec("reset role"); }
    person = (await db.query<{ person_id: string }>("select person_id from electoral.center_area_assignments where id=$1", [assignment])).rows[0].person_id;
    expect((await db.query("select id from auth.users")).rows).toHaveLength(usersBefore);
    expect((await db.query("select id from electoral.audit_logs where entity_id=$1 and actor_user_id=$2 and action='save_responsible'", [assignment, member])).rows).toHaveLength(1);
    expect((await db.query("select user_id from electoral.user_people where person_id=$1", [person])).rows).toHaveLength(0);
  });
  it("no duplica personas ni asignaciones ante formularios obsoletos", async () => {
    const before = (await db.query("select id from electoral.people")).rows.length;
    await expect(save(member)).rejects.toThrow();
    expect((await db.query("select id from electoral.people")).rows).toHaveLength(before);
  });
  it("reutiliza una persona en otra área y controla versiones", async () => {
    const version = (await db.query<{ v: string }>("select updated_at::text v from electoral.people where id=$1", [person])).rows[0].v;
    await save(admin, "A06", null, person, version);
    expect((await db.query("select id from electoral.center_area_assignments where person_id=$1", [person])).rows).toHaveLength(2);
    await expect(save(member, "A05", assignment, person, "versión obsoleta")).rejects.toThrow();
  });
  it("sustituye con motivo y conserva la asignación anterior", async () => {
    await expect(save(member, "A05", assignment)).rejects.toThrow();
    await save(member, "A05", assignment, null, "", "Cambio de disponibilidad");
    expect((await db.query("select id from electoral.center_area_assignments where id=$1 and ended_at is not null and ended_reason='Cambio de disponibilidad'", [assignment])).rows).toHaveLength(1);
    expect((await db.query("select id from electoral.people where id=$1", [person])).rows).toHaveLength(1);
  });
  it("registra metadatos privados y rechaza rutas ajenas, tamaños y permisos", async () => {
    const path = `${org}/${event}/${center}/A05/90000000-0000-4000-8000-000000000001.pdf`;
    const args = [member, org, canton, event, center, "A05", path, "contrato-prueba.pdf", "contrato", "application/pdf", 100];
    const query = "select electoral.add_center_document($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)";
    await db.exec("set role electoral_app");
    try {
      await db.query(query, args);
      await expect(db.query(query, [...args.slice(0, 6), "otro/archivo.pdf", ...args.slice(7)])).rejects.toThrow();
      await expect(db.query(query, [...args.slice(0, 10), 6000000])).rejects.toThrow();
      await expect(db.query(query, [...args.slice(0, 5), "A06", ...args.slice(6)])).rejects.toThrow();
      await expect(db.exec("update electoral.center_area_documents set filename='otro.pdf'")).rejects.toThrow();
    } finally { await db.exec("reset role"); }
    expect((await db.query("select id from electoral.center_area_documents where storage_path=$1", [path])).rows).toHaveLength(1);
  });
});
