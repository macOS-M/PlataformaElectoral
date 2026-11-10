import "server-only";
import { and, asc, eq, or, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { cantons, districts, organizations, organizationCantons, provinces } from "@/server/db/schema";
import type { PublicCanton } from "./types";

// Public projection: no membership, person, vehicle, center or contact data.
export async function readPublicTerritories(organizationId: string, cantonId: string, eventId?: string): Promise<PublicCanton[]> {
  const rows = await getDb().select({
    id: cantons.id, name: cantons.name,
    provinceId: provinces.id, provinceName: provinces.name,
    districtId: districts.id, districtName: districts.name,
  }).from(organizationCantons)
    .innerJoin(organizations, eq(organizations.id, organizationCantons.organizationId))
    .innerJoin(cantons, eq(cantons.id, organizationCantons.cantonId))
    .leftJoin(provinces, eq(provinces.id, cantons.provinceId))
    .leftJoin(districts, and(eq(districts.cantonId, cantons.id), eq(districts.active, true)))
    .where(and(
      eq(organizationCantons.organizationId, organizationId),
      // Solo el catálogo de un evento demo puede navegar otros cantones vinculados.
      // Esto no cambia el ámbito de autorización de los módulos operativos.
      or(eq(organizationCantons.cantonId, cantonId), eventId
        ? sql`exists(select 1 from electoral.election_events e where e.id=${eventId}::uuid and e.organization_id=${organizationId}::uuid and e.is_demo)`
        : undefined),
      eq(organizationCantons.active, true), eq(organizations.active, true),
    )).orderBy(asc(cantons.name), asc(districts.name), asc(districts.id));
  const result = new Map<string, PublicCanton>();
  for (const row of rows) {
    if (!result.has(row.id)) result.set(row.id, { id: row.id, name: row.name, province: row.provinceId && row.provinceName ? { id: row.provinceId, name: row.provinceName } : null, districts: [] });
    if (row.districtId && row.districtName) result.get(row.id)!.districts.push({ id: row.districtId, name: row.districtName });
  }
  return [...result.values()];
}
