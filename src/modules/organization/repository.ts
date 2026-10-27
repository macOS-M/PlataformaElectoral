import "server-only";
import { and, eq, asc, desc, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import {
  positions,
  districts,
  functionalAreas,
  people,
  assignments,
} from "@/server/db/schema";
import type { AccessContext } from "@/server/authorization/context";
export async function readOrganization(scope: AccessContext) {
  const db = getDb();
  const [posts, territory, areas, directory, history] = await Promise.all([
    db
      .select()
      .from(positions)
      .where(
        and(
          eq(positions.organizationId, scope.organizationId),
          eq(positions.cantonId, scope.cantonId),
          eq(positions.active, true),
        ),
      )
      .orderBy(asc(positions.code)),
    db
      .select()
      .from(districts)
      .where(
        and(eq(districts.cantonId, scope.cantonId), eq(districts.active, true)),
      )
      .orderBy(asc(districts.name)),
    db
      .select()
      .from(functionalAreas)
      .where(
        and(
          eq(functionalAreas.organizationId, scope.organizationId),
          eq(functionalAreas.active, true),
        ),
      )
      .orderBy(asc(functionalAreas.code)),
    db
      .select({
        id: people.id,
        fullName: people.fullName,
        email: people.email,
        phone: people.phone,
        assignable: sql<boolean>`electoral.assignable_person(${scope.organizationId}::uuid, ${people.id})`,
      })
      .from(people)
      .where(eq(people.organizationId, scope.organizationId))
      .orderBy(asc(people.fullName), asc(people.id)),
    db
      .select({
        id: assignments.id,
        positionId: assignments.positionId,
        personId: assignments.personId,
        fullName: people.fullName,
        startedAt: assignments.startedAt,
        endedAt: assignments.endedAt,
        endedReason: assignments.endedReason,
      })
      .from(assignments)
      .innerJoin(
        people,
        and(
          eq(people.id, assignments.personId),
          eq(people.organizationId, assignments.organizationId),
        ),
      )
      .where(
        and(
          eq(assignments.organizationId, scope.organizationId),
          eq(assignments.cantonId, scope.cantonId),
        ),
      )
      .orderBy(desc(assignments.startedAt)),
  ]);
  return {
    positions: posts,
    districts: territory,
    areas,
    people: directory,
    assignments: history,
  };
}

export async function savePerson(
  scope: AccessContext,
  data: import("./schemas").PersonInput,
) {
  return getDb().execute(
    sql`select electoral.save_person(${scope.userId}::uuid, ${scope.organizationId}::uuid, ${scope.cantonId}::uuid, ${data.id || null}::uuid, ${data.version || null}, ${data.fullName}, ${data.email}, ${data.phone}, ${data.notes})`,
  );
}
export async function setResponsible(
  scope: AccessContext,
  data: import("./schemas").AssignmentInput,
) {
  return getDb().execute(
    sql`select electoral.set_responsible(${scope.userId}::uuid, ${scope.organizationId}::uuid, ${scope.cantonId}::uuid, ${data.positionId}::uuid, ${data.personId || null}::uuid, ${data.expectedId || null}::uuid, ${data.reason})`,
  );
}
