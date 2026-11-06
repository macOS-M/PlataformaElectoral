"use server";
import { redirect } from "next/navigation";
import { newPasswordSchema, recoveryEmailSchema, replaceRecoveredPassword, requestPasswordRecovery } from "./recovery";
export type RecoveryState = { error: string; success: string };
export async function requestRecoveryAction(_state: RecoveryState, form: FormData): Promise<RecoveryState> {
  const email = recoveryEmailSchema.safeParse(form.get("email"));
  if (!email.success) return { error: "Escribe un correo de acceso válido.", success: "" };
  try { await requestPasswordRecovery(email.data); } catch { return { error: "No se pudo solicitar el enlace. Inténtalo más tarde o contacta con la administración.", success: "" }; }
  return { error: "", success: "Si el correo tiene una cuenta de acceso, recibirás un enlace. Revisa también la carpeta de spam. Ábrelo en este mismo navegador; si ya lo solicitaste, espera antes de repetir." };
}
export async function replacePasswordAction(_state: RecoveryState, form: FormData): Promise<RecoveryState> {
  const data = newPasswordSchema.safeParse({ password: form.get("password"), confirmation: form.get("confirmation") });
  if (!data.success) return { error: "Usa al menos 12 caracteres y repite la misma contraseña.", success: "" };
  let signedOut = false;
  try { signedOut = (await replaceRecoveredPassword(data.data)).signedOut; } catch { return { error: "No se pudo cambiar la contraseña. Comprueba que el enlace sea vigente y solicita otro si es necesario.", success: "" }; }
  // No reintentar una actualización ya confirmada si falla solo el cierre de sesión.
  if (!signedOut) return { error: "", success: "Contraseña actualizada. No se pudo cerrar la sesión automáticamente; ciérrala desde el acceso interno." };
  redirect("/iniciar-sesion?passwordUpdated=1");
}
