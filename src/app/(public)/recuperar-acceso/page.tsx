import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { RequestRecoveryForm } from "@/modules/auth/recovery-forms";
import { recoveryConfigured, recoveryOrigin } from "@/modules/auth/recovery";
export const dynamic = "force-dynamic";
export const metadata = { title: "Recuperar acceso" };
export default async function RecoverAccess() {
  const configured = recoveryConfigured();
  const origin = recoveryOrigin();
  // PKCE requiere el mismo navegador y origen que guardó el verificador.
  if (configured && origin && (await headers()).get("host") !== new URL(origin).host) redirect(`${origin}/recuperar-acceso`);
  return <main className="flex min-h-svh items-center justify-center px-5 py-10"><section className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-6 sm:p-9">
    <Link href="/iniciar-sesion" className="inline-flex min-h-11 items-center text-sm text-primary">Volver a iniciar sesión</Link>
    <h1 className="text-2xl font-semibold">Recuperar acceso</h1>
    <p className="text-sm leading-relaxed text-muted-foreground">Solicita un enlace para elegir una nueva contraseña. Usa el correo con el que inicias sesión. Mantén este navegador abierto para completar la recuperación.</p>
    <p className="text-xs leading-relaxed text-muted-foreground">Si tu cuenta se creó con cédula y código de activación, el correo de contacto no sirve para recuperar acceso. Solicita asistencia a la administración.</p>
    {!configured && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">La recuperación aún no está configurada.</p>}
    <RequestRecoveryForm configured={configured} />
  </section></main>;
}
