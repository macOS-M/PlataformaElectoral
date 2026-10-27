"use server";
import { redirect } from "next/navigation";
import { createAuthClient } from "@/server/auth/supabase";
import { getConfiguration } from "@/server/config";
import { cedulaSchema } from "@/modules/access/schemas";
import { identifierHash } from "@/modules/access/identity";
import { getAlias, checkRate } from "@/modules/access/repository";
import { loginSchema } from "./schemas";
export async function signIn(_previous: { error: string }, form: FormData) {
  if (!getConfiguration())
    return {
      error:
        "El acceso aún no está configurado. Consulta con la administración.",
    };
  const parsed = loginSchema.safeParse({
    identifier: form.get("identifier"),
    password: form.get("password"),
  });
  if (!parsed.success) return { error: "Revisa la cédula y la contraseña." };
  try {
    const { identifier, password } = parsed.data;
    const cedula = cedulaSchema.safeParse(identifier);
    const config = getConfiguration()!;
    let email = identifier;
    if (process.env.AUTH_IDENTIFIER_SECRET) {
      if (!(await checkRate(identifierHash("login-global"), 100, 60)))
        return { error: "No fue posible iniciar sesión. Inténtalo más tarde." };
      const key = identifierHash(
        "login:" + (cedula.success ? cedula.data : identifier.toLowerCase()),
      );
      if (!(await checkRate(key, 10, 900)))
        return { error: "No fue posible iniciar sesión. Inténtalo más tarde." };
    }
    if (cedula.success) {
      const alias = await getAlias(
        identifierHash(cedula.data),
        config.APP_ORGANIZATION_ID,
      );
      if (!alias)
        return {
          error:
            "No fue posible iniciar sesión. Revisa tus datos o inténtalo más tarde.",
        };
      email = alias;
    }
    const client = await createAuthClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
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
