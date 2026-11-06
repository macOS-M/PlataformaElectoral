import "server-only";
import { z } from "zod";
import { getConfiguration } from "@/server/config";
import { createAuthClient } from "@/server/auth/supabase";
import { getAccessContext } from "@/server/authorization/context";
import { identifierHash } from "@/modules/access/identity";
import { checkRate } from "@/modules/access/repository";

export const recoveryEmailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254))
  .refine(email => !email.endsWith("@accounts.cantonal.invalid"));
export const newPasswordSchema = z.object({
  password: z.string().min(12).max(256), confirmation: z.string().min(12).max(256),
}).refine(data => data.password === data.confirmation);

export function recoveryOrigin(): string | null {
  try {
    const url = new URL(process.env.APP_SITE_URL ?? "");
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) return null;
    return url.origin;
  } catch { return null; }
}
export function recoveryConfigured() {
  return !!getConfiguration() && !!recoveryOrigin() && (process.env.AUTH_IDENTIFIER_SECRET?.length ?? 0) >= 32;
}
export async function requestPasswordRecovery(input: unknown) {
  const email = recoveryEmailSchema.parse(input);
  const origin = recoveryOrigin();
  if (!recoveryConfigured() || !origin) throw new Error("Recuperación no configurada");
  // No consulta existencia de cuentas ni guarda correos en contadores o logs.
  const globalAllowed = await checkRate(identifierHash("recovery-global"), 20, 3600);
  const allowed = globalAllowed && await checkRate(identifierHash("recovery:" + email), 3, 3600);
  if (!allowed) return;
  const client = await createAuthClient();
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback` });
  if (error) throw new Error("Recuperación no disponible");
}
export async function replaceRecoveredPassword(input: unknown) {
  const data = newPasswordSchema.parse(input);
  // La identidad se verifica en servidor, incluso si se invoca la Action directamente.
  // No se usa Auth Admin ni se acepta un userId/correo enviado por el formulario.
  const scope = await getAccessContext();
  if (!scope) throw new Error("Sesión no válida");
  const client = await createAuthClient();
  const { error } = await client.auth.updateUser({ password: data.password });
  if (error) throw new Error("No se pudo actualizar la contraseña");
  const result = await client.auth.signOut({ scope: "global" });
  return { signedOut: !result.error };
}
