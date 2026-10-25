"use server";
import { redirect } from "next/navigation";
import { createAuthClient } from "@/server/auth/supabase";
import { getConfiguration } from "@/server/config";
import { loginSchema } from "./schemas";
export async function signIn(_previous: { error: string }, form: FormData) {
  if (!getConfiguration())
    return {
      error:
        "El acceso aún no está configurado. Consulta con la administración.",
    };
  const parsed = loginSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) return { error: "Revisa el correo y la contraseña." };
  try {
    const client = await createAuthClient();
    const { error } = await client.auth.signInWithPassword(parsed.data);
    if (error)
      return {
        error:
          "No fue posible iniciar sesión. Revisa tus datos o inténtalo más tarde.",
      };
  } catch {
    return {
      error: "El servicio de acceso no está disponible. Inténtalo de nuevo.",
    };
  }
  redirect("/resumen");
}
export async function signOut() {
  const client = await createAuthClient();
  const { error } = await client.auth.signOut();
  if (error)
    throw new Error("No se pudo cerrar la sesión. Inténtalo de nuevo.");
  redirect("/iniciar-sesion");
}
