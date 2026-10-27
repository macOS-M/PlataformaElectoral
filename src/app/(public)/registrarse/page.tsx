import Link from "next/link";
import { nameLookupConfigured } from "@/modules/access/name-lookup";
import { getConfiguration } from "@/server/config";
import { registrationConfigured } from "@/modules/access/identity";
import { RegistrationForm } from "@/modules/access/forms";
export const metadata = { title: "Crear cuenta" };
export const dynamic = "force-dynamic";
export default function Register() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-primary">
          TBA · ACCESO AUTORIZADO
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Crear mi cuenta</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Regístrate con tu cédula y el código entregado por la administración.
        </p>
      </div>
      <RegistrationForm
        configured={!!getConfiguration() && registrationConfigured()}
        automaticName={nameLookupConfigured()}
      />
      <Link href="/iniciar-sesion" className="text-sm text-primary underline">
        Ya tengo cuenta · Iniciar sesión
      </Link>
    </main>
  );
}
