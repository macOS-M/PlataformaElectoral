"use client";
import { useActionState, useId, useState } from "react";
import { AlertCircle, CalendarDays, Check, Save } from "lucide-react";
import { saveProgressAction, saveRequirementAction } from "./actions";
import type { TrainingRow } from "./repository";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
const initial = { error: "", success: "" };
type FormProps = { row: TrainingRow; onSaved?: (message: string) => void };

export function RequirementForm({ row, onSaved }: FormProps) {
  const prefix = useId();
  const [required, setRequired] = useState(row.required);
  const [date, setDate] = useState(row.scheduledOn ?? "");
  const [state, action, pending] = useActionState(async (previous: typeof initial, form: FormData) => {
    const result = await saveRequirementAction(previous, form);
    if (result.success) onSaved?.(result.success);
    return result;
  }, initial);
  const changed = required !== row.required || (required ? date : "") !== (row.scheduledOn ?? "");
  return <form action={action} onReset={event => event.preventDefault()} className="space-y-6">
    <input type="hidden" name="positionId" value={row.positionId} />
    {row.centerId&&<input type="hidden" name="centerId" value={row.centerId}/>}
    <input type="hidden" name="expectedId" value={row.requirementId ?? ""} />
    <fieldset className="space-y-3" disabled={pending}>
      <legend className="mb-3 text-sm font-semibold">¿Este puesto necesita capacitación?</legend>
      {[{ value: true, title: "Requiere capacitación", detail: "Da seguimiento a la preparación de su ocupante." }, { value: false, title: "No requerida", detail: "Este puesto queda fuera del seguimiento de cumplimiento." }].map(option => <label key={String(option.value)} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors", required === option.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/40")}>
        <input className="mt-1 accent-primary" type="radio" name="required" value={option.value ? "on" : "off"} checked={required === option.value} onChange={() => setRequired(option.value)} required />
        <span><span className="block text-sm font-semibold">{option.title}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{option.detail}</span></span>
      </label>)}
    </fieldset>
    {required ? <div className="space-y-2">
      <label htmlFor={`${prefix}-date`} className="flex flex-wrap items-center gap-2 text-sm font-semibold"><CalendarDays size={16} aria-hidden="true" />Fecha de capacitación <span className="font-normal text-muted-foreground">(opcional)</span></label>
      <Input id={`${prefix}-date`} type="date" name="scheduledOn" value={date} onChange={e => setDate(e.target.value)} disabled={pending} className="min-h-11" />
      <p className="text-xs leading-relaxed text-muted-foreground">Podés definirla después. Para convocar o registrar asistencia necesitás una fecha programada.</p>
    </div> : <input type="hidden" name="scheduledOn" value="" />}
    {row.requirementId && changed && <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" /><p>Este cambio inicia una nueva revisión. Si requiere capacitación, el avance comienza <strong>pendiente</strong>. Los registros anteriores se conservan en el historial.</p></div>}
    {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
    {state.success && <p role="status" className="text-sm text-primary">{state.success}</p>}
    <Button disabled={pending || required === null || !changed} type="submit" className="min-h-11 w-full"><Save size={16} aria-hidden="true" />{pending ? "Guardando…" : "Guardar requisito"}</Button>
  </form>;
}

export function ProgressForm({ row, today, onSaved }: FormProps & { today: string }) {
  const prefix = useId();
  const [status, setStatus] = useState(row.status ?? "pendiente");
  const [date, setDate] = useState(row.statusOn ?? today);
  const [state, action, pending] = useActionState(async (previous: typeof initial, form: FormData) => {
    const result = await saveProgressAction(previous, form);
    if (result.success) onSaved?.(result.success);
    return result;
  }, initial);
  const attendance = status === "cumplido" || status === "no_asistio";
  const minDate = [row.statusOn, attendance ? row.scheduledOn : null].filter((v): v is string => !!v).sort().at(-1);
  const options = [
    { value: "pendiente", label: "Pendiente", detail: "Aún no completa la capacitación." },
    { value: "convocado", label: "Convocado", detail: "Convocatoria registrada internamente." },
    { value: "cumplido", label: "Cumplido", detail: "Completó la capacitación programada." },
    { value: "no_asistio", label: "No asistió", detail: "No asistió en la fecha programada." },
  ];
  return <form action={action} onReset={event => event.preventDefault()} className="space-y-6">
    <input type="hidden" name="requirementId" value={row.requirementId ?? ""} />
    {row.centerId&&<input type="hidden" name="centerId" value={row.centerId}/>}
    <input type="hidden" name="assignmentId" value={row.assignmentId ?? ""} />
    <input type="hidden" name="expectedId" value={row.progressId ?? ""} />
    <fieldset disabled={pending}>
      <legend className="mb-3 text-sm font-semibold">Estado de cumplimiento</legend>
      <div className="grid gap-3 sm:grid-cols-2">{options.map(option => {
        const disabled = option.value !== "pendiente" && (!row.scheduledOn || (option.value !== "convocado" && row.scheduledOn > today));
        return <label key={option.value} className={cn("flex items-start gap-3 rounded-xl border p-4", disabled ? "cursor-not-allowed bg-muted/30 opacity-60" : "cursor-pointer hover:bg-muted/40", status === option.value && "border-primary bg-primary/5 ring-1 ring-primary")}>
          <input type="radio" name="status" value={option.value} checked={status === option.value} disabled={disabled} required className="mt-1 accent-primary" onChange={() => {
            setStatus(option.value);
            if ((option.value === "cumplido" || option.value === "no_asistio") && row.scheduledOn && date < row.scheduledOn) setDate(row.scheduledOn);
          }} />
          <span><span className="block text-sm font-semibold">{option.label}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{option.detail}</span></span>
        </label>;
      })}</div>
    </fieldset>
    {!row.scheduledOn && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Primero configurá la fecha de capacitación para habilitar convocatoria y asistencia.</p>}
    {row.scheduledOn && row.scheduledOn > today && <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">La capacitación aún no se ha realizado. Podés registrar la convocatoria; la asistencia se habilita desde la fecha programada.</p>}
    <div className="space-y-2"><label htmlFor={`${prefix}-date`} className="text-sm font-semibold">Fecha del registro</label>
      <Input id={`${prefix}-date`} type="date" name="statusOn" required value={date} onChange={e => setDate(e.target.value)} min={minDate} max={today} disabled={pending} className="min-h-11" />
      <p className="text-xs text-muted-foreground">No puede ser futura ni anterior al último estado{attendance ? " o a la capacitación" : ""}.</p>
    </div>
    <p className="text-xs leading-relaxed text-muted-foreground">La convocatoria es interna. Registrar un estado no envía correo.</p>
    {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
    {state.success && <p role="status" className="text-sm text-primary">{state.success}</p>}
    <Button type="submit" disabled={pending} className="min-h-11 w-full"><Check size={16} aria-hidden="true" />{pending ? "Guardando…" : "Registrar estado"}</Button>
  </form>;
}
