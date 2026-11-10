import "server-only";
import { asc, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { provinces } from "@/server/db/schema";
import type { AccessContext } from "@/server/authorization/context";
import type { TerritoryMutation } from "./schemas";

export async function readProvinces() {
  return getDb().select({ id: provinces.id, name: provinces.name, officialCode: provinces.officialCode }).from(provinces).orderBy(asc(provinces.name));
}

export async function writeTerritory(scope: AccessContext, input: TerritoryMutation) {
  if (input.operation === "province") {
    return getDb().execute(sql`select electoral.register_province(${scope.userId}::uuid,${scope.organizationId}::uuid,${scope.cantonId}::uuid,${input.name},${input.officialCode || null},${input.sourceUrl})`);
  }
  return getDb().execute(sql`select electoral.link_canton_province(${scope.userId}::uuid,${scope.organizationId}::uuid,${scope.cantonId}::uuid,${input.provinceId}::uuid,${input.expectedProvinceId || null}::uuid,${input.sourceUrl})`);
}
