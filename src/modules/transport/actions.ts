"use server";
import { revalidatePath } from "next/cache";
import { updateVehicle } from "./service";
export type VehicleState = { error: string; success: string };
export async function saveVehicleAction(_state: VehicleState, form: FormData): Promise<VehicleState> {
  try {
    await updateVehicle({ ...Object.fromEntries(form), active: form.get("active") === "on", districtIds: form.getAll("districtIds"), centerIds: form.getAll("centerIds") });
  } catch (error) {
    const e = error as { code?: string; cause?: { code?: string } };
    const code = e.cause?.code ?? e.code;
    return { error: code === "40001" ? "Los datos cambiaron. Recarga antes de guardar." : code === "23505" ? "La placa ya está registrada. Edita el vehículo existente." : "No se pudo guardar. Revisa campos, distritos, centros y permisos.", success: "" };
  }
  revalidatePath("/transporte");
  return { error: "", success: "Vehículo y asignaciones guardados." };
}
