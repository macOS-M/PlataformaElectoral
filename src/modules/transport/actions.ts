"use server";
import { revalidatePath } from "next/cache";
import { updateVehicle } from "./service";
export type VehicleState = { error: string; success: string; id?:string };
export async function saveVehicleAction(_state: VehicleState, form: FormData): Promise<VehicleState> {
  let id:string;
  try {
    const data={...Object.fromEntries([...form].filter(([key])=>key!=="documents")),active:form.get("active")==="on",districtIds:form.getAll("districtIds"),centerIds:form.getAll("centerIds")};
    const entries=form.getAll("documents");if(entries.some(file=>!(file instanceof File)))throw new Error("Adjuntos inválidos");const files=entries.filter((f):f is File=>f instanceof File&&!(f.size===0&&!f.name));
    id=files.length?await (await import("./registration-service")).registerVehicleWithDocuments(data,files):await updateVehicle(data);
  } catch (error) {
    const e = error as { code?: string; cause?: { code?: string } };
    const code = e.cause?.code ?? e.code;
    if(error instanceof Error&&error.name==="VehicleDocumentError")return {error:error.message,success:""};
    return { error: code === "40001" ? "Los datos cambiaron. Recarga antes de guardar." : code === "23505" ? "La placa ya está registrada. Edita el vehículo existente." : "No se pudo guardar. Revisa campos, distritos, centros y permisos.", success: "" };
  }
  revalidatePath("/transporte");
  revalidatePath(`/transporte/vehiculos/${id}`);
  return { error: "", success: "Conductor, vehículo, asignaciones y documentos adjuntos guardados.",id };
}
