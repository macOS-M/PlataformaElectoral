import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { readFile } from "node:fs/promises";
import type { SQL } from "drizzle-orm";
import type { AccessContext } from "@/server/authorization/context";
vi.mock("server-only", () => ({}));
vi.mock("@/server/db/client", () => ({ getDb: () => ({ execute: async (query: SQL) => (await drizzle(db).execute(query)).rows }) }));
import { readTransport } from "@/modules/transport/repository";
import { readTraining } from "@/modules/training/repository";
const db = new PGlite();
const org = "10000000-0000-4000-8000-000000000001", canton = "20000000-0000-4000-8000-000000000001", event = "30000000-0000-4000-8000-000000000001";
const admin = "80000000-0000-4000-8000-000000000001", coordinator = "80000000-0000-4000-8000-000000000002", reader = "80000000-0000-4000-8000-000000000003";
const foreign = "ffffffff-ffff-4fff-8fff-ffffffffffff";
let district: string, centers: string[], person: string, position: string, assignment: string;
type VehicleOptions = { actor?: string; id?: string; version?: number; plate?: string; personId?: string | null; personVersion?: string; active?: boolean; districtIds?: string[]; centerIds?: string[]; eventId?: string };
async function saveVehicle(o: VehicleOptions = {}) {
  const version = (await db.query<{ version: string }>("select updated_at::text as version from electoral.people where id=$1", [o.personId ?? person])).rows[0]?.version ?? "";
  return (await db.query<{ id: string }>("select electoral.save_vehicle($1,$2,$3,$4,$5,$6,$7,'Vehículo de prueba',$8,$9,'Encargado sintético','','',$10,$11,$12,$13) as id", [o.actor ?? admin, org, canton, o.eventId ?? event, o.id ?? null, o.version ?? 0, o.plate ?? "TEST-01", o.personId === null ? null : o.personId ?? person, o.personVersion ?? version, o.active ?? true, o.districtIds ?? [district], o.centerIds ?? centers, o.id ? "Ajuste operativo" : ""])).rows[0].id;
}
async function configure(expected: string | null = null, required = true, date: string | null = "2020-01-01", actor = admin) {
  return (await db.query<{ id: string }>("select electoral.save_training_requirement($1,$2,$3,$4,$5,$6,$7,$8) as id", [actor, org, canton, event, position, expected, required, date])).rows[0].id;
}
async function progress(requirement: string, expected: string | null = null, status = "convocado", date = "2020-01-01", actor = admin, assignee = assignment) {
  return (await db.query<{ id: string }>("select electoral.record_training_progress($1,$2,$3,$4,$5,$6,$7,$8,$9) as id", [actor, org, canton, event, requirement, assignee, expected, status, date])).rows[0].id;
}
beforeAll(async () => {
  await db.exec("create schema auth; create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb,raw_user_meta_data jsonb,deleted_at timestamptz,banned_until timestamptz); create role anon; create role authenticated;");
  await migrate(drizzle(db), { migrationsFolder: "src/server/db/migrations" });
  await db.exec(await readFile("src/server/db/seeds/demo.sql", "utf8"));
  await db.query("insert into auth.users(id) values($1),($2),($3)", [admin, coordinator, reader]);
  await db.query("insert into electoral.organization_memberships(organization_id,user_id,role) values($1,$2,'admin'),($1,$3,'member'),($1,$4,'member')", [org, admin, coordinator, reader]);
  await db.query("insert into electoral.module_permissions(organization_id,user_id,canton_id,module) values($1,$2,$3,'A05')", [org, coordinator, canton]);
  district = (await db.query<{ id: string }>("select id from electoral.districts where canton_id=$1 order by id limit 1", [canton])).rows[0].id;
  centers = (await db.query<{ id: string }>("select id from electoral.center_elections where district_id=$1 order by id limit 2", [district])).rows.map(r => r.id);
  person = (await db.query<{ id: string }>("select person_id as id from electoral.user_people where user_id=$1", [admin])).rows[0].id;
  position = (await db.query<{ id: string }>("select id from electoral.organizational_positions where organization_id=$1 and kind='general'", [org])).rows[0].id;
  await db.query("select electoral.set_responsible($1,$2,$3,$4,$5,null,'')", [admin, org, canton, position, person]);
  assignment = (await db.query<{ id: string }>("select id from electoral.organizational_assignments where position_id=$1 and ended_at is null", [position])).rows[0].id;
});
afterAll(() => db.close());

describe("Vehículos y relaciones compartidas", () => {
  let vehicle: string;
  it("aplica la migración desde cero y puede repetir el migrador", async () => {
    await migrate(drizzle(db), { migrationsFolder: "src/server/db/migrations" });
    expect(centers).toHaveLength(2);
  });
  it("permite A05 con rol SQL restringido y relación N:M sin duplicar personas", async () => {
    const before = (await db.query("select id from electoral.people")).rows.length;
    await db.exec("set role electoral_app");
    try { vehicle = await saveVehicle({ actor: coordinator }); await saveVehicle({ plate: "TEST-02" }); } finally { await db.exec("reset role"); }
    expect((await db.query("select id from electoral.vehicle_center_assignments where ended_at is null")).rows).toHaveLength(4);
    expect((await db.query("select id from electoral.people")).rows).toHaveLength(before);
  });
  it("rechaza lector, centros de otro ámbito/evento o distrito no seleccionado", async () => {
    await expect(saveVehicle({ actor: reader, plate: "TEST-03" })).rejects.toThrow();
    await expect(saveVehicle({ plate: "TEST-03", centerIds: [foreign] })).rejects.toThrow();
    await expect(saveVehicle({ plate: "TEST-03", districtIds: [] })).rejects.toThrow();
    await expect(saveVehicle({ plate: "TEST-03", eventId: foreign })).rejects.toThrow();
    await expect(saveVehicle({ plate: "TEST-03", districtIds: [foreign], centerIds: [] })).rejects.toThrow();
  });
  it("rechaza placas duplicadas normalizadas y revierte persona creada", async () => {
    const before = (await db.query("select id from electoral.people")).rows.length;
    await expect(saveVehicle({ plate: " test-01 ", personId: null })).rejects.toThrow();
    expect((await db.query("select id from electoral.people")).rows).toHaveLength(before);
  });
  it("actualiza relaciones conservando historial y rechaza versiones obsoletas", async () => {
    await saveVehicle({ id: vehicle, version: 1, centerIds: [centers[0]] });
    const history = (await db.query<{ ended_at: string | null }>("select ended_at from electoral.vehicle_center_assignments where vehicle_id=$1", [vehicle])).rows;
    expect(history).toHaveLength(2);
    expect(history.filter(r => r.ended_at === null)).toHaveLength(1);
    await expect(saveVehicle({ id: vehicle, version: 1 })).rejects.toThrow();
    await expect(saveVehicle({ id: vehicle, version: 2, personVersion: "obsoleta" })).rejects.toThrow();
  });
  it("desactiva sin eliminar la ficha ni historial", async () => {
    await saveVehicle({ id: vehicle, version: 2, active: false });
    expect((await db.query("select id from electoral.vehicle_center_assignments where vehicle_id=$1 and ended_at is null", [vehicle])).rows).toHaveLength(0);
    expect((await db.query("select id from electoral.vehicles where id=$1 and not active", [vehicle])).rows).toHaveLength(1);
  });
  it("revocar A05 impide la siguiente escritura", async () => {
    await db.query("delete from electoral.module_permissions where user_id=$1", [coordinator]);
    await expect(saveVehicle({ actor: coordinator, plate: "TEST-03" })).rejects.toThrow();
    await db.query("insert into electoral.module_permissions(organization_id,user_id,canton_id,module) values($1,$2,$3,'district')", [org, coordinator, canton]);
  });
  it("dos escrituras con la misma versión no pueden sobrescribirse", async () => {
    const id = await saveVehicle({ plate: "TEST-05" });
    const results = await Promise.allSettled([saveVehicle({ id, plate: "TEST-05", version: 1, centerIds: [] }), saveVehicle({ id, plate: "TEST-05", version: 1 })]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect((await db.query<{ version: number }>("select version from electoral.vehicles where id=$1", [id])).rows[0].version).toBe(2);
  });
});

describe("Capacitación versionada por puesto y ocupante", () => {
  let requirement: string, currentProgress: string;
  it("solo admin configura y registra, aunque el usuario tenga coordinación distrital", async () => {
    await expect(configure(null, true, "2020-01-01", coordinator)).rejects.toThrow();
    await expect(configure(null, true, "2020-01-01", reader)).rejects.toThrow();
    await db.exec("set role electoral_app");
    try { requirement = await configure(); } finally { await db.exec("reset role"); }
    await expect(progress(requirement, null, "convocado", "2020-01-01", coordinator)).rejects.toThrow();
  });
  it("rechaza ámbito, puesto y ocupación ajenos", async () => {
    await expect(db.query("select electoral.save_training_requirement($1,$2,$3,$4,$5,null,true,null)", [admin, org, canton, foreign, position])).rejects.toThrow();
    await expect(db.query("select electoral.save_training_requirement($1,$2,$3,$4,$5,null,true,null)", [admin, org, canton, event, foreign])).rejects.toThrow();
    await expect(progress(requirement, null, "convocado", "2020-01-01", admin, foreign)).rejects.toThrow();
  });
  it("registra convocatoria y cumplimiento con fecha sin sobrescribir historial", async () => {
    const invited = await progress(requirement);
    currentProgress = await progress(requirement, invited, "cumplido", "2020-01-02");
    expect((await db.query("select id from electoral.training_progress where requirement_id=$1", [requirement])).rows).toHaveLength(2);
    await expect(progress(requirement, invited, "no_asistio", "2020-01-02")).rejects.toThrow();
  });
  it("rechaza fechas futuras, cumplimiento previo a la sesión y regresión de fecha", async () => {
    await expect(progress(requirement, currentProgress, "cumplido", "9999-01-01")).rejects.toThrow();
    await expect(progress(requirement, currentProgress, "cumplido", "2019-01-01")).rejects.toThrow();
    await expect(progress(requirement, currentProgress, "pendiente", "2020-01-01")).rejects.toThrow();
  });
  it("el requisito cambia por revisión, sin heredar estados ni aceptar el formulario viejo", async () => {
    const next = await configure(requirement, true, "2020-02-01");
    await expect(configure(requirement, false, null)).rejects.toThrow();
    await expect(progress(requirement, currentProgress, "pendiente", "2020-02-01")).rejects.toThrow();
    expect((await db.query("select id from electoral.training_progress where requirement_id=$1", [next])).rows).toHaveLength(0);
    requirement = next;
  });
  it("no requerido y sin fecha son estados distintos, no se convoca sin fecha", async () => {
    const noDate = await configure(requirement, true, null);
    await expect(progress(noDate)).rejects.toThrow();
    const optional = await configure(noDate, false, null);
    await expect(progress(optional, null, "pendiente")).rejects.toThrow();
    await expect(configure(optional, false, "2020-01-01")).rejects.toThrow();
    requirement = await configure(optional, true, "2020-01-01");
  });
  it("sustituir ocupante conserva el cumplimiento previo y exige registro para el nuevo", async () => {
    await progress(requirement, null, "cumplido", "2020-02-01");
    const newPerson = (await db.query<{ id: string }>("select person_id as id from electoral.user_people where user_id=$1", [reader])).rows[0].id;
    await db.query("select electoral.set_responsible($1,$2,$3,$4,$5,$6,'Sustitución de prueba')", [admin, org, canton, position, newPerson, assignment]);
    await expect(progress(requirement, null, "pendiente", "2020-02-01")).rejects.toThrow();
    const nextAssignment = (await db.query<{ id: string }>("select id from electoral.organizational_assignments where position_id=$1 and ended_at is null", [position])).rows[0].id;
    expect((await db.query("select id from electoral.training_progress where assignment_id=$1", [nextAssignment])).rows).toHaveLength(0);
    await progress(requirement, null, "pendiente", "2020-02-01", admin, nextAssignment);
  });
});

describe("Privilegios, integridad y auditoría", () => {
  it("actualiza un esquema 0008 con datos sin perder centros, personas o asignaciones", async () => {
    const upgrade = new PGlite();
    try {
      await upgrade.exec("create schema auth; create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb,raw_user_meta_data jsonb,deleted_at timestamptz,banned_until timestamptz); create role anon; create role authenticated;");
      const journal = JSON.parse(await readFile("src/server/db/migrations/meta/_journal.json", "utf8")) as { entries: { idx: number; tag: string }[] };
      for (const entry of journal.entries.filter(e => e.idx < 9)) await upgrade.exec(await readFile(`src/server/db/migrations/${entry.tag}.sql`, "utf8"));
      await upgrade.exec(await readFile("src/server/db/seeds/demo.sql", "utf8"));
      await upgrade.query("insert into auth.users(id) values($1)", [admin]);
      await upgrade.query("insert into electoral.organization_memberships(organization_id,user_id,role) values($1,$2,'admin')", [org, admin]);
      const oldPerson = (await upgrade.query<{ id: string }>("select person_id as id from electoral.user_people where user_id=$1", [admin])).rows[0].id;
      await upgrade.query("select electoral.set_responsible($1,$2,$3,$4,$5,null,'')", [admin, org, canton, position, oldPerson]);
      const oldCenters = (await upgrade.query("select id from electoral.center_elections order by id")).rows;
      const oldAssignments = (await upgrade.query("select id,person_id,position_id from electoral.organizational_assignments")).rows;
      await upgrade.exec(await readFile("src/server/db/migrations/0009_tan_gladiator.sql", "utf8"));
      expect((await upgrade.query("select id from electoral.center_elections order by id")).rows).toEqual(oldCenters);
      expect((await upgrade.query("select id,person_id,position_id from electoral.organizational_assignments")).rows).toEqual(oldAssignments);
      expect((await upgrade.query("select id from electoral.people where id=$1", [oldPerson])).rows).toHaveLength(1);
      // Reproduce Supabase: tablas con RLS activado automáticamente, sin políticas.
      const tables = ["vehicles", "vehicle_center_assignments", "vehicle_district_assignments", "training_requirements", "training_progress"];
      for (const table of tables) await upgrade.exec(`alter table electoral.${table} enable row level security`);
      const center = (await upgrade.query<{ id: string; district_id: string }>("select id,district_id from electoral.center_elections where event_id=$1 limit 1", [event])).rows[0];
      await upgrade.exec("set role electoral_app");
      const createdVehicle = (await upgrade.query<{ id: string }>("select electoral.save_vehicle($1,$2,$3,$4,null,0,'RLS-TEST','Vehículo sintético',null,'','Responsable sintético','','',true,$5,$6,'') as id", [admin, org, canton, event, [center.district_id], [center.id]])).rows[0].id;
      expect((await upgrade.query("select id from electoral.vehicles where id=$1", [createdVehicle])).rows).toHaveLength(0);
      await upgrade.exec("reset role");
      await upgrade.exec(await readFile("src/server/db/migrations/0010_spicy_susan_delgado.sql", "utf8"));
      await upgrade.exec("set role electoral_app");
      expect((await upgrade.query("select id from electoral.vehicles where id=$1", [createdVehicle])).rows).toHaveLength(1);
      expect((await upgrade.query("select id from electoral.vehicle_center_assignments where vehicle_id=$1", [createdVehicle])).rows).toHaveLength(1);
      expect((await upgrade.query("select id from electoral.vehicle_district_assignments where vehicle_id=$1", [createdVehicle])).rows).toHaveLength(1);
      await expect(upgrade.exec("update electoral.vehicles set active=false")).rejects.toThrow();
      await upgrade.exec("reset role; set role authenticated");
      await expect(upgrade.exec("select * from electoral.vehicles")).rejects.toThrow();
      await upgrade.exec("reset role");
      const policyNames = (await upgrade.query<{ tablename: string; cmd: string; roles: string[] }>("select tablename,cmd,roles from pg_policies where schemaname='electoral' and tablename=any($1)", [tables])).rows;
      expect(policyNames).toHaveLength(5);
      expect(policyNames.every(p => p.cmd === "SELECT" && p.roles.length === 1 && p.roles[0] === "electoral_app")).toBe(true);
    } finally { await upgrade.close(); }
  });
  it("consulta fichas, N:M, capacitación e historial con los repositorios reales", async () => {
    const scope: AccessContext = { userId: admin, organizationId: org, cantonId: canton, eventId: event, role: "admin", editableModules: [], organizationName: "Demo", cantonName: "Demo", eventName: "Demo", isDemo: true };
    await db.exec("set role electoral_app");
    try {
    const transport = await readTransport(scope);
    expect(transport.vehicles.length).toBeGreaterThan(0);
    expect(transport.vehicles.find(v => v.plate === "TEST-02")?.centerIds).toHaveLength(2);
    expect(transport.history.some(h => h.endedAt !== null)).toBe(true);
    const training = await readTraining(scope);
    expect(training.rows.find(r => r.positionId === position)).toMatchObject({ required: true, status: "pendiente" });
    expect(training.history.some(h => h.status === "cumplido")).toBe(true);
    expect((await readTransport({ ...scope, organizationId: foreign })).vehicles).toHaveLength(0);
    expect((await readTraining({ ...scope, organizationId: foreign })).rows).toHaveLength(0);
    expect((await readTransport({ ...scope, eventId: foreign })).history).toHaveLength(0);
    } finally { await db.exec("reset role"); }
  });
  it("Data API no lee tablas ni ejecuta funciones; runtime no escribe directamente", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      try {
        await expect(db.exec("select * from electoral.vehicles")).rejects.toThrow();
        await expect(configure()).rejects.toThrow();
        await expect(saveVehicle({ plate: "TEST-04" })).rejects.toThrow();
      } finally { await db.exec("reset role"); }
    }
    await db.exec("set role electoral_app");
    try {
      await expect(db.exec("update electoral.vehicles set active=false")).rejects.toThrow();
      await expect(db.exec("delete from electoral.training_progress")).rejects.toThrow();
      await expect(db.exec("update electoral.training_requirements set required=false")).rejects.toThrow();
    } finally { await db.exec("reset role"); }
  });
  it("fallo de auditoría revierte vehículos, relaciones, personas y configuración", async () => {
    const before = (await db.query("select id from electoral.people")).rows.length;
    const count = (await db.query("select id from electoral.training_requirements")).rows.length;
    const latest = (await db.query<{ id: string }>("select id from electoral.training_requirements order by revision desc limit 1")).rows[0].id;
    await db.exec("create function electoral.fail_operations_audit() returns trigger language plpgsql as $$ begin raise exception 'Fallo de auditoría'; end $$; create trigger fail_operations_audit before insert on electoral.audit_logs for each row execute function electoral.fail_operations_audit();");
    try {
      await expect(saveVehicle({ plate: "TEST-04", personId: null })).rejects.toThrow();
      await expect(configure(latest, false, null)).rejects.toThrow();
    } finally { await db.exec("drop trigger fail_operations_audit on electoral.audit_logs; drop function electoral.fail_operations_audit();"); }
    expect((await db.query("select id from electoral.people")).rows).toHaveLength(before);
    expect((await db.query("select id from electoral.vehicles where plate='TEST-04'")).rows).toHaveLength(0);
    expect((await db.query("select id from electoral.training_requirements")).rows).toHaveLength(count);
  });
});
