"use server";
import { revalidatePath } from "next/cache";
import { updateTerritory } from "./service";
export type TerritoryState = { error: string; success: string };
export async function saveTerritoryAction(_state: TerritoryState, form: FormData): Promise<TerritoryState> {
  try {
    await updateTerritory(Object.fromEntries(form));
  } catch (error) {
    const e = error as { code?: string; cause?: { code?: string } };
    const code = e.cause?.code ?? e.code;
    return { success: "", error: code === "23505" ? "Ese nombre o código ya existe. Reutilizá el registro del catálogo." : code === "40001" ? "La relación cambió. Recargá la página antes de guardar." : "No se pudo guardar. Revisá permisos, fuente y compatibilidad con el código provincial previo." };
  }
  revalidatePath("/territorios");
  revalidatePath("/");
  return { success: "Catálogo territorial actualizado.", error: "" };
}
