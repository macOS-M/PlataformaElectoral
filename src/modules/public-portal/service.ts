import "server-only";
import { resolveTerritorySelection } from "@/modules/territories/selection";
import { getConfiguration } from "@/server/config";
import { readPublicTerritories } from "./repository";
import type { TerritoryQuery } from "./types";

export async function getPublicPortal(query: TerritoryQuery) {
  const config = getConfiguration();
  let territories: Awaited<ReturnType<typeof readPublicTerritories>> = [];
  let unavailable = !config;
  if (config) {
    try {
      territories = await readPublicTerritories(config.APP_ORGANIZATION_ID, config.APP_CANTON_ID, config.APP_EVENT_ID);
    } catch {
      unavailable = true;
    }
  }
  // Los enlaces anteriores sin provincia siguen válidos. Si se envía, debe coincidir.
  const selection = resolveTerritorySelection(territories, query);
  return { territories, unavailable, selection, invalidSelection: Boolean(query.province || query.canton || query.district) && !selection && !unavailable };
}
