import Link from "next/link";
import { Network, ArrowRight, School } from "lucide-react";
import { getCenters } from "@/modules/voting-centers/service";
import { PageHeading } from "@/components/page-heading";
export const metadata={title:"Organigramas por centro"};
export default async function Organigrams({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 return <CenterPicker query={await searchParams}/>;
}
export async function CenterPicker({query,purpose="organization"}:{query:Record<string,string|string[]|undefined>;purpose?:"organization"|"training"}){
 const training=purpose==="training";const base=training?"/capacitacion":"/organigrama";
 const data=await getCenters(query);
 const href=(page:number)=>`${base}?${new URLSearchParams({q:data.filters.q,district:data.filters.district,page:String(page)})}`;
 return <>
  <PageHeading eyebrow="Equipo y operación" title={training?"Capacitación por centro":"Organigramas por centro"} description={training?"Seleccioná el centro para configurar la preparación de sus responsables. Cada avance corresponde al encargado de ese centro y área.":"Cada centro tiene su propio equipo. Seleccioná uno para gestionar sus responsables y abrir su capacitación, transporte y materiales."}/>
  <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{data.total} centros en el evento actual</p><Link href={training?"/capacitacion?scope=cantonal":"/organigrama/cantonal"} className="flex min-h-11 items-center gap-2 text-sm text-primary"><Network size={16}/>{training?"Capacitación del equipo cantonal":"Ver coordinación cantonal"} <ArrowRight size={16}/></Link></div>
  <form action={base} className="flex gap-2"><input name="q" defaultValue={data.filters.q} aria-label="Buscar centro" placeholder="Buscá una escuela o centro…" maxLength={100} className="min-h-11 min-w-0 flex-1 rounded-xl border bg-card px-4 text-sm"/><button className="rounded-xl bg-primary px-5 text-sm text-white">Buscar</button></form>
  {data.invalid&&<p role="alert">Revisá los filtros de búsqueda.</p>}
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.rows.map(center=><Link key={center.id} href={training?`/capacitacion?center=${center.id}`:`/centros/${center.id}/organigrama`} className="group rounded-2xl border bg-card p-5 transition-colors hover:border-primary"><School className="mb-4 text-primary" size={26}/><p className="text-xs text-muted-foreground">{center.district}</p><h2 className="mt-1 font-semibold">{center.name}</h2><span className="mt-5 flex items-center gap-2 text-sm text-primary">{training?"Abrir capacitación":"Abrir organigrama"} <ArrowRight size={16}/></span></Link>)}</div>
  {!data.rows.length&&<p role="status" className="rounded-xl border bg-card p-6">No hay centros disponibles con estos filtros.</p>}
  <nav aria-label="Páginas de organigramas" className="flex items-center justify-between text-sm">{data.page>1?<Link href={href(data.page-1)}>Anterior</Link>:<span/>}<span>Página {data.page} de {data.totalPages}</span>{data.page<data.totalPages?<Link href={href(data.page+1)}>Siguiente</Link>:<span/>}</nav>
 </>;
}
