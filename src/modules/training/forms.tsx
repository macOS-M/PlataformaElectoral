"use client";
import { useActionState, useId, useState } from "react";
import { saveProgressAction, saveRequirementAction } from "./actions";
import type { TrainingRow } from "./repository";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
const initial = { error: "", success: "" };
export function RequirementForm({ row }: { row: TrainingRow }) {
  const prefix = useId();
  const [required, setRequired] = useState(row.required ?? false);
  const [state, action, pending] = useActionState(saveRequirementAction, initial);
  return <form action={action} className="space-y-3 rounded-lg border p-4">
    <input type="hidden" name="positionId" value={row.positionId} /><input type="hidden" name="expectedId" value={row.requirementId ?? ""} />
    <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="required" checked={required} onChange={e => setRequired(e.target.checked)} />Este puesto requiere capacitación</label>
    <div><label htmlFor={`${prefix}-date`} className="mb-1 block text-sm">Fecha programada</label><Input id={`${prefix}-date`} type="date" name="scheduledOn" defaultValue={row.scheduledOn ?? ""} disabled={!required} />{!required && <input type="hidden" name="scheduledOn" value="" />}</div>
    <p className="text-xs text-muted-foreground">Cambiar obligatoriedad o fecha crea una revisión; el nuevo requisito comienza pendiente y conserva los estados anteriores en el historial.</p>
    {state.error && <p role="alert" className="text-sm text-red-800">{state.error}</p>}{state.success && <p role="status" className="text-sm text-primary">{state.success}</p>}
    <Button disabled={pending} type="submit">{pending ? "Guardando…" : "Guardar requisito"}</Button>
  </form>;
}
export function ProgressForm({ row }: { row: TrainingRow }) {
  const prefix = useId();
  const [state, action, pending] = useActionState(saveProgressAction, initial);
  return <form action={action} className="space-y-3 rounded-lg border p-4">
    <input type="hidden" name="requirementId" value={row.requirementId ?? ""} /><input type="hidden" name="assignmentId" value={row.assignmentId ?? ""} /><input type="hidden" name="expectedId" value={row.progressId ?? ""} />
    <div><label htmlFor={`${prefix}-status`} className="mb-1 block text-sm">Estado de cumplimiento</label><select id={`${prefix}-status`} name="status" defaultValue={row.status ?? "pendiente"} className="min-h-11 w-full rounded-lg border bg-card px-3 text-sm"><option value="pendiente">Pendiente</option><option value="convocado">Convocado</option><option value="cumplido">Cumplido</option><option value="no_asistio">No asistió</option></select></div>
    <div><label htmlFor={`${prefix}-date`} className="mb-1 block text-sm">Fecha del estado o cumplimiento</label><Input id={`${prefix}-date`} type="date" name="statusOn" required defaultValue={row.statusOn ?? ""} /></div>
    <p className="text-xs text-muted-foreground">La convocatoria requiere fecha programada. Cumplido y No asistió solo se registran desde esa fecha; no se admiten estados con fecha futura. La convocatoria es un registro interno: no envía correo.</p>
    {state.error && <p role="alert" className="text-sm text-red-800">{state.error}</p>}{state.success && <p role="status" className="text-sm text-primary">{state.success}</p>}
    <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Registrar estado"}</Button>
  </form>;
}
