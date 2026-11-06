import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { cantons, districts, organizations, organizationCantons } from "@/server/db/schema";
import type { PublicCanton } from "./types";

// Public projection: no membership, person, vehicle, center or contact data.
export async function readPublicTerritories(organizationId: string, cantonId: string): Promise<PublicCanton[]> {
  const rows = await getDb().select({
    id: cantons.id, name: cantons.name,
    districtId: districts.id, districtName: districts.name,
  }).from(organizationCantons)
    .innerJoin(organizations, eq(organizations.id, organizationCantons.organizationId))
    .innerJoin(cantons, eq(cantons.id, organizationCantons.cantonId))
    .leftJoin(districts, and(eq(districts.cantonId, cantons.id), eq(districts.active, true)))
    .where(and(
      eq(organizationCantons.organizationId, organizationId),
      eq(organizationCantons.cantonId, cantonId),
      eq(organizationCantons.active, true), eq(organizations.active, true),
    )).orderBy(asc(cantons.name), asc(districts.name), asc(districts.id));
  const result = new Map<string, PublicCanton>();
  for (const row of rows) {
    if (!result.has(row.id)) result.set(row.id, { id: row.id, name: row.name, districts: [] });
    if (row.districtId && row.districtName) result.get(row.id)!.districts.push({ id: row.districtId, name: row.districtName });
  }
  return [...result.values()];
}
