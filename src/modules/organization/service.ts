import "server-only";
import { cache } from "react";
import { getAccessContext } from "@/server/authorization/context";
import { readOrganization } from "./repository";
export const getOrganization = cache(async () => {
  const scope = await getAccessContext();
  return scope
    ? readOrganization(scope)
    : { positions: [], districts: [], areas: [] };
});
