import Link from "next/link";
import { getAccessContext } from "@/server/authorization/context";
import { ReplacePasswordForm } from "@/modules/auth/recovery-forms";
export const dynamic = "force-dynamic";
export const metadata = { title: "Restablecer contraseña" };
export default async function ResetPassword() {
  const scope = await getAccessContext();
  return <main className="flex min-h-svh items-center justify-center px-5 py-10"><section className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-6 sm:p-9">
    <h1 className="text-2xl font-semibold">Restablecer contraseña</h1>
    {scope ? <><p className="text-sm text-muted-foreground">Elige una contraseña de al menos 12 caracteres. Al guardarla, se solicitará el cierre de tus sesiones.</p><ReplacePasswordForm /></> : <p role="status" className="text-sm">Necesitas un enlace válido de recuperación y una cuenta activa para cambiar tu contraseña.</p>}
    <Link href="/recuperar-acceso" className="inline-flex min-h-11 items-center text-sm text-primary">Solicitar otro enlace</Link>
  </section></main>;
}
