import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getInventory } from "@/modules/inventory/service";
import { InventoryWorkspace } from "@/modules/inventory/workspace";
import { InventoryHistory } from "@/modules/inventory/history";
import { kinds, labels } from "@/modules/inventory/schemas";
export const metadata = {title:"Inventario de signos externos"};
export default async function InventoryPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const data=await getInventory(await searchParams);
 if(!data.allowed)return <><PageHeading eyebrow="Signos externos" title="Inventario de signos externos" description="Stock por ubicación, entregas y ajustes auditables."/><p role="status">{data.unavailable?"El inventario aún no ha sido habilitado por la administración.":data.configured?"El inventario requiere permiso de signos externos o administración.":"El inventario aún no está conectado. No se muestran existencias ficticias."}</p></>;
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Costa_Rica",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const filterQuery=new URLSearchParams(Object.entries(data.filters).filter(([,value])=>value).map(([key,value])=>[key,String(value)]));
 const page=data.filters.page??1;
 const pageLink=(number:number)=>{const params=new URLSearchParams(filterQuery);params.set("page",String(number));return `/inventario?${params}`;};
 return <>
 <PageHeading eyebrow="Signos externos" title="Inventario" description="Administrá tus artículos, recibí material y organizá las entregas."/>
 <InventoryWorkspace items={data.items} locations={data.locations} stock={data.stock} people={data.people} districts={data.districts} centers={data.centers} needs={data.needs} pending={data.pending} admin={data.admin} userId={data.userId} today={today} initialLocationId={data.filters.location} initialItemId={data.filters.item}/>
 <details open={Boolean(data.filters.item||data.filters.location||data.filters.kind||data.filters.person||data.filters.from||data.filters.to||page>1)} className="rounded-xl border bg-card">
 <summary className="cursor-pointer p-5 text-sm font-semibold">Historial de movimientos · consultar y exportar</summary>
 <Card><CardHeader><CardTitle>Historial auditable</CardTitle></CardHeader><CardContent className="space-y-4">
 <form method="get" action="/inventario" className="grid gap-3 sm:grid-cols-3">
 <label className="grid gap-1 text-sm">Artículo<select name="item" defaultValue={data.filters.item} className="min-h-11 rounded border bg-card px-2"><option value="">Todos</option>{data.items.map(i=><option key={i.id} value={i.id}>{i.name} {i.variant} · {i.unit}</option>)}</select></label>
 <label className="grid gap-1 text-sm">Ubicación<select name="location" defaultValue={data.filters.location} className="min-h-11 rounded border bg-card px-2"><option value="">Todas</option>{data.locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
 <label className="grid gap-1 text-sm">Persona<select name="person" defaultValue={data.filters.person} className="min-h-11 rounded border bg-card px-2"><option value="">Todas</option>{data.people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
 <label className="grid gap-1 text-sm">Tipo<select name="kind" defaultValue={data.filters.kind} className="min-h-11 rounded border bg-card px-2"><option value="">Todos</option>{kinds.map(k=><option key={k} value={k}>{labels[k]}</option>)}</select></label>
 <label className="grid gap-1 text-sm">Desde<input type="date" name="from" defaultValue={data.filters.from} className="min-h-11 rounded border bg-card px-2"/></label>
 <label className="grid gap-1 text-sm">Hasta<input type="date" name="to" defaultValue={data.filters.to} className="min-h-11 rounded border bg-card px-2"/></label>
 <button className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white">Filtrar historial</button><Link href="/inventario" className="py-3 text-sm text-primary">Limpiar filtros</Link></form>
 {data.invalidFilters&&<p role="alert">Filtros inválidos. Se muestra el historial del evento sin filtros.</p>}
 {data.admin&&<a href={`/inventario/exportar?${filterQuery}`} className="inline-block py-3 text-sm font-semibold text-primary">Exportar CSV restringido</a>}
 {data.history.length>500&&<p role="status">Hay más movimientos. Continúa en la siguiente página o acota los filtros.</p>}
 {!data.history.length&&<p>No hay movimientos para estos filtros.</p>}<InventoryHistory rows={data.history.slice(0,500)}/>
 <nav aria-label="Páginas de movimientos" className="flex flex-wrap items-center gap-4 text-sm"><span>Página {page}</span>{page>1&&<Link href={pageLink(page-1)} className="py-3 text-primary">Anterior</Link>}{data.history.length>500&&<Link href={pageLink(page+1)} className="py-3 text-primary">Siguiente</Link>}</nav>
 </CardContent></Card>
 </details>
 </>;
}
