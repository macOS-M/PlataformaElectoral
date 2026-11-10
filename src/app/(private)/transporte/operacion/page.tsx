import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { getTransportOperations } from "@/modules/public-transport/service";
import { TransportOperationsWorkspace } from "@/modules/public-transport/operations-ui";
import { getCenterDetail } from "@/modules/voting-centers/area-service";
import { notFound } from "next/navigation";
export const metadata={title:"Disponibilidad y solicitudes de transporte"};
export default async function TransportOperationPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const query=await searchParams;const page=typeof query.page==="string"&&/^\d+$/.test(query.page)?Math.min(10000,Math.max(1,Number(query.page))):1;
 if(Array.isArray(query.center))notFound();
 const selected=query.center?(await getCenterDetail(query.center)).center:undefined;
 const data=await getTransportOperations(page,query);
 return <><PageHeading eyebrow={selected?selected.name:"Transporte · Operación"} title="Disponibilidad y solicitudes" description="Revisá inscripciones, programá servicios por horario y publicá únicamente información institucional autorizada."/>{selected&&<Link href={`/centros/${selected.id}/organigrama`} className="text-sm text-primary">← Organigrama del centro</Link>}<div className="flex flex-wrap gap-4 text-sm font-semibold text-primary"><Link className="py-3" href={selected?`/transporte?center=${selected.id}`:"/transporte"}>Vehículos y vínculos territoriales</Link><Link className="py-3" href="/servicios/transporte">Ver consulta pública</Link></div><TransportOperationsWorkspace key={selected?.id??"all"} data={data} page={page} centerContext={selected}/></>;
}
