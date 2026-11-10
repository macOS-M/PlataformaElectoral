"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, ChevronDown, ClipboardList, GraduationCap, History, Search, Settings2, ShieldCheck, UserRound, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TrainingHistory, TrainingRow } from "./repository";
import { ProgressForm, RequirementForm } from "./forms";
import { formatTrainingDate, trainingLabels, trainingState } from "./presentation";

const states: Record<string, { label: string; style: string }> = {
  unconfigured: { label: "Por configurar", style: "border-amber-200 bg-amber-50 text-amber-900" },
  optional: { label: "No requerida", style: "border-slate-200 bg-slate-50 text-slate-600" },
  vacant: { label: "Puesto vacante", style: "border-orange-200 bg-orange-50 text-orange-900" },
  pendiente: { label: "Pendiente", style: "border-amber-200 bg-amber-50 text-amber-900" },
  convocado: { label: "Convocado", style: "border-violet-200 bg-violet-50 text-violet-800" },
  cumplido: { label: "Cumplido", style: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  no_asistio: { label: "No asistió", style: "border-red-200 bg-red-50 text-red-800" },
};
function StatusBadge({ row }: { row: TrainingRow }) {
  const state = states[trainingState(row)] ?? states.pendiente;
  return <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", state.style)}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{state.label}</span>;
}
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");

export function TrainingWorkspace({ rows, history, canEdit, configured, today }: {
  rows: TrainingRow[]; history: TrainingHistory[]; canEdit: boolean; configured: boolean; today: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [notice, setNotice] = useState("");
  const [selection, setSelection] = useState<{ id: string; mode: "requirement" | "progress" | "detail" } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const selectedRow = rows.find(row => row.positionId === selection?.id);
  const hasSelectedRow = !!selectedRow;
  useEffect(() => {
    if (selection && hasSelectedRow && !dialog.current?.open) dialog.current?.showModal();
    if ((!selection || !hasSelectedRow) && dialog.current?.open) dialog.current.close();
  }, [selection, hasSelectedRow]);
  const needed = rows.filter(row => row.required && row.assignmentId);
  const completed = needed.filter(row => row.status === "cumplido").length;
  const pending = needed.length - completed;
  const unconfigured = rows.filter(row => row.required === null).length;
  const vacant = rows.filter(row => row.required && !row.assignmentId).length;
  const percent = needed.length ? Math.round(completed / needed.length * 100) : null;
  const filtered = rows.filter(row => {
    const state = trainingState(row);
    return (filter === "all" || (filter === "pending" ? row.required && row.assignmentId && state !== "cumplido" : state === filter))
      && normalize(`${row.name} ${row.personName ?? ""}`).includes(normalize(query.trim()));
  });
  const metrics = [
    { title: "Puestos", value: rows.length, description: "En el organigrama", icon: Users, filter: "all", tone: "text-primary bg-primary/10" },
    { title: "Por configurar", value: unconfigured, description: "Definí si requieren capacitación", icon: Settings2, filter: "unconfigured", tone: "text-amber-700 bg-amber-100" },
    { title: "En seguimiento", value: pending, description: "Con ocupante y requisito pendiente", icon: ClipboardList, filter: "pending", tone: "text-violet-700 bg-violet-100" },
    { title: "Completados", value: completed, description: "Puestos con capacitación cumplida", icon: CheckCircle2, filter: "cumplido", tone: "text-emerald-700 bg-emerald-100" },
  ];
  function open(row: TrainingRow, mode: "requirement" | "progress" | "detail") {
    setNotice("");
    setSelection({ id: row.positionId, mode });
  }
  function saved(message: string) {
    setNotice(message);
    dialog.current?.close();
    setSelection(null);
  }
  return <div className="space-y-6">
    {notice && <div role="status" className="fixed inset-x-4 bottom-4 z-50 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 shadow-lg sm:left-auto sm:right-6 sm:max-w-md"><CheckCircle2 size={18} className="shrink-0" aria-hidden="true" />{notice}<button type="button" aria-label="Cerrar aviso" onClick={() => setNotice("")} className="ml-auto flex min-h-11 min-w-11 items-center justify-center rounded-lg"><X size={16} aria-hidden="true" /></button></div>}
    {!!rows.length && <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{metrics.map(({ title, value, description, icon: Icon, filter: itemFilter, tone }) => <button type="button" key={title} aria-pressed={filter === itemFilter} onClick={() => setFilter(itemFilter)} className={cn("min-w-0 rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 sm:p-5", filter === itemFilter && "border-primary/50 ring-1 ring-primary/15")}>
        <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-muted-foreground sm:text-sm">{title}</span><span className={cn("rounded-lg p-2", tone)}><Icon size={17} aria-hidden="true" /></span></div>
        <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </button>)}</div>
      <div className="flex flex-col gap-4 rounded-2xl border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><p className="text-sm font-semibold">Avance del equipo</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{needed.length ? `${completed} de ${needed.length} puestos con ocupante y capacitación requerida completados.` : "El avance estará disponible al configurar puestos requeridos con ocupante."}{vacant ? ` ${vacant} ${vacant === 1 ? "puesto requerido está vacante" : "puestos requeridos están vacantes"}.` : ""}</p></div>
        <div className="flex shrink-0 items-center gap-3 sm:w-48"><div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Avance de capacitación" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined} aria-valuetext={percent === null ? "Sin puestos requeridos con ocupante" : `${percent}%`}><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent ?? 0}%` }} /></div><span className="text-sm font-semibold text-primary">{percent === null ? "—" : `${percent}%`}</span></div>
      </div>
    </>}
    <section aria-labelledby="training-list-title" className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="space-y-4 border-b p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="training-list-title" className="text-lg font-semibold">Plan de capacitación</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{canEdit ? "Configurá cada puesto y registrá el avance de su ocupante." : "Consultá los requisitos y el avance registrado por administración."}</p></div><span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground"><ShieldCheck size={14} aria-hidden="true" />{canEdit ? "Administración" : "Solo consulta"}</span></div>
        {!!rows.length && <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1"><Search size={17} aria-hidden="true" className="pointer-events-none absolute top-3.5 left-3 text-muted-foreground" /><label className="sr-only" htmlFor="training-search">Buscar puesto o persona</label><Input id="training-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar puesto o persona…" className="min-h-11 pl-10" /></div>
          <label className="sr-only" htmlFor="training-filter">Filtrar por estado</label><select id="training-filter" value={filter} onChange={e => setFilter(e.target.value)} className="min-h-11 rounded-lg border bg-card px-3 text-sm sm:max-w-56"><option value="all">Todos los estados</option><option value="unconfigured">Por configurar</option><option value="pending">En seguimiento</option>{Object.entries(states).filter(([key]) => key !== "unconfigured").map(([key, value]) => <option value={key} key={key}>{value.label}</option>)}</select>
        </div>}
      </div>
      {!rows.length ? <div className="flex flex-col items-center px-5 py-14 text-center"><span className="rounded-2xl bg-primary/10 p-4 text-primary"><GraduationCap size={30} aria-hidden="true" /></span><h3 className="mt-5 text-lg font-semibold">No hay puestos disponibles.</h3><p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{configured ? "La capacitación se organiza desde los puestos del organigrama. Cuando haya puestos activos, podrás definir sus requisitos aquí." : "La capacitación estará disponible cuando se configure la conexión y el ámbito de trabajo."}</p><Button asChild variant="outline" className="mt-5 min-h-11"><Link href="/organigrama">Ver organigrama <ArrowRight size={16} aria-hidden="true" /></Link></Button></div>
        : <>
          <p role="status" className="px-4 pt-4 text-xs text-muted-foreground sm:px-6">{filtered.length} de {rows.length} puestos{filter !== "all" || query ? " · Vista filtrada" : ""}</p>
          <div className="divide-y">{filtered.map(row => <article key={row.positionId} aria-label={row.name} className="grid min-w-0 gap-4 p-4 transition-colors hover:bg-muted/15 sm:p-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0"><h3 className="text-sm font-semibold leading-relaxed">{row.name}</h3><p className={cn("mt-2 flex items-start gap-1.5 text-xs", row.personName ? "text-muted-foreground" : "text-amber-800")}><UserRound size={14} aria-hidden="true" className="shrink-0" /><span className="break-words">{row.personName ?? "Sin ocupante asignado"}</span></p></div>
            <div className="min-w-0 space-y-2"><StatusBadge row={row} /><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays size={14} aria-hidden="true" className="shrink-0" />{row.required === false ? "Sin requisito de capacitación" : formatTrainingDate(row.scheduledOn)}</p></div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {canEdit ? row.required && row.assignmentId ? <><Button onClick={() => open(row, "progress")} className="min-h-11" variant={row.status === "cumplido" ? "outline" : "default"}>Registrar avance <ArrowRight size={15} aria-hidden="true" /></Button><Button variant="outline" size="icon" className="min-h-11 min-w-11" aria-label={`Configurar ${row.name}`} onClick={() => open(row, "requirement")}><Settings2 size={17} aria-hidden="true" /></Button></> : <Button variant="outline" className="min-h-11" onClick={() => open(row, "requirement")}><Settings2 size={16} aria-hidden="true" />{row.required === null ? "Configurar puesto" : "Editar requisito"}</Button> : <Button variant="outline" className="min-h-11" onClick={() => open(row, "detail")}>Ver detalle <ArrowRight size={15} aria-hidden="true" /></Button>}
            </div>
            {row.required && !row.assignmentId && <p className="text-xs text-muted-foreground lg:col-span-3">Para registrar avances, <Link href={row.centerId?`/centros/${row.centerId}/organigrama`:"/organigrama/cantonal"} className="font-medium text-primary underline underline-offset-2">asigná un ocupante en el organigrama</Link>.</p>}
          </article>)}</div>
          {!filtered.length && <div className="px-5 py-12 text-center"><Search size={26} aria-hidden="true" className="mx-auto text-muted-foreground" /><h3 className="mt-3 font-semibold">No encontramos coincidencias</h3><p className="mt-2 text-sm text-muted-foreground">Probá otro nombre o cambiá el filtro de estado.</p><Button variant="ghost" className="mt-3 min-h-11" onClick={() => { setQuery(""); setFilter("all"); }}>Limpiar filtros</Button></div>}
        </>}
    </section>
    {!!history.length && <details className="group rounded-2xl border bg-card p-4 sm:p-6"><summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 text-sm font-semibold"><History size={18} aria-hidden="true" className="text-primary" />Historial de requisitos y estados<span className="ml-auto text-xs font-normal text-muted-foreground">{history.length} registros</span><ChevronDown size={17} aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-180" /></summary>
      <p className="mt-2 text-xs text-muted-foreground">Incluye revisiones y ocupantes anteriores. Cada cambio conserva su registro.</p><ol className="mt-5 space-y-4">{history.map((h, i) => <li key={i} className="border-l-2 border-primary/20 pl-4"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{h.positionName}</p><span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">Revisión {h.revision}</span></div><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{h.required ? "Requerido" : "No requerido"} · {formatTrainingDate(h.scheduledOn)}</p><p className="mt-1 text-xs leading-relaxed">{h.personName ?? "Sin registro de ocupante"} · {h.status ? trainingLabels[h.status] : "Sin estados registrados"}{h.statusOn ? ` · ${formatTrainingDate(h.statusOn)}` : ""}</p></li>)}</ol>
    </details>}
    <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-muted-foreground"><ShieldCheck size={15} aria-hidden="true" className="mt-0.5 shrink-0" />Solo los administradores gestionan capacitación. Las convocatorias son internas y no envían correo.</p>
    <dialog ref={dialog} aria-labelledby="training-dialog-title" onClose={() => setSelection(null)} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border bg-card p-0 text-foreground shadow-2xl backdrop:bg-slate-950/45">
      {selectedRow && selection && <>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-card p-5 sm:p-6"><div><p className="text-[11px] font-semibold tracking-widest text-primary uppercase">Capacitación</p><h2 id="training-dialog-title" className="mt-1 text-xl font-semibold">{selection.mode === "requirement" ? "Configurar requisito" : selection.mode === "progress" ? "Registrar avance" : "Detalle del puesto"}</h2></div><Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Cerrar ventana" onClick={() => dialog.current?.close()}><X size={20} aria-hidden="true" /></Button></div>
        <div className="space-y-6 p-5 sm:p-6"><div className="space-y-2 rounded-xl bg-muted/40 p-4"><h3 className="text-sm font-semibold leading-relaxed">{selectedRow.name}</h3><p className="text-xs text-muted-foreground">{selectedRow.personName ?? "Sin ocupante asignado"}</p><div className="flex flex-wrap items-center gap-2"><StatusBadge row={selectedRow} />{selectedRow.required && <span className="text-xs text-muted-foreground">{formatTrainingDate(selectedRow.scheduledOn)}</span>}</div></div>
          {canEdit && selection.mode === "requirement" && <RequirementForm key={`${selectedRow.positionId}/${selectedRow.requirementId}`} row={selectedRow} onSaved={saved} />}
          {canEdit && selection.mode === "progress" && selectedRow.required && selectedRow.assignmentId && <ProgressForm key={`${selectedRow.requirementId}/${selectedRow.assignmentId}/${selectedRow.progressId}`} row={selectedRow} today={today} onSaved={saved} />}
          {selection.mode === "detail" && <dl className="space-y-4 text-sm"><div><dt className="text-muted-foreground">Requisito</dt><dd className="mt-1 font-medium">{selectedRow.required === null ? "Sin configurar" : selectedRow.required ? "Capacitación requerida" : "No requiere capacitación"}</dd></div><div><dt className="text-muted-foreground">Fecha programada</dt><dd className="mt-1">{formatTrainingDate(selectedRow.scheduledOn)}</dd></div><div><dt className="text-muted-foreground">Último registro</dt><dd className="mt-1">{selectedRow.statusOn ? formatTrainingDate(selectedRow.statusOn) : "Sin estados registrados"}</dd></div></dl>}
        </div>
      </>}
    </dialog>
  </div>;
}
