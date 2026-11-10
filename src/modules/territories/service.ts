import "server-only";
import { getAccessContext } from "@/server/authorization/context";
import { readPublicTerritories } from "@/modules/public-portal/repository";
import { readProvinces, writeTerritory } from "./repository";
import { territoryMutationSchema } from "./schemas";

export async function getTerritories() {
  const scope = await getAccessContext();
  if (!scope) return { configured: false, admin: false, editableCantonId: null, provinces: [], territories: [] };
  const [provinces, territories] = await Promise.all([
    readProvinces(), readPublicTerritories(scope.organizationId, scope.cantonId, scope.eventId),
  ]);
  return { configured: true, admin: scope.role === "admin", editableCantonId: scope.cantonId, provinces, territories };
}

export async function updateTerritory(input: unknown) {
  const scope = await getAccessContext();
  if (!scope || scope.role !== "admin") throw new Error("Sin permiso");
  return writeTerritory(scope, territoryMutationSchema.parse(input));
}
