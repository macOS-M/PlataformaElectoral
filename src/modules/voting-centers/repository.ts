import "server-only";
import { and, eq, ilike, or, asc, count, isNull, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { centerElections, votingCenters, districts } from "@/server/db/schema";
import type { AccessContext } from "@/server/authorization/context";
import { PAGE_SIZE, escapeLike, type CenterFilters } from "./schemas";
export async function readCenters(
  scope: AccessContext,
  filters: CenterFilters,
) {
  const db = getDb();
  const condition = and(
    eq(centerElections.organizationId, scope.organizationId),
    eq(centerElections.cantonId, scope.cantonId),
    eq(centerElections.eventId, scope.eventId),
    isNull(votingCenters.archivedAt),
    filters.district
      ? eq(centerElections.districtId, filters.district)
      : undefined,
    filters.status
      ? eq(centerElections.internalStatus, filters.status)
      : undefined,
    filters.q
      ? or(
          ilike(votingCenters.name, `%${escapeLike(filters.q)}%`),
          ilike(centerElections.tseCode, `%${escapeLike(filters.q)}%`),
        )
      : undefined,
  );
  const [total] = await db
    .select({ value: count() })
    .from(centerElections)
    .innerJoin(votingCenters, eq(votingCenters.id, centerElections.centerId))
    .where(condition);
  const totalPages = Math.max(1, Math.ceil(total.value / PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const rows = await db
    .select({
      id: centerElections.id,
      name: votingCenters.name,
      address: votingCenters.address,
      district: districts.name,
      code: centerElections.tseCode,
      status: centerElections.internalStatus,
      source: centerElections.dataSource,
      sourceReference: centerElections.sourceReference,
      boards: centerElections.reportedBoardCount,
    })
    .from(centerElections)
    .innerJoin(votingCenters, eq(votingCenters.id, centerElections.centerId))
    .innerJoin(districts, eq(districts.id, centerElections.districtId))
    .where(condition)
    .orderBy(asc(votingCenters.name), asc(centerElections.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);
  return { rows, total: total.value, totalPages, page };
}

export async function createCenter(scope: AccessContext, input: { name: string; address: string; districtId: string }) {
  await getDb().execute(sql`select electoral.create_center(${scope.userId}::uuid, ${scope.organizationId}::uuid, ${scope.cantonId}::uuid, ${scope.eventId}::uuid, ${input.districtId}::uuid, ${input.name}, ${input.address})`);
}
