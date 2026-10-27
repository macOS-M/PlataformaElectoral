import { redirect } from "next/navigation";
import { getAccessContext } from "@/server/authorization/context";
import { isGlobalAdmin } from "@/server/authorization/policy";
import { getAccessAdministration } from "@/modules/access/service";
import { nameLookupConfigured } from "@/modules/access/name-lookup";
import { registrationConfigured } from "@/modules/access/identity";
import {
  AuthorizeForm,
  EditAccessForm,
  RenewCodeForm,
  RefreshNameForm,
} from "@/modules/access/forms";
import { PageHeading } from "@/components/page-heading";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
export const metadata = { title: "Usuarios y accesos" };
export default async function Users() {
  const scope = await getAccessContext();
  if (!isGlobalAdmin(scope)) redirect("/sin-acceso");
  const entries = await getAccessAdministration();
  return (
    <>
      <PageHeading
        eyebrow="Administración global"
        title="Usuarios y accesos"
        description="Autoriza cédulas para registrarse y define qué áreas puede editar cada persona."
      />
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Autorizar nueva cédula</CardTitle>
          </CardHeader>
          <CardContent>
            <AuthorizeForm configured={registrationConfigured()} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Autorizaciones y usuarios ({entries.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {entries.map((entry) => (
              <details key={entry.id} className="rounded-lg border p-4">
                <summary className="cursor-pointer text-sm font-semibold">
                  {entry.fullName && (
                    <span className="block">{entry.fullName}</span>
                  )}
                  {entry.hint === "Cuenta inicial"
                    ? "Cuenta inicial"
                    : `Cédula terminada en ${entry.hint}`}
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    {entry.role === "admin"
                      ? "Administrador global"
                      : entry.modules.length
                        ? "Coordinador"
                        : "Usuario de lectura"}{" "}
                    · {entry.user_id ? "Registrado" : "Pendiente de registro"} ·{" "}
                    {entry.active ? "Habilitado" : "Deshabilitado"}
                  </span>
                </summary>
                <div className="mt-4">
                  <EditAccessForm key={JSON.stringify(entry)} entry={entry} />
                  {entry.user_id && nameLookupConfigured() && (
                    <RefreshNameForm
                      id={entry.id}
                      configured={nameLookupConfigured()}
                    />
                  )}
                  {!entry.user_id && entry.active && (
                    <RenewCodeForm id={entry.id} />
                  )}
                </div>
              </details>
            ))}
            {!entries.length && (
              <p className="text-sm">Todavía no hay autorizaciones.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
