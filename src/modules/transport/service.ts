import "server-only";
import { getAccessContext } from "@/server/authorization/context";
import { canEditModule } from "@/server/authorization/policy";
import { vehicleSchema } from "./schemas";
import * as repository from "./repository";

export async function getTransport() {
  const scope = await getAccessContext();
  return { canEdit: canEditModule(scope, "A05"), configured: !!scope,
    ...(scope ? await repository.readTransport(scope) : { vehicles: [], people: [], districts: [], centers: [], history: [] }) };
}
export async function updateVehicle(input: unknown) {
  const scope = await getAccessContext();
  if (!scope || !canEditModule(scope, "A05")) throw new Error("Sin permiso de transporte");
  return repository.saveVehicle(scope, vehicleSchema.parse(input));
}
