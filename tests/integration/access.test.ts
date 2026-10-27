import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { readFile } from "node:fs/promises";
const db = new PGlite();
const org = "10000000-0000-4000-8000-000000000001",
  canton = "20000000-0000-4000-8000-000000000001",
  admin = "80000000-0000-4000-8000-000000000001",
  user = "80000000-0000-4000-8000-000000000002",
  token = "90000000-0000-4000-8000-000000000001";
const hash = "a".repeat(64);
let code = "b".repeat(64);
let invite: string;
async function can(module: string, actor = user) {
  return (
    await db.query<{ allowed: boolean }>(
      "select electoral.can_edit_module($1,$2,$3,$4) as allowed",
      [actor, org, canton, module],
    )
  ).rows[0].allowed;
}
beforeAll(async () => {
  await db.exec(
    "create schema auth;create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb, raw_user_meta_data jsonb, deleted_at timestamptz, banned_until timestamptz);create role anon;create role authenticated;",
  );
  await migrate(drizzle(db), { migrationsFolder: "src/server/db/migrations" });
  await db.exec(await readFile("src/server/db/seeds/demo.sql", "utf8"));
  await db.query("insert into auth.users(id) values($1)", [admin]);
  await db.query(
    "insert into electoral.organization_memberships(organization_id,user_id,role) values($1,$2,'admin')",
    [org, admin],
  );
});
afterAll(() => db.close());
describe("Autorizaciones, registro atómico y permisos", () => {
  it("solo el administrador global autoriza y no expone hashes ni códigos", async () => {
    invite = (
      await db.query<{ id: string }>(
        "select electoral.authorize_registration($1,$2,$3,$4,'0000',$5,'member',ARRAY[]::text[]) as id",
        [admin, org, canton, hash, code],
      )
    ).rows[0].id;
    await expect(
      db.query(
        "select electoral.authorize_registration($1,$2,$3,$4,'0000',$5,'admin',ARRAY[]::text[])",
        [user, org, canton, "c".repeat(64), code],
      ),
    ).rejects.toThrow();
    await db.exec("set role electoral_app");
    try {
      await expect(
        db.exec("select * from electoral.registration_authorizations"),
      ).rejects.toThrow();
      const rows = (
        await db.query("select * from electoral.list_access($1,$2,$3)", [
          admin,
          org,
          canton,
        ])
      ).rows;
      expect(rows.length).toBe(2);
      expect(rows[0]).not.toHaveProperty("identifier_hash");
      expect(rows[0]).not.toHaveProperty("activation_hash");
    } finally {
      await db.exec("reset role");
    }
  });
  it("renueva el código pendiente e invalida el anterior", async () => {
    const previous = code;
    code = "e".repeat(64);
    await db.query("select electoral.renew_activation($1,$2,$3,$4,$5)", [
      admin,
      org,
      canton,
      invite,
      code,
    ]);
    expect(
      (
        await db.query<{ id: string | null }>(
          "select electoral.registration_claim($1,$2,$3,$4) as id",
          [hash, previous, org, token],
        )
      ).rows[0].id,
    ).toBeNull();
  });
  it("requiere código correcto y reserva una sola inscripción simultánea", async () => {
    expect(
      (
        await db.query<{ id: string | null }>(
          "select electoral.registration_claim($1,$2,$3,$4) as id",
          [hash, "c".repeat(64), org, token],
        )
      ).rows[0].id,
    ).toBeNull();
    expect(
      (
        await db.query<{ id: string }>(
          "select electoral.registration_claim($1,$2,$3,$4) as id",
          [hash, code, org, token],
        )
      ).rows[0].id,
    ).toBe(invite);
    expect(
      (
        await db.query<{ id: string | null }>(
          "select electoral.registration_claim($1,$2,$3,$4) as id",
          [hash, code, org, "90000000-0000-4000-8000-000000000002"],
        )
      ).rows[0].id,
    ).toBeNull();
  });
  it("consume autorización y crea membresía junto con el usuario de Auth", async () => {
    await expect(
      db.query(
        "insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3::jsonb)",
        [
          user,
          invite + "@accounts.cantonal.invalid",
          JSON.stringify({
            electoral_invitation: invite,
            electoral_claim: "90000000-0000-4000-8000-000000000002",
          }),
        ],
      ),
    ).rejects.toThrow();
    expect(
      (await db.query("select id from auth.users where id=$1", [user])).rows,
    ).toHaveLength(0);
    // GoTrue crea primero el usuario y actualiza app_metadata después.
    await db.query(
      "insert into auth.users(id,email,raw_app_meta_data) values($1,$2,'{}'::jsonb)",
      [user, invite + "@accounts.cantonal.invalid"],
    );
    await db.query(
      "update auth.users set raw_app_meta_data=$2::jsonb where id=$1",
      [
        user,
        JSON.stringify({
          electoral_invitation: invite,
          electoral_claim: token,
        }),
      ],
    );
    await db.query(
      "update auth.users set raw_app_meta_data=raw_app_meta_data || $2::jsonb where id=$1",
      [user, JSON.stringify({ provider: "email" })],
    );
    expect(
      (
        await db.query<{ role: string }>(
          "select role from electoral.organization_memberships where user_id=$1",
          [user],
        )
      ).rows[0].role,
    ).toBe("member");
    expect(await can("organigrama")).toBe(false);
    expect(
      (
        await db.query<{ id: string | null }>(
          "select electoral.registration_claim($1,$2,$3,$4) as id",
          [hash, code, org, token],
        )
      ).rows[0].id,
    ).toBeNull();
  });
  it("permite al coordinador de área editar solo sus responsables", async () => {
    await db.query(
      "select electoral.manage_access($1,$2,$3,$4,'member',ARRAY['A05'],true)",
      [admin, org, canton, invite],
    );
    const person = (
      await db.query<{ person_id: string }>(
        "select person_id from electoral.user_people where organization_id=$1 and user_id=$2",
        [org, user],
      )
    ).rows[0].person_id;
    const positions = (
      await db.query<{ id: string; code: string }>(
        "select id,code from electoral.organizational_positions where code in ('A05','A06') and canton_id=$1",
        [canton],
      )
    ).rows;
    const transport = positions.find((p) => p.code === "A05")!.id,
      food = positions.find((p) => p.code === "A06")!.id;
    await db.query("select electoral.set_responsible($1,$2,$3,$4,$5,null,'')", [
      user,
      org,
      canton,
      transport,
      person,
    ]);
    await expect(
      db.query("select electoral.set_responsible($1,$2,$3,$4,$5,null,'')", [
        user,
        org,
        canton,
        food,
        person,
      ]),
    ).rejects.toThrow();
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select electoral.can_edit_person($1,$2,$3,$4) as allowed",
          [user, org, canton, person],
        )
      ).rows[0].allowed,
    ).toBe(true);
    await db.query("select electoral.set_responsible($1,$2,$3,$4,$5,null,'')", [
      admin,
      org,
      canton,
      food,
      person,
    ]);
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select electoral.can_edit_person($1,$2,$3,$4) as allowed",
          [user, org, canton, person],
        )
      ).rows[0].allowed,
    ).toBe(false);
  });
  it("coordinación distrital edita todo sin administrar accesos; revocar permisos es inmediato", async () => {
    await db.query(
      "select electoral.manage_access($1,$2,$3,$4,'member',ARRAY['district'],true)",
      [admin, org, canton, invite],
    );
    for (const m of ["organigrama", "centros", "A01", "A09"])
      expect(await can(m)).toBe(true);
    await expect(
      db.query(
        "select electoral.manage_access($1,$2,$3,$4,'admin',ARRAY[]::text[],true)",
        [user, org, canton, invite],
      ),
    ).rejects.toThrow();
    await db.query(
      "select electoral.manage_access($1,$2,$3,$4,'member',ARRAY[]::text[],true)",
      [admin, org, canton, invite],
    );
    expect(await can("A05")).toBe(false);
    await db.query(
      "select electoral.manage_access($1,$2,$3,$4,'member',ARRAY[]::text[],false)",
      [admin, org, canton, invite],
    );
    expect(
      (
        await db.query<{ alias: string | null }>(
          "select electoral.auth_alias($1,$2) as alias",
          [hash, org],
        )
      ).rows[0].alias,
    ).toBeNull();
  });
  it("actualiza solo el nombre y exige administración y cédula de la cuenta", async () => {
    await expect(
      db.query(
        "select electoral.refresh_user_name($1,$2,$3,$4,$5,'Nombre sintético')",
        [user, org, canton, invite, hash],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.query(
        "select electoral.refresh_user_name($1,$2,$3,$4,$5,'Nombre sintético')",
        [admin, org, canton, invite, "f".repeat(64)],
      ),
    ).rejects.toMatchObject({ code: "22023" });
    await db.query(
      "select electoral.refresh_user_name($1,$2,$3,$4,$5,'Nombre sintético consultado')",
      [admin, org, canton, invite, hash],
    );
    const result = await db.query<{
      full_name: string;
      role: string;
      active: boolean;
    }>(
      "select p.full_name,m.role,m.active from electoral.people p join electoral.user_people up on up.person_id=p.id join electoral.organization_memberships m on m.organization_id=up.organization_id and m.user_id=up.user_id where up.user_id=$1",
      [user],
    );
    expect(result.rows[0]).toEqual({
      full_name: "Nombre sintético consultado",
      role: "member",
      active: false,
    });
    const logs = await db.query(
      "select before_json,after_json from electoral.audit_logs where action='name_from_soportereal'",
    );
    expect(logs.rows).toEqual([{ before_json: null, after_json: null }]);
  });
  it("impide deshabilitar o degradar al último administrador", async () => {
    await expect(
      db.query(
        "select electoral.manage_access($1,$2,$3,$1,'member',ARRAY[]::text[],true)",
        [admin, org, canton],
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        "select electoral.manage_access($1,$2,$3,$1,'admin',ARRAY[]::text[],false)",
        [admin, org, canton],
      ),
    ).rejects.toThrow();
  });
  it("limita intentos persistentemente y bloquea invocación desde Data API", async () => {
    for (let i = 0; i < 3; i++)
      expect(
        (
          await db.query<{ allowed: boolean }>(
            "select electoral.check_auth_rate($1,2,900) as allowed",
            ["d".repeat(64)],
          )
        ).rows[0].allowed,
      ).toBe(i < 2);
    for (const role of ["anon", "authenticated"]) {
      await db.exec("set role " + role);
      try {
        await expect(
          db.query("select electoral.registration_claim($1,$2,$3,$4)", [
            hash,
            code,
            org,
            token,
          ]),
        ).rejects.toThrow();
      } finally {
        await db.exec("reset role");
      }
    }
  });
});
