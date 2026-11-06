import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTransport } from "@/modules/transport/service";
import { VehicleForm } from "@/modules/transport/forms";
export const metadata = { title: "Transporte" };
export default async function TransportPage() {
  const data = await getTransport();
  return <>
    <PageHeading eyebrow="Logística cantonal" title="Transporte" description="Vehículos y encargados compartidos, con asignaciones a distritos y centros del evento actual." />
    <p className="text-sm text-muted-foreground">Gestión interna. Estos contactos y asignaciones no se publican en la portada ciudadana.</p>
    {data.canEdit && <Card><CardHeader><CardTitle>Registrar vehículo</CardTitle></CardHeader><CardContent><VehicleForm key={data.vehicles.length} people={data.people} districts={data.districts} centers={data.centers} /></CardContent></Card>}
    <Card><CardHeader><CardTitle>Vehículos ({data.vehicles.length})</CardTitle></CardHeader><CardContent className="space-y-4">
      {!data.vehicles.length && <p className="text-sm">No hay vehículos registrados.</p>}
      {data.vehicles.map(v => {
        const person = data.people.find(p => p.id === v.responsibleId);
        return <details key={`${v.id}-${v.version}`} className="rounded-lg border p-4">
          <summary className="cursor-pointer text-sm font-semibold">{v.plate} · {v.description} · {v.active ? "Activo" : "Inactivo"} · {v.centerIds.length} centros</summary>
          <div className="mt-4 space-y-4">
            <p className="break-words text-sm">Encargado: {person?.fullName ?? "Sin ficha"} · Teléfono: {person?.phone ?? "Sin registrar"} · Correo: {person?.email ?? "Sin registrar"}</p>
            <p className="text-sm">Distritos: {v.districtIds.map(id => data.districts.find(d => d.id === id)?.name ?? "Distrito inactivo").join(", ") || "Sin asignar"}</p>
            <p className="text-sm">Centros: {v.centerIds.map(id => data.centers.find(c => c.id === id)?.name ?? "Centro no disponible").join(", ") || "Sin asignar"}</p>
            {data.canEdit && <VehicleForm vehicle={v} people={data.people} districts={data.districts} centers={data.centers} />}
          </div>
        </details>;
      })}
    </CardContent></Card>
    {!!data.history.length && <Card><CardHeader><CardTitle>Historial de asignaciones</CardTitle></CardHeader><CardContent><ul className="space-y-3 text-sm">{data.history.map((h, i) => <li key={i}>{h.plate} · {h.kind}: {h.destination}<span className="block text-xs text-muted-foreground">{h.startedAt.slice(0, 19)} → {h.endedAt?.slice(0, 19) ?? "Vigente"}</span></li>)}</ul></CardContent></Card>}
  </>;
}
