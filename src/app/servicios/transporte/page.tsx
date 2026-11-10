import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getPublicTransport } from "@/modules/public-transport/service";
import { PublicTransportShell } from "@/modules/public-transport/public-shell";
import { TransportZoneFields } from "@/modules/public-transport/public-ui";
import { transportDate } from "@/modules/public-transport/dates";
export const dynamic="force-dynamic";
export const metadata={title:"Transporte por zona"};
export default async function PublicTransportPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const data=await getPublicTransport(await searchParams);
 return <PublicTransportShell title="Transporte por zona" description="Consultá únicamente los servicios confirmados y publicados para tu distrito o centro. La información disponible no constituye una reserva de cupo.">
  <div className="flex flex-wrap gap-3"><Button asChild className="min-h-11"><Link href="/servicios/transporte/solicitar">Solicitar información de transporte</Link></Button><Button asChild variant="outline" className="min-h-11"><Link href="/servicios/transporte/participar">Quiero apoyar como transportista</Link></Button></div>
  {!data.ready?<p role="status" className="rounded-xl border bg-card p-5">El servicio de transporte aún no está disponible. No se pueden consultar rutas ni enviar solicitudes en este momento.</p>:<>
   <form method="get" action="/servicios/transporte" className="space-y-4 rounded-2xl border bg-card p-5"><TransportZoneFields key={`${data.district}/${data.center}`} districts={data.districts} centers={data.centers} query initialDistrict={data.district} initialCenter={data.center}/><Button type="submit" className="min-h-11">Consultar transporte</Button></form>
   {data.invalidFilters?<p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-900">El distrito o centro seleccionado no corresponde al catálogo disponible. Elegí una zona válida.</p>:!data.services.length?<div className="rounded-2xl border border-dashed bg-card p-8"><h2 className="text-lg font-semibold">Sin transporte publicado</h2><p className="mt-2 text-sm text-muted-foreground">Aún no hay servicios confirmados y publicados para esta consulta. Podés dejar una solicitud pendiente, sin garantía de cupo.</p></div>:<section aria-label="Servicios de transporte publicados" className="grid gap-4 sm:grid-cols-2">{data.services.map(service=><article key={service.id} className="space-y-3 rounded-2xl border bg-card p-5"><p className="text-xs font-semibold text-primary">Confirmado · Publicado</p><h2 className="text-lg font-semibold">{service.title}</h2><p className="text-sm text-muted-foreground">{data.districts.find(d=>d.id===service.district_id)?.name}{service.center_id?` · ${data.centers.find(c=>c.id===service.center_id)?.name??"Centro"}`:" · Servicio distrital"}</p><dl className="space-y-3 text-sm"><div><dt className="font-medium">Punto de encuentro</dt><dd className="mt-1 break-words text-muted-foreground">{service.meeting_point}</dd></div><div><dt className="font-medium">Horario de Costa Rica</dt><dd className="mt-1 text-muted-foreground">{transportDate(service.starts_at)} → {transportDate(service.ends_at)}</dd></div><div><dt className="font-medium">Contacto institucional</dt><dd className="mt-1 break-words text-muted-foreground">{service.institutional_contact}</dd></div></dl></article>)}</section>}
  </>}
 </PublicTransportShell>;
}
