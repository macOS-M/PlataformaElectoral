import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { readFile } from "node:fs/promises";
import { readCenters } from "@/modules/voting-centers/repository";
import { readOrganization } from "@/modules/organization/repository";
import { centerFiltersSchema } from "@/modules/voting-centers/schemas";
vi.mock("server-only", () => ({}));
vi.mock("@/server/db/client", () => ({ getDb: () => drizzle(db) }));
const db = new PGlite();
const organization = "10000000-0000-4000-8000-000000000001";
const scope = {
  userId: "80000000-0000-4000-8000-000000000001",
  organizationId: organization,
  cantonId: "20000000-0000-4000-8000-000000000001",
  eventId: "30000000-0000-4000-8000-000000000001",
  organizationName: "Demo",
  cantonName: "Demo",
  eventName: "Demo",
  isDemo: true,
};
beforeAll(async () => {
  await db.exec(
    "CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY); CREATE ROLE anon; CREATE ROLE authenticated;",
  );
  await migrate(drizzle(db), { migrationsFolder: "src/server/db/migrations" });
  await db.exec(await readFile("src/server/db/seeds/demo.sql", "utf8"));
});
afterAll(async () => {
  await db.close();
});
describe("Migraciones PostgreSQL (PGlite) y catálogo", () => {
  it("aplica migraciones repetidamente y no duplica la semilla", async () => {
    await migrate(drizzle(db), {
      migrationsFolder: "src/server/db/migrations",
    });
    await db.exec(await readFile("src/server/db/seeds/demo.sql", "utf8"));
    expect(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from electoral.voting_centers",
        )
      ).rows[0].n,
    ).toBe(70);
    expect(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from electoral.organizational_positions",
        )
      ).rows[0].n,
    ).toBe(15);
  });
  it("no inventa códigos TSE ni JRV ni ratificaciones", async () => {
    expect(
      (
        await db.query(
          "select id from electoral.center_elections where tse_code is not null or reported_board_count is not null or official_status <> 'sin_verificar'",
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("rechaza coordinación general duplicada", async () => {
    await expect(
      db.exec(
        `insert into electoral.organizational_positions (organization_id,canton_id,code,name,kind) values ('${organization}','20000000-0000-4000-8000-000000000001','OTRO','Otra','general')`,
      ),
    ).rejects.toThrow();
  });
  it("rechaza cargos distritales sin distrito", async () => {
    await expect(
      db.exec(
        `insert into electoral.organizational_positions (organization_id,canton_id,code,name,kind) values ('${organization}','20000000-0000-4000-8000-000000000001','INVALIDO','Otro','district')`,
      ),
    ).rejects.toThrow();
  });
  it("rechaza distritos de otro cantón", async () => {
    await db.exec(
      "insert into electoral.cantons (id,name) values ('20000000-0000-4000-8000-000000000002','Otro'); insert into electoral.districts (id,canton_id,name) values ('60000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','Otro');",
    );
    await expect(
      db.exec(
        "update electoral.center_elections set district_id='60000000-0000-4000-8000-000000000002' where id=md5('demo-center-event-1')::uuid",
      ),
    ).rejects.toThrow();
  });
  it("rechaza referencias a centros de otra organización", async () => {
    await db.exec(
      "insert into electoral.organizations(id,name) values ('10000000-0000-4000-8000-000000000002','Otra'); insert into electoral.voting_centers(id,organization_id,name,address) values ('70000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Otro','Dirección');",
    );
    await expect(
      db.exec(
        "update electoral.center_elections set center_id='70000000-0000-4000-8000-000000000002' where id=md5('demo-center-event-1')::uuid",
      ),
    ).rejects.toThrow();
  });
  it("rechaza códigos oficiales en un centro de demostración", async () => {
    await expect(
      db.exec(
        "update electoral.center_elections set tse_code='001' where id=md5('demo-center-event-1')::uuid",
      ),
    ).rejects.toThrow();
  });
  it("rechaza coordenadas incompletas y fuera de rango", async () => {
    await expect(
      db.exec(
        "update electoral.voting_centers set latitude=100,longitude=0 where id=md5('demo-center-1')::uuid",
      ),
    ).rejects.toThrow();
    await expect(
      db.exec(
        "update electoral.voting_centers set latitude=10 where id=md5('demo-center-1')::uuid",
      ),
    ).rejects.toThrow();
  });
  it("rechaza un usuario Auth inexistente", async () => {
    await expect(
      db.exec(
        `insert into electoral.organization_memberships(organization_id,user_id) values ('${organization}','80000000-0000-4000-8000-000000000001')`,
      ),
    ).rejects.toThrow();
  });
  it("impide ciclos en el organigrama", async () => {
    await expect(
      db.exec(
        "update electoral.organizational_positions set parent_position_id=md5('demo-position-district-1')::uuid where id='40000000-0000-4000-8000-000000000001'",
      ),
    ).rejects.toThrow();
  });
  it("bloquea lectura directa de roles API y escritura/auditoría del rol de ejecución", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      try {
        await expect(
          db.exec("select * from electoral.voting_centers"),
        ).rejects.toThrow();
      } finally {
        await db.exec("reset role");
      }
    }
    await db.exec("set role electoral_app");
    try {
      expect(
        (await db.query("select id from electoral.center_elections")).rows,
      ).toHaveLength(70);
      await expect(
        db.exec("delete from electoral.audit_logs"),
      ).rejects.toThrow();
      await expect(
        db.exec("update electoral.organizations set name='Cambio'"),
      ).rejects.toThrow();
    } finally {
      await db.exec("reset role");
    }
  });
  it("consulta la estructura y pagina centros con filtros del distrito persistido", async () => {
    const org = await readOrganization(scope);
    expect(org.districts).toHaveLength(5);
    expect(org.areas).toHaveLength(9);
    const filters = centerFiltersSchema.parse({
      district: org.districts[0].id,
    });
    const first = await readCenters(scope, filters);
    expect(first.total).toBe(14);
    expect(first.rows).toHaveLength(12);
    const second = await readCenters(scope, { ...filters, page: 2 });
    expect(second.rows).toHaveLength(2);
    expect(
      first.rows.some((row) =>
        second.rows.some((other) => other.id === row.id),
      ),
    ).toBe(false);
  });
  it("no devuelve centros al consultar otro ámbito organizacional", async () => {
    const result = await readCenters(
      { ...scope, organizationId: "10000000-0000-4000-8000-000000000002" },
      centerFiltersSchema.parse({}),
    );
    expect(result.total).toBe(0);
    expect(result.rows).toHaveLength(0);
  });
  it("busca por nombre, restringe estado y ajusta páginas fuera del total", async () => {
    expect(
      (
        await readCenters(
          scope,
          centerFiltersSchema.parse({ q: "demostración 01" }),
        )
      ).total,
    ).toBe(1);
    expect(
      (
        await readCenters(
          scope,
          centerFiltersSchema.parse({ status: "validado" }),
        )
      ).total,
    ).toBe(0);
    expect(
      (await readCenters(scope, centerFiltersSchema.parse({ q: "%" }))).total,
    ).toBe(0);
    expect(
      (await readCenters(scope, centerFiltersSchema.parse({ page: "9000" })))
        .page,
    ).toBe(6);
  });
  it("aplica unicidad de código oficial dentro del evento sin impedir reutilizarlo en otro", async () => {
    await db.exec(
      `insert into electoral.election_events(id,organization_id,name) values ('30000000-0000-4000-8000-000000000002','${organization}','Evento de prueba'), ('30000000-0000-4000-8000-000000000003','${organization}','Otro evento de prueba')`,
    );
    const insert = (event: number, center: number) =>
      db.exec(
        `insert into electoral.center_elections(organization_id,center_id,event_id,canton_id,district_id,tse_code,data_source) values ('${organization}',md5('demo-center-${center}')::uuid,'30000000-0000-4000-8000-00000000000${event}','${scope.cantonId}',md5('demo-district-1')::uuid,'CODIGO-PRUEBA','manual')`,
      );
    await insert(2, 1);
    await expect(insert(2, 2)).rejects.toThrow();
    await insert(3, 1);
  });
});
