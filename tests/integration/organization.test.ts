import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { readFile } from "node:fs/promises";
const db = new PGlite();
const org = "10000000-0000-4000-8000-000000000001";
const canton = "20000000-0000-4000-8000-000000000001";
const actor = "80000000-0000-4000-8000-000000000001";
const position = "40000000-0000-4000-8000-000000000001";
let person: string;
async function save(id: string | null = null, version: string | null = null) {
  const r = await db.query<{ id: string }>(
    "select electoral.save_person($1,$2,$3,$4,$5,'Persona sintética','','','') as id",
    [actor, org, canton, id, version],
  );
  return r.rows[0].id;
}
async function registeredPerson() {
  const user = randomUUID();
  await db.query("insert into auth.users(id) values($1)", [user]);
  await db.query(
    "insert into electoral.organization_memberships(organization_id,user_id,role) values($1,$2,'member')",
    [org, user],
  );
  return (
    await db.query<{ person_id: string }>(
      "select person_id from electoral.user_people where organization_id=$1 and user_id=$2",
      [org, user],
    )
  ).rows[0].person_id;
}
async function assign(
  personId: string | null,
  expected: string | null = null,
  reason = "",
) {
  return db.query("select electoral.set_responsible($1,$2,$3,$4,$5,$6,$7)", [
    actor,
    org,
    canton,
    position,
    personId,
    expected,
    reason,
  ]);
}
beforeAll(async () => {
  await db.exec(
    "create schema auth; create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb, raw_user_meta_data jsonb, deleted_at timestamptz, banned_until timestamptz); create role anon; create role authenticated;",
  );
  await migrate(drizzle(db), { migrationsFolder: "src/server/db/migrations" });
  await db.exec(await readFile("src/server/db/seeds/demo.sql", "utf8"));
  await db.query("insert into auth.users(id) values ($1)", [actor]);
  await db.query(
    "insert into electoral.organization_memberships(organization_id,user_id,role) values($1,$2,'admin')",
    [org, actor],
  );
});
afterAll(() => db.close());
describe("Personas y responsables con permisos controlados", () => {
  it("permite registrar con rol de ejecución sin conceder escritura directa ni API", async () => {
    await db.exec("set role electoral_app");
    try {
      person = await save();
      await expect(
        db.exec("update electoral.people set full_name='Cambio'"),
      ).rejects.toThrow();
      await expect(
        db.exec(
          "insert into electoral.audit_logs(organization_id,entity,action) values ('" +
            org +
            "','x','x')",
        ),
      ).rejects.toThrow();
    } finally {
      await db.exec("reset role");
    }
    for (const role of ["anon", "authenticated"]) {
      await db.exec("set role " + role);
      try {
        await expect(save()).rejects.toThrow();
        await expect(
          db.exec("select * from electoral.people"),
        ).rejects.toThrow();
      } finally {
        await db.exec("reset role");
      }
    }
  });
  it("rechaza versión obsoleta y conserva contactos fuera de auditoría", async () => {
    const r = await db.query<{ version: string }>(
      "select updated_at::text as version from electoral.people where id=$1",
      [person],
    );
    await save(person, r.rows[0].version);
    await expect(save(person, r.rows[0].version)).rejects.toThrow();
    const logs = await db.query(
      "select * from electoral.audit_logs where entity='people' and (before_json is not null or after_json is not null)",
    );
    expect(logs.rows).toHaveLength(0);
  });
  it("asigna una persona a varios cargos sin duplicarla y rechaza solicitudes obsoletas", async () => {
    person = await registeredPerson();
    await assign(person);
    const current = await db.query<{ id: string }>(
      "select id from electoral.organizational_assignments where position_id=$1 and ended_at is null",
      [position],
    );
    const other = await registeredPerson();
    await expect(assign(other)).rejects.toThrow();
    await db.query(
      "select electoral.set_responsible($1,$2,$3,md5('demo-position-district-1')::uuid,$4,null,'')",
      [actor, org, canton, person],
    );
    expect(
      (
        await db.query(
          "select id from electoral.organizational_assignments where person_id=$1 and ended_at is null",
          [person],
        )
      ).rows,
    ).toHaveLength(2);
    await expect(assign(other, current.rows[0].id, "")).rejects.toThrow();
    await assign(other, current.rows[0].id, "Cambio de coordinación");
    expect(
      (
        await db.query(
          "select * from electoral.organizational_assignments where position_id=$1",
          [position],
        )
      ).rows,
    ).toHaveLength(2);
    const next = await db.query<{ id: string }>(
      "select id from electoral.organizational_assignments where position_id=$1 and ended_at is null",
      [position],
    );
    await assign(null, next.rows[0].id, "Finaliza responsabilidad");
    expect(
      (
        await db.query(
          "select id from electoral.organizational_assignments where position_id=$1 and ended_at is null",
          [position],
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("rechaza dos ocupaciones vigentes incluso mediante SQL administrativo", async () => {
    await assign(person);
    await expect(
      db.query(
        "insert into electoral.organizational_assignments(organization_id,canton_id,position_id,person_id,created_by) values($1,$2,$3,$4,$5)",
        [org, canton, position, person, actor],
      ),
    ).rejects.toThrow();
  });
  it("rechaza membresía revocada, personas y puestos ajenos al ámbito", async () => {
    await db.query(
      "update electoral.organization_memberships set active=false where user_id=$1",
      [actor],
    );
    await expect(save()).rejects.toThrow();
    await expect(assign(person)).rejects.toThrow();
    await db.query(
      "update electoral.organization_memberships set active=true where user_id=$1",
      [actor],
    );
    await db.exec(
      "insert into electoral.organizations(id,name) values('10000000-0000-4000-8000-000000000002','Otra'); insert into electoral.people(id,organization_id,full_name) values('90000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Otra persona');",
    );
    await expect(
      db.query(
        "select electoral.set_responsible($1,$2,$3,md5('demo-position-district-2')::uuid,'90000000-0000-4000-8000-000000000001',null,'')",
        [actor, org, canton],
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        "select electoral.set_responsible($1,$2,'20000000-0000-4000-8000-000000000002',$3,$4,null,'')",
        [actor, org, position, person],
      ),
    ).rejects.toThrow();
  });
  it("solo ofrece y asigna cuentas con acceso activo, no fichas manuales", async () => {
    const manual = await save();
    const eligible = await registeredPerson();
    const allowed = async (id: string) =>
      (
        await db.query<{ allowed: boolean }>(
          "select electoral.assignable_person($1,$2) as allowed",
          [org, id],
        )
      ).rows[0].allowed;
    expect(await allowed(manual)).toBe(false);
    expect(await allowed(eligible)).toBe(true);
    const position = (
      await db.query<{ id: string }>(
        "select id from electoral.organizational_positions where code='A09' and canton_id=$1",
        [canton],
      )
    ).rows[0].id;
    await expect(
      db.query("select electoral.set_responsible($1,$2,$3,$4,$5,null,'')", [
        actor,
        org,
        canton,
        position,
        manual,
      ]),
    ).rejects.toMatchObject({ code: "22023" });
    const account = (
      await db.query<{ user_id: string }>(
        "select user_id from electoral.user_people where organization_id=$1 and person_id=$2",
        [org, eligible],
      )
    ).rows[0].user_id;
    await db.query(
      "update electoral.organization_memberships set active=false where user_id=$1",
      [account],
    );
    expect(await allowed(eligible)).toBe(false);
    await expect(
      db.query("select electoral.set_responsible($1,$2,$3,$4,$5,null,'')", [
        actor,
        org,
        canton,
        position,
        eligible,
      ]),
    ).rejects.toMatchObject({ code: "22023" });
    await db.query(
      "update electoral.organization_memberships set active=true where user_id=$1",
      [account],
    );
    await db.query(
      "update auth.users set banned_until=now()+interval '1 hour' where id=$1",
      [account],
    );
    expect(await allowed(eligible)).toBe(false);
    await db.query("update auth.users set banned_until=null where id=$1", [
      account,
    ]);
    expect(await allowed(eligible)).toBe(true);
    expect(
      (
        await db.query(
          "select person_id from electoral.user_people where organization_id=$1 and user_id=$2",
          [org, account],
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("revierte cambios si falla el registro de auditoría", async () => {
    const before = await db.query("select id from electoral.people");
    await db.exec(
      "create function electoral.test_fail_audit() returns trigger language plpgsql as $$ begin raise exception 'test rollback'; end $$; create trigger fail_audit before insert on electoral.audit_logs for each row execute function electoral.test_fail_audit();",
    );
    try {
      await expect(save()).rejects.toThrow();
      expect(
        (await db.query("select id from electoral.people")).rows,
      ).toHaveLength(before.rows.length);
    } finally {
      await db.exec(
        "drop trigger fail_audit on electoral.audit_logs; drop function electoral.test_fail_audit();",
      );
    }
  });
});
