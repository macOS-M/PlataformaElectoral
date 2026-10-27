import "server-only";
import { canCreatePerson } from "@/server/authorization/policy";
import { cache } from "react";
import { getAccessContext } from "@/server/authorization/context";
import { readOrganization } from "./repository";
export const getOrganization = cache(async () => {
  const scope = await getAccessContext();
  return scope
    ? readOrganization(scope)
    : { positions: [], districts: [], areas: [], people: [], assignments: [] };
});

export async function updatePerson(input: unknown) {
  const scope = await getAccessContext();
  if (!scope || !canCreatePerson(scope))
    throw new Error("Sin permiso de edición");
  const { personSchema } = await import("./schemas");
  const { savePerson } = await import("./repository");
  return savePerson(scope, personSchema.parse(input));
}
export async function updateResponsible(input: unknown) {
  const scope = await getAccessContext();
  if (!scope || !canCreatePerson(scope))
    throw new Error("Sin permiso de edición");
  const { assignmentSchema } = await import("./schemas");
  const { setResponsible } = await import("./repository");
  return setResponsible(scope, assignmentSchema.parse(input));
}
