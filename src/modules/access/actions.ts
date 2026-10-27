"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  authorizeCedula,
  updateAccess,
  registerAuthorized,
  requireAdmin,
  renewActivation,
  refreshUserName,
} from "./service";
export type AccessState = { error: string; success: string; code?: string };
export async function authorizeAction(
  _previous: AccessState,
  form: FormData,
): Promise<AccessState> {
  await requireAdmin();
  try {
    const code = await authorizeCedula({
      cedula: form.get("cedula"),
      role: form.get("role"),
      modules: form.getAll("modules"),
      useCode: true,
    });
    revalidatePath("/administracion/usuarios");
    return {
      error: "",
      success:
        "Cédula autorizada. Entrega este código a la persona; solo se muestra en esta respuesta.",
      code: code ?? undefined,
    };
  } catch {
    return {
      error:
        "No se pudo autorizar. Revisa la cédula y si ya tiene una autorización.",
      success: "",
    };
  }
}
export async function accessAction(
  _previous: AccessState,
  form: FormData,
): Promise<AccessState> {
  await requireAdmin();
  try {
    await updateAccess({
      id: form.get("id"),
      role: form.get("role"),
      modules: form.getAll("modules"),
      active: form.get("active") === "on",
    });
  } catch {
    return {
      error:
        "No se pudo actualizar. Debe quedar al menos un administrador global activo.",
      success: "",
    };
  }
  revalidatePath("/administracion/usuarios");
  revalidatePath("/organigrama");
  return {
    error: "",
    success:
      "Permisos actualizados. Se aplican en la siguiente solicitud del usuario.",
  };
}
export async function registerAction(
  _previous: AccessState,
  form: FormData,
): Promise<AccessState> {
  try {
    await registerAuthorized({
      fullName: form.get("fullName") ?? "",
      cedula: form.get("cedula"),
      code: form.get("code"),
      password: form.get("password"),
      confirmPassword: form.get("confirmPassword"),
    });
  } catch {
    return {
      error:
        "No se pudo completar el registro. Revisa el nombre, la cédula y el código, usa una contraseña de al menos 12 caracteres y confirma que coincida. Si ya tienes cuenta, inicia sesión; si has hecho varios intentos, espera 15 minutos.",
      success: "",
    };
  }
  redirect("/iniciar-sesion?registered=1");
}

export async function renewCodeAction(
  _previous: AccessState,
  form: FormData,
): Promise<AccessState> {
  await requireAdmin();
  try {
    const code = await renewActivation(form.get("id"));
    return {
      error: "",
      success: "Nuevo código generado. El anterior dejó de funcionar.",
      code,
    };
  } catch {
    return {
      error:
        "Solo se pueden renovar códigos de autorizaciones habilitadas y sin registrar.",
      success: "",
    };
  }
}

export async function refreshNameAction(
  _previous: AccessState,
  form: FormData,
): Promise<AccessState> {
  await requireAdmin();
  try {
    const name = await refreshUserName({
      id: form.get("id"),
      cedula: form.get("cedula"),
    });
    revalidatePath("/administracion/usuarios");
    revalidatePath("/organigrama");
    return {
      error: "",
      success: "Nombre actualizado desde Soporte Real: " + name,
    };
  } catch {
    return {
      error:
        "No se pudo actualizar. Revisa que la cédula corresponda a esta cuenta y que Soporte Real esté disponible.",
      success: "",
    };
  }
}
