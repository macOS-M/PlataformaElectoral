import "server-only";
import { userPeople, people } from "@/server/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import type { AccessContext } from "@/server/authorization/context";
export type AccessRow = {
  fullName: string | null;
  id: string;
  hint: string;
  role: "admin" | "member";
  modules: string[];
  user_id: string | null;
  active: boolean;
  created_at: string;
};
export async function readAccess(scope: AccessContext) {
  const rows = await getDb().execute<Omit<AccessRow, "fullName">>(
    sql`select * from electoral.list_access(${scope.userId}::uuid,${scope.organizationId}::uuid,${scope.cantonId}::uuid)`,
  );
  const names = await getDb()
    .select({ userId: userPeople.userId, fullName: people.fullName })
    .from(userPeople)
    .innerJoin(
      people,
      and(
        eq(people.id, userPeople.personId),
        eq(people.organizationId, userPeople.organizationId),
      ),
    )
    .where(eq(userPeople.organizationId, scope.organizationId));
  const byUser = new Map(
    names.map((person) => [person.userId, person.fullName]),
  );
  return rows.map((row) => ({
    ...row,
    fullName: row.user_id ? (byUser.get(row.user_id) ?? null) : null,
  }));
}
export async function authorize(
  scope: AccessContext,
  data: {
    hash: string;
    hint: string;
    activation: string | null;
    role: string;
    modules: string[];
  },
) {
  await getDb().execute(
    sql`select electoral.authorize_registration(${scope.userId}::uuid,${scope.organizationId}::uuid,${scope.cantonId}::uuid,${data.hash},${data.hint},${data.activation},${data.role},ARRAY(select jsonb_array_elements_text(${JSON.stringify(data.modules)}::jsonb)))`,
  );
}
export async function changeAccess(
  scope: AccessContext,
  data: { id: string; role: string; modules: string[]; active: boolean },
) {
  await getDb().execute(
    sql`select electoral.manage_access(${scope.userId}::uuid,${scope.organizationId}::uuid,${scope.cantonId}::uuid,${data.id}::uuid,${data.role},ARRAY(select jsonb_array_elements_text(${JSON.stringify(data.modules)}::jsonb)),${data.active})`,
  );
}
export async function claimRegistration(
  hash: string,
  activation: string,
  org: string,
  token: string,
) {
  const rows = await getDb().execute<{ id: string | null }>(
    sql`select electoral.registration_claim(${hash},${activation},${org}::uuid,${token}::uuid) as id`,
  );
  return rows[0]?.id ?? null;
}
export async function releaseRegistration(id: string, token: string) {
  await getDb().execute(
    sql`select electoral.release_registration(${id}::uuid,${token}::uuid)`,
  );
}
export async function getAlias(hash: string, org: string) {
  const rows = await getDb().execute<{ alias: string | null }>(
    sql`select electoral.auth_alias(${hash},${org}::uuid) as alias`,
  );
  return rows[0]?.alias ?? null;
}
export async function checkRate(key: string, max: number, seconds: number) {
  const rows = await getDb().execute<{ allowed: boolean }>(
    sql`select electoral.check_auth_rate(${key},${max},${seconds}) as allowed`,
  );
  return rows[0]?.allowed === true;
}

export async function renewActivation(
  scope: AccessContext,
  id: string,
  hash: string,
) {
  await getDb().execute(
    sql`select electoral.renew_activation(${scope.userId}::uuid,${scope.organizationId}::uuid,${scope.cantonId}::uuid,${id}::uuid,${hash})`,
  );
}

export async function nameRefreshTarget(
  scope: AccessContext,
  id: string,
  hash: string,
) {
  const rows = await getDb().execute<{ id: string }>(
    sql`select electoral.name_refresh_target(${scope.userId}::uuid,${scope.organizationId}::uuid,${scope.cantonId}::uuid,${id}::uuid,${hash}) as id`,
  );
  return rows[0].id;
}
export async function saveRefreshedName(
  scope: AccessContext,
  id: string,
  hash: string,
  name: string,
) {
  await getDb().execute(
    sql`select electoral.refresh_user_name(${scope.userId}::uuid,${scope.organizationId}::uuid,${scope.cantonId}::uuid,${id}::uuid,${hash},${name})`,
  );
}
