import { PageHeading } from "@/components/page-heading";
import { getTraining,getCenterTraining } from "@/modules/training/service";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CenterPicker } from "@/modules/organization/center-picker";
import { TrainingWorkspace } from "@/modules/training/workspace";
export const metadata = { title: "Capacitación" };
export default async function TrainingPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const query=await searchParams;if(Array.isArray(query.center))notFound();
  if(!query.center&&query.scope!=="cantonal")return <CenterPicker query={query} purpose="training"/>;
  const centerData=query.center?await getCenterTraining(query.center):null;
  const data = centerData??await getTraining();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Costa_Rica", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return <>
    <PageHeading eyebrow={centerData?centerData.center.name:"Preparación del equipo cantonal"} title="Capacitación por puesto" description="Organizá los requisitos y acompañá el avance de tu equipo, desde la convocatoria hasta la asistencia." />
    <Link href={query.center?`/centros/${query.center}/organigrama`:"/organigrama"} className="text-sm text-primary">{query.center?"← Volver al organigrama de este centro":"Elegir un centro y gestionar la capacitación de su equipo →"}</Link>
    {"unavailable" in data&&data.unavailable?<p role="status">La capacitación por centro requiere activar la migración 0014. Los encargados existentes se conservan.</p>:<TrainingWorkspace {...data} today={today} />}
  </>;
}
