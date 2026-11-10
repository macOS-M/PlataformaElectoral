"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/server/authorization/context";
import { canEditModule } from "@/server/authorization/policy";
import { createAdminAuthClient } from "@/server/auth/admin";
import { readCenter, readCenterAreas, saveAreaDocument, saveAreaResponsible } from "./area-repository";
import { responsibleSchema, documentSchema, identifyDocument, DOCUMENT_BUCKET, MAX_DOCUMENT_BYTES } from "./area-schemas";

export type AreaFormState = { error: string; success: string };
const failure = (error: unknown): AreaFormState => {
  const e = error as { code?: string; cause?: { code?: string } };
  return { error: (e.cause?.code ?? e.code) === "40001" ? "Estos datos cambiaron. Recarga la página antes de guardar." : "No se pudo guardar. Revisa los datos y tus permisos e inténtalo de nuevo.", success: "" };
};
export async function saveResponsibleAction(_state: AreaFormState, form: FormData): Promise<AreaFormState> {
  const scope = await getAccessContext();
  const input = responsibleSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return { error: "Completa el nombre y revisa el correo y los demás datos.", success: "" };
  if (!scope || !canEditModule(scope, input.data.areaCode)) return { error: "No tienes permiso para editar esta área.", success: "" };
  if (input.data.expectedId && input.data.personId !== String(form.get("previousPersonId") ?? "") && input.data.reason.length < 3) return { error: "Indica el motivo del cambio de encargado.", success: "" };
  try { await saveAreaResponsible(scope, input.data); } catch (error) { return failure(error); }
  revalidatePath(`/centros/${input.data.centerId}`);
  revalidatePath(`/centros/${input.data.centerId}/organigrama`);
  revalidatePath("/organigrama");
  revalidatePath("/capacitacion");
  revalidatePath(`/centros/${input.data.centerId}/areas/${input.data.areaCode}`);
  return { error: "", success: "Encargado guardado. No se creó ninguna cuenta de acceso." };
}

export async function uploadDocumentAction(_state: AreaFormState, form: FormData): Promise<AreaFormState> {
  const scope = await getAccessContext();
  const input = documentSchema.safeParse(Object.fromEntries(form));
  if (!input.success || !scope || !canEditModule(scope, input.data.areaCode)) return { error: "No tienes permiso para adjuntar en esta área.", success: "" };
  const { centerId, areaCode, category } = input.data;
  const center = await readCenter(scope, centerId);
  if (!center || !(await readCenterAreas(scope, centerId)).some(a => a.code === areaCode)) return { error: "El centro o el área no están disponibles.", success: "" };
  const file = form.get("file");
  if (!(file instanceof File) || !file.size || file.size > MAX_DOCUMENT_BYTES) return { error: "Selecciona un archivo PDF, JPG o PNG de hasta 5 MB.", success: "" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = identifyDocument(bytes, file.name, file.type);
  if (!type) return { error: "El contenido debe corresponder a un archivo PDF, JPG o PNG válido.", success: "" };
  const name = file.name.replace(/[\x00-\x1f\x7f/\\]/g, "_").slice(0, 180).trim() || `documento.${type.extension}`;
  const path = `${scope.organizationId}/${scope.eventId}/${centerId}/${areaCode}/${randomUUID()}.${type.extension}`;
  try {
    const storage = createAdminAuthClient().storage.from(DOCUMENT_BUCKET);
    const upload = await storage.upload(path, bytes, { contentType: type.mime, upsert: false });
    if (upload.error) return { error: "No se pudo subir el documento al almacenamiento privado. Inténtalo de nuevo.", success: "" };
    try {
      await saveAreaDocument(scope, centerId, areaCode, { path, name, category, mime: type.mime, size: file.size });
    } catch (error) {
      await storage.remove([path]);
      return failure(error);
    }
  } catch (error) { return failure(error); }
  revalidatePath(`/centros/${centerId}/areas/${areaCode}`);
  return { error: "", success: "Documento adjuntado." };
}
