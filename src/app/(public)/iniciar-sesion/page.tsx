import Link from "next/link";
import { Compass, ArrowLeft } from "lucide-react";
import { getConfiguration } from "@/server/config";
import { LoginForm } from "@/modules/auth/login-form";
export const dynamic = "force-dynamic";
export const metadata = { title: "Iniciar sesión" };
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; registered?: string }>;
}) {
  const configured = !!getConfiguration();
  const { error, registered } = await searchParams;
  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <section className="sidebar hero-grid hidden flex-col justify-between p-10 text-white lg:flex xl:p-14">
        <p className="flex items-center gap-3 text-xl font-semibold">
          <Compass />
          TBA
        </p>
        <div>
          <p className="mb-4 text-xs tracking-widest text-emerald-200">
            ORGANIZACIÓN Y TERRITORIO
          </p>
          <h2 className="max-w-lg text-4xl font-medium leading-tight tracking-tight">
            Un mismo espacio.
            <br />
            Una mejor coordinación.
          </h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-emerald-100/85">
            Conecta la estructura cantonal con la información de sus centros de
            votación.
          </p>
        </div>
        <p className="text-xs text-emerald-100/75">
          Plataforma de coordinación interna
        </p>
      </section>
      <section className="flex items-center justify-center bg-background px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-9">
          <p className="mb-6 flex items-center gap-2 font-semibold text-primary lg:hidden">
            <Compass size={22} />
            TBA
          </p>
          <Link
            href="/resumen"
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground"
          >
            <ArrowLeft size={16} />
            Volver al resumen
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">
            Bienvenido a TBA
          </h1>
          <p className="mt-3 mb-7 text-sm text-muted-foreground">
            Ingresa con tu cuenta autorizada.
          </p>
          {!configured && (
            <p
              role="status"
              className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
            >
              El acceso aún no está configurado. La administración debe
              habilitar la conexión y tu cuenta.
            </p>
          )}
          {error && (
            <p role="alert" className="mb-5 text-sm text-red-800">
              No fue posible validar el enlace de acceso. Inicia sesión
              nuevamente.
            </p>
          )}
          {registered && (
            <p role="status" className="mb-4 text-sm text-emerald-700">
              Cuenta creada. Ingresa con tu cédula y contraseña.
            </p>
          )}
          <LoginForm configured={configured} />
          <Link
            href="/registrarse"
            className="mt-5 flex min-h-11 items-center justify-center rounded-lg border px-4 py-2 text-center text-sm font-semibold text-primary transition-colors hover:bg-muted"
          >
            Registrarme con cédula autorizada
          </Link>
          <p className="mt-6 border-t pt-5 text-xs leading-relaxed text-muted-foreground">
            El registro requiere una cédula autorizada y un código de activación
            entregado por la administración.
          </p>
        </div>
      </section>
    </main>
  );
}
