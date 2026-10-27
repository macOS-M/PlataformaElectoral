import { redirect } from "next/navigation";
import { getAccessContext } from "@/server/authorization/context";
import { isGlobalAdmin } from "@/server/authorization/policy";
import { getOrganization } from "@/modules/organization/service";
import { CreateCenterForm } from "@/modules/voting-centers/create-form";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Agregar centro" };
export default async function NewCenter() {
  const scope = await getAccessContext();
  if (!isGlobalAdmin(scope)) redirect("/centros");
  const org = await getOrganization();
  return <>
    <PageHeading eyebrow="Gestión territorial" title="Agregar centro" description="Registra un centro del cantón. Se guardará como pendiente de verificar, sin ratificación oficial ni JRV confirmadas." />
    <Card className="max-w-2xl p-6"><CreateCenterForm districts={org.districts} /></Card>
  </>;
}
