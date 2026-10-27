import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getAccessContext } from "@/server/authorization/context";
import { canEditModule } from "@/server/authorization/policy";
import { readCenter, readCenterAreas, readAreaDetail } from "./area-repository";
import { areaCodeSchema } from "./area-schemas";

export async function getCenterDetail(id: string) {
  const scope = await getAccessContext();
  if (!scope || !z.guid().safeParse(id).success) notFound();
  const center = await readCenter(scope, id);
  if (!center) notFound();
  const areas = await readCenterAreas(scope, id);
  return { scope, center, areas };
}
export async function getCenterArea(id: string, code: string) {
  if (!areaCodeSchema.safeParse(code).success) notFound();
  const detail = await getCenterDetail(id);
  const area = detail.areas.find(a => a.code === code);
  if (!area) notFound();
  const data = await readAreaDetail(detail.scope, id, area.id);
  return { ...detail, area, ...data, canEdit: canEditModule(detail.scope, code) };
}
