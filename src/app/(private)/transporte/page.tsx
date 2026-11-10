import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTransport } from "@/modules/transport/service";
import { VehicleForm } from "@/modules/transport/forms";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCenterDetail } from "@/modules/voting-centers/area-service";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
export const metadata = { title: "Transporte" };
export default async function TransportPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const query=await searchParams;if(Array.isArray(query.center))notFound();
  const selected=query.center?(await getCenterDetail(query.center)).center:null;
  const data = await getTransport();
  const vehicles=selected?data.vehicles.filter(v=>v.centerIds.includes(selected.id)):data.vehicles;
  const history=selected?data.history.filter(h=>h.centerId===selected.id):data.history;
  return <>
    <PageHeading eyebrow={selected?selected.name:"Logística cantonal"} title="Transporte" description="Conductores y vehículos en una misma ficha, con documentos privados y vínculos a distritos y centros." />
    {selected&&<Link href={`/centros/${selected.id}/organigrama`} className="text-sm text-primary">← Volver al organigrama de este centro</Link>}
    <p className="text-sm text-muted-foreground">Gestión interna. Estos contactos y asignaciones no se publican en la portada ciudadana.</p>
    <Button asChild variant="outline" className="min-h-11"><Link href={selected?`/transporte/operacion?center=${selected.id}&district=${selected.districtId}`:"/transporte/operacion"}>Disponibilidad, servicios y solicitudes</Link></Button>
    {data.canEdit && <Card><CardHeader><CardTitle>Registrar conductor y vehículo</CardTitle></CardHeader><CardContent><VehicleForm key={`${selected?.id??"all"}-${data.vehicles.length}`} people={data.people} districts={data.districts} centers={data.centers} initialCenterId={selected?.id} registrationId={randomUUID()}/></CardContent></Card>}
    {selected&&data.canEdit&&<p className="text-sm text-muted-foreground">Para vincular un vehículo ya registrado, <Link href="/transporte" className="text-primary underline">abrí la flota compartida</Link> y agregá este centro a sus destinos. Al editar, se conservan sus demás vínculos.</p>}
    <Card><CardHeader><CardTitle>Vehículos ({vehicles.length})</CardTitle></CardHeader><CardContent className="space-y-4">
      {!vehicles.length && <p className="text-sm">{selected?"Este centro no tiene vehículos vinculados.":"No hay vehículos registrados."}</p>}
      {vehicles.map(v => {
        const person = data.people.find(p => p.id === v.responsibleId);
        return <details key={`${v.id}-${v.version}`} className="rounded-lg border p-4">
          <summary className="cursor-pointer text-sm font-semibold">{person?.fullName??"Conductor sin ficha"} · {v.plate} · {v.description} · {v.active ? "Activo" : "Inactivo"} · {v.centerIds.length} centros</summary>
          <div className="mt-4 space-y-4">
            <p className="break-words text-sm">Conductor: {person?.fullName ?? "Sin ficha"} · Teléfono: {person?.phone ?? "Sin registrar"} · Correo: {person?.email ?? "Sin registrar"}</p>
            <Button asChild variant="outline"><Link href={`/transporte/vehiculos/${v.id}`}>Ficha y documentos de esta unidad</Link></Button>
            <p className="text-sm">Distritos: {v.districtIds.map(id => data.districts.find(d => d.id === id)?.name ?? "Distrito inactivo").join(", ") || "Sin asignar"}</p>
            <p className="text-sm">Centros: {v.centerIds.map(id => data.centers.find(c => c.id === id)?.name ?? "Centro no disponible").join(", ") || "Sin asignar"}</p>
            {data.canEdit && <VehicleForm vehicle={v} people={data.people} districts={data.districts} centers={data.centers} registrationId={randomUUID()}/>}
          </div>
        </details>;
      })}
    </CardContent></Card>
    {!!history.length && <Card><CardHeader><CardTitle>Historial de asignaciones</CardTitle></CardHeader><CardContent><ul className="space-y-3 text-sm">{history.map((h, i) => <li key={i}>{h.plate} · {h.kind}: {h.destination}<span className="block text-xs text-muted-foreground">{h.startedAt.slice(0, 19)} → {h.endedAt?.slice(0, 19) ?? "Vigente"}</span></li>)}</ul></CardContent></Card>}
  </>;
}
