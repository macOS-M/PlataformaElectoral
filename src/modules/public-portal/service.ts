import "server-only";
import { z } from "zod";
import { getConfiguration } from "@/server/config";
import { readPublicTerritories } from "./repository";
import type { TerritoryQuery } from "./types";

const selectionSchema = z.object({ canton: z.uuid(), district: z.uuid() });
export async function getPublicPortal(query: TerritoryQuery) {
  const config = getConfiguration();
  let territories: Awaited<ReturnType<typeof readPublicTerritories>> = [];
  let unavailable = !config;
  if (config) {
    try {
      territories = await readPublicTerritories(config.APP_ORGANIZATION_ID, config.APP_CANTON_ID);
    } catch {
      unavailable = true;
    }
  }
  const parsed = selectionSchema.safeParse(query);
  const canton = parsed.success ? territories.find(item => item.id === parsed.data.canton) : undefined;
  const district = parsed.success ? canton?.districts.find(item => item.id === parsed.data.district) : undefined;
  const selection = canton && district ? { canton, district } : null;
  return { territories, unavailable, selection, invalidSelection: Boolean(query.canton || query.district) && !selection && !unavailable };
}
