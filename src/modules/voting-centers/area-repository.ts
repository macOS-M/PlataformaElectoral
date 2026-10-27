import "server-only";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { centerElections, votingCenters, districts, functionalAreas, people, centerAreaAssignments, centerAreaDocuments } from "@/server/db/schema";
import type { AccessContext } from "@/server/authorization/context";
import type { z } from "zod";
import type { responsibleSchema } from "./area-schemas";

export async function readCenter(scope: AccessContext, id: string) {
  const [center] = await getDb().select({ id: centerElections.id, name: votingCenters.name, address: votingCenters.address, district: districts.name, status: centerElections.internalStatus })
    .from(centerElections).innerJoin(votingCenters, eq(votingCenters.id, centerElections.centerId)).innerJoin(districts, eq(districts.id, centerElections.districtId))
    .where(and(eq(centerElections.id, id), eq(centerElections.organizationId, scope.organizationId), eq(centerElections.cantonId, scope.cantonId), eq(centerElections.eventId, scope.eventId), isNull(votingCenters.archivedAt))).limit(1);
  return center ?? null;
}
export async function readCenterAreas(scope: AccessContext, centerId: string) {
  return getDb().select({ id: functionalAreas.id, code: functionalAreas.code, name: functionalAreas.name, assignmentId: centerAreaAssignments.id, responsible: people.fullName })
    .from(functionalAreas).leftJoin(centerAreaAssignments, and(eq(centerAreaAssignments.areaId, functionalAreas.id), eq(centerAreaAssignments.centerElectionId, centerId), eq(centerAreaAssignments.organizationId, scope.organizationId), isNull(centerAreaAssignments.endedAt)))
    .leftJoin(people, eq(people.id, centerAreaAssignments.personId))
    .where(and(eq(functionalAreas.organizationId, scope.organizationId), eq(functionalAreas.active, true))).orderBy(asc(functionalAreas.code));
}
export async function readAreaDetail(scope: AccessContext, centerId: string, areaId: string) {
  const db = getDb();
  const [history, directory, documents] = await Promise.all([
    db.select({ id: centerAreaAssignments.id, personId: people.id, fullName: people.fullName, startedAt: centerAreaAssignments.startedAt, endedAt: centerAreaAssignments.endedAt, reason: centerAreaAssignments.endedReason })
      .from(centerAreaAssignments).innerJoin(people, eq(people.id, centerAreaAssignments.personId))
      .where(and(eq(centerAreaAssignments.organizationId, scope.organizationId), eq(centerAreaAssignments.eventId, scope.eventId), eq(centerAreaAssignments.centerElectionId, centerId), eq(centerAreaAssignments.areaId, areaId))).orderBy(desc(centerAreaAssignments.startedAt)),
    db.select({ id: people.id, fullName: people.fullName, email: people.email, phone: people.phone, notes: people.notes, version: sql<string>`${people.updatedAt}::text` }).from(people).where(eq(people.organizationId, scope.organizationId)).orderBy(asc(people.fullName)),
    db.select({ id: centerAreaDocuments.id, filename: centerAreaDocuments.filename, category: centerAreaDocuments.category, byteSize: centerAreaDocuments.byteSize, createdAt: centerAreaDocuments.createdAt })
      .from(centerAreaDocuments).where(and(eq(centerAreaDocuments.organizationId, scope.organizationId), eq(centerAreaDocuments.eventId, scope.eventId), eq(centerAreaDocuments.centerElectionId, centerId), eq(centerAreaDocuments.areaId, areaId))).orderBy(desc(centerAreaDocuments.createdAt)),
  ]);
  return { history, directory, documents };
}
export async function saveAreaResponsible(scope: AccessContext, data: z.infer<typeof responsibleSchema>) {
  await getDb().execute(sql`select electoral.save_center_responsible(${scope.userId}::uuid,${scope.organizationId}::uuid,${scope.cantonId}::uuid,${scope.eventId}::uuid,${data.centerId}::uuid,${data.areaCode},${data.expectedId || null}::uuid,${data.personId || null}::uuid,${data.version},${data.fullName},${data.email},${data.phone},${data.notes},${data.reason})`);
}
export async function saveAreaDocument(scope: AccessContext, centerId: string, code: string, file: { path: string; name: string; category: string; mime: string; size: number }) {
  await getDb().execute(sql`select electoral.add_center_document(${scope.userId}::uuid,${scope.organizationId}::uuid,${scope.cantonId}::uuid,${scope.eventId}::uuid,${centerId}::uuid,${code},${file.path},${file.name},${file.category},${file.mime},${file.size})`);
}
export async function readAreaDocument(scope: AccessContext, centerId: string, areaId: string, documentId: string) {
  const [document] = await getDb().select().from(centerAreaDocuments).where(and(eq(centerAreaDocuments.id, documentId), eq(centerAreaDocuments.organizationId, scope.organizationId), eq(centerAreaDocuments.eventId, scope.eventId), eq(centerAreaDocuments.centerElectionId, centerId), eq(centerAreaDocuments.areaId, areaId))).limit(1);
  return document ?? null;
}
