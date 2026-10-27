"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccessContext } from "@/server/authorization/context";
import { isGlobalAdmin } from "@/server/authorization/policy";
import { newCenterSchema } from "./schemas";
import { addCenter } from "./service";

export async function createCenterAction(_state: { error: string }, form: FormData): Promise<{ error: string }> {
  const scope = await getAccessContext();
  if (!scope || !isGlobalAdmin(scope)) return { error: "Solo un administrador global puede agregar centros." };
  const input = newCenterSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return { error: "Completa el nombre, la dirección y un distrito válido." };
  try {
    await addCenter(input.data);
  } catch (error) {
    const e = error as { code?: string; cause?: { code?: string } };
    return { error: (e.cause?.code ?? e.code) === "23505"
      ? "Este centro ya está registrado con el mismo nombre y dirección. Búscalo en el catálogo."
      : "No se pudo guardar el centro. Revisa los datos y tu acceso e inténtalo de nuevo." };
  }
  revalidatePath("/centros");
  revalidatePath("/resumen");
  redirect("/centros?created=1");
}
