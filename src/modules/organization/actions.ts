"use server";
import { revalidatePath } from "next/cache";
import { updateResponsible } from "./service";
import { assignmentSchema } from "./schemas";
export type FormState = { error: string; success: string };
function failure(error: unknown): FormState {
  const e = error as { code?: string; cause?: { code?: string } };
  const code = e.cause?.code ?? e.code;
  return {
    error:
      code === "40001" || code === "23505"
        ? "Otra persona modificó estos datos. Recarga la página y vuelve a intentarlo."
        : "No se pudo guardar. Revisa los datos y tu acceso e inténtalo de nuevo.",
    success: "",
  };
}
export async function assignAction(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const { getAccessContext } = await import("@/server/authorization/context");
  const scope = await getAccessContext();
  if (!scope) return { error: "El acceso no está configurado.", success: "" };
  const input = assignmentSchema.safeParse(Object.fromEntries(form));
  if (!input.success)
    return {
      error:
        "Selecciona una persona válida e indica el motivo si cambias un responsable.",
      success: "",
    };
  try {
    await updateResponsible(input.data);
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/organigrama");
  revalidatePath("/organigrama/cantonal");
  revalidatePath("/capacitacion");
  revalidatePath("/resumen");
  return {
    error: "",
    success: "Responsable actualizado. El historial se conservó.",
  };
}
