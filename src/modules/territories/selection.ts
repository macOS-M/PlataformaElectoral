import { z } from "zod";
import type { PublicCanton, TerritoryQuery } from "@/modules/public-portal/types";

// PostgreSQL also accepts stable IDs generated with md5(... )::uuid by the seeds.
// Validate the GUID shape, then verify membership against the active catalog below.
const selectionSchema = z.object({ province: z.guid().optional(), canton: z.guid(), district: z.guid() });
export function resolveTerritorySelection(territories: PublicCanton[], query: TerritoryQuery) {
  const parsed = selectionSchema.safeParse(query);
  if (!parsed.success) return null;
  const canton = territories.find(item => item.id === parsed.data.canton && (!parsed.data.province || item.province?.id === parsed.data.province));
  const district = canton?.districts.find(item => item.id === parsed.data.district);
  return canton && district ? { canton, district } : null;
}
