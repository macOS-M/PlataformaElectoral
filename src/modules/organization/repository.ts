import "server-only";
import { and, eq, asc } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { positions, districts, functionalAreas } from "@/server/db/schema";
import type { AccessContext } from "@/server/authorization/context";
export async function readOrganization(scope: AccessContext) {
  const db = getDb();
  const [posts, territory, areas] = await Promise.all([
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
  ]);
  return { positions: posts, districts: territory, areas };
}
