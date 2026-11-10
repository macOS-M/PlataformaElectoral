import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { getFiscals } from "@/modules/fiscals/service";
import { FiscalWorkspace } from "@/modules/fiscals/workspace";
export const metadata={title:"Fiscales por centro y JRV"};
export default async function FiscalsPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const data=await getFiscals(id);
 return <><Link href={`/centros/${id}/organigrama`} className="text-sm text-primary">← Organigrama del centro</Link><PageHeading eyebrow={data.center.name} title="Fiscales por centro y JRV" description="Fiscales generales del centro y fiscales titulares y suplentes de cada junta receptora de votos."/>{data.ready?<FiscalWorkspace centerId={id} {...data}/>:<p role="status" className="rounded-xl border bg-card p-5">La gestión de fiscales y JRV requiere activar la migración 0015. No se muestran asignaciones ni juntas ficticias.</p>}</>;
}
