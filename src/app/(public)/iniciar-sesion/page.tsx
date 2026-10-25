import Link from "next/link";
import { Compass, ArrowLeft } from "lucide-react";
import { getConfiguration } from "@/server/config";
import { LoginForm } from "@/modules/auth/login-form";
export const dynamic = "force-dynamic";
export const metadata = { title: "Iniciar sesión" };
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const configured = !!getConfiguration();
  const { error } = await searchParams;
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="sidebar hero-grid hidden flex-col justify-between p-14 text-white lg:flex">
        <p className="flex items-center gap-3 text-xl font-semibold">
          <Compass />
          Cantonal
        </p>
        <div>
          <p className="mb-4 text-xs tracking-widest text-emerald-200">
            ORGANIZACIÓN Y TERRITORIO
          </p>
          <h1 className="max-w-lg text-4xl font-medium leading-tight">
            Un mismo espacio.
            <br />
            Una mejor coordinación.
          </h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-emerald-100/65">
            Conecta la estructura cantonal con la información de sus centros de
            votación.
          </p>
        </div>
        <p className="text-xs text-emerald-100/50">
          Plataforma de coordinación interna
        </p>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Link
            href="/resumen"
            className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground"
          >
            <ArrowLeft size={16} />
            Volver al resumen
          </Link>
          <h2 className="text-3xl font-semibold tracking-tight">
            Bienvenido a Cantonal
          </h2>
          <p className="mt-3 mb-8 text-sm text-muted-foreground">
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
          <LoginForm configured={configured} />
          <p className="mt-7 text-xs leading-relaxed text-muted-foreground">
            No hay registro público. Solicita acceso a la administración de tu
            organización.
          </p>
        </div>
      </section>
    </main>
  );
}
