import "server-only";
import { getAccessContext } from "@/server/authorization/context";
import { centerFiltersSchema } from "./schemas";
import { readCenters } from "./repository";
import { isGlobalAdmin } from "@/server/authorization/policy";
import { newCenterSchema } from "./schemas";
import { createCenter } from "./repository";

export async function addCenter(input: unknown) {
  const scope = await getAccessContext();
  if (!scope || !isGlobalAdmin(scope)) throw new Error("Sin permiso de administración");
  await createCenter(scope, newCenterSchema.parse(input));
}
export async function getCenters(
  input: Record<string, string | string[] | undefined>,
) {
  const scope = await getAccessContext();
  const parsed = centerFiltersSchema.safeParse(input);
  const filters = parsed.success ? parsed.data : centerFiltersSchema.parse({});
  // Un filtro inválido no amplía silenciosamente la búsqueda.
  const result =
    scope && parsed.success
      ? await readCenters(scope, filters)
      : { rows: [], total: 0, totalPages: 1, page: 1 };
  return { ...result, filters, invalid: !parsed.success };
}
