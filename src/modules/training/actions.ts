"use server";
import { revalidatePath } from "next/cache";
import { updateProgress, updateRequirement } from "./service";
export type TrainingState = { error: string; success: string };
function failure(error: unknown): TrainingState {
  const e = error as { code?: string; cause?: { code?: string } };
  return { error: (e.cause?.code ?? e.code) === "40001" ? "El requisito o estado cambió. Recarga antes de guardar." : "No se pudo guardar. Revisa fechas, ocupante, requisito y permisos administrativos.", success: "" };
}
export async function saveRequirementAction(_state: TrainingState, form: FormData): Promise<TrainingState> {
  try { await updateRequirement({ ...Object.fromEntries(form), required: form.get("required") === "on" }); } catch (error) { return failure(error); }
  revalidatePath("/capacitacion");
  return { error: "", success: "Requisito guardado; el historial se conservó." };
}
export async function saveProgressAction(_state: TrainingState, form: FormData): Promise<TrainingState> {
  try { await updateProgress(Object.fromEntries(form)); } catch (error) { return failure(error); }
  revalidatePath("/capacitacion");
  return { error: "", success: "Estado registrado. No se envió correo." };
}
