import "server-only";
import { getAccessContext } from "@/server/authorization/context";
import { isGlobalAdmin } from "@/server/authorization/policy";
import { progressSchema, requirementSchema } from "./schemas";
import * as repository from "./repository";
export async function getTraining() {
  const scope = await getAccessContext();
  return { canEdit: isGlobalAdmin(scope), configured: !!scope, ...(scope ? await repository.readTraining(scope) : { rows: [], history: [] }) };
}
async function requireTrainingAdmin() {
  const scope = await getAccessContext();
  if (!scope || !isGlobalAdmin(scope)) throw new Error("Solo administradores gestionan capacitación");
  return scope;
}
export async function updateRequirement(input: unknown) {
  const scope = await requireTrainingAdmin();
  return repository.saveRequirement(scope, requirementSchema.parse(input));
}
export async function updateProgress(input: unknown) {
  const scope = await requireTrainingAdmin();
  return repository.recordProgress(scope, progressSchema.parse(input));
}
