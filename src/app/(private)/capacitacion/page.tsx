import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTraining } from "@/modules/training/service";
import { RequirementForm, ProgressForm } from "@/modules/training/forms";
export const metadata = { title: "Capacitación" };
const labels: Record<string, string> = { pendiente: "Pendiente", convocado: "Convocado", cumplido: "Cumplido", no_asistio: "No asistió" };
export default async function TrainingPage() {
  const data = await getTraining();
  return <>
    <PageHeading eyebrow="Preparación del equipo" title="Capacitación por puesto" description="Requisitos, fechas y cumplimiento de los ocupantes del organigrama para el evento actual." />
    <p className="text-sm text-muted-foreground">Solo los administradores gestionan capacitación. Las convocatorias son internas; no se envían notificaciones por correo en este incremento.</p>
    <Card><CardHeader><CardTitle>Puestos ({data.rows.length})</CardTitle></CardHeader><CardContent className="space-y-4">
      {!data.rows.length && <p className="text-sm">No hay puestos disponibles.</p>}
      {data.rows.map(row => <details key={`${row.positionId}-${row.requirementId}-${row.progressId}-${row.assignmentId}`} className="rounded-lg border p-4">
        <summary className="cursor-pointer text-sm font-semibold">{row.name} · {row.required === null ? "Sin configurar" : !row.required ? "No requerido" : labels[row.status ?? "pendiente"]}</summary>
        <div className="mt-4 space-y-4">
          <p className="text-sm">Ocupante: {row.personName ?? "Vacante"} · Fecha programada: {row.scheduledOn ?? "Sin fecha"}{row.statusOn ? ` · Fecha de estado: ${row.statusOn}` : ""}</p>
          {data.canEdit && <RequirementForm row={row} />}
          {data.canEdit && row.required && row.assignmentId && <ProgressForm row={row} />}
          {row.required && !row.assignmentId && <p className="text-sm text-muted-foreground">Asigna un ocupante desde el organigrama antes de registrar su cumplimiento.</p>}
        </div>
      </details>)}
    </CardContent></Card>
    {!!data.history.length && <Card><CardHeader><CardTitle>Historial de requisitos y estados</CardTitle></CardHeader><CardContent><ul className="space-y-3 text-sm">{data.history.map((h, i) => <li key={i}>{h.positionName} · Revisión {h.revision} · {h.required ? "Requerido" : "No requerido"} · Programada: {h.scheduledOn ?? "Sin fecha"}<span className="block text-xs text-muted-foreground">{h.personName ?? "Sin registro de ocupante"} · {h.status ? labels[h.status] : "Sin estados registrados"} {h.statusOn ?? ""}</span></li>)}</ul></CardContent></Card>}
  </>;
}
